import { describe, expect, it, vi, beforeEach } from "vitest";
import type { McpServerConfig } from "@repo/types";
import { createDefaultToolBroker, ToolBroker } from "../src/index.js";
import { McpClientFactory } from "../src/mcp-client.js";
import type { McpToolDef } from "../src/mcp-client.js";

// ---------------------------------------------------------------------------
// Helpers: minimal fake MCP client
// ---------------------------------------------------------------------------

interface FakeMcpClient {
  connect: ReturnType<typeof vi.fn>;
  listTools: ReturnType<typeof vi.fn>;
  callTool: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function makeFakeClient(tools: McpToolDef[] = []): FakeMcpClient {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue(tools),
    callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    disconnect: vi.fn()
  };
}

const sampleMcpConfig: McpServerConfig = {
  id: "test-server",
  name: "Test MCP Server",
  transport: "http",
  endpoint: "http://localhost:9999/mcp",
  authType: "none",
  enabled: true
};

const sampleTools: McpToolDef[] = [
  {
    name: "search.query",
    description: "Run a search query",
    inputSchema: { type: "object", properties: { q: { type: "string" } } }
  },
  {
    name: "db.records_destructive",
    description: "Destructive DB operation",
    inputSchema: { type: "object", properties: { table: { type: "string" } } }
  },
  {
    name: "fs.write",
    description: "Write to filesystem",
    inputSchema: { type: "object", properties: { path: { type: "string" } } }
  }
];

// ---------------------------------------------------------------------------
// Existing behaviour tests
// ---------------------------------------------------------------------------

describe("tool-broker", () => {
  it("prioritizes MCP tools first", () => {
    const broker = createDefaultToolBroker();
    const names = broker.listTools().map((tool) => tool.descriptor.name);
    expect(names[0]).toBe("filesystem.read");
  });

  it("enforces approval on sensitive tools", async () => {
    const broker = createDefaultToolBroker();
    await expect(
      broker.execute({
        runId: "run-1",
        roleId: "role-1",
        toolName: "git.push",
        input: { branch: "main" },
        role: "admin",
        approvalMode: "approval",
        approved: false
      })
    ).rejects.toThrow("requires approval");
  });

  it("executes non-sensitive tools without approval", async () => {
    const broker = createDefaultToolBroker();
    const result = await broker.execute({
      runId: "run-1",
      roleId: "role-1",
      toolName: "filesystem.read",
      input: { path: "README.md" },
      role: "viewer",
      approvalMode: "approval",
      approved: false
    });
    expect(result.output.status).toBe("ok");
  });
});

// ---------------------------------------------------------------------------
// MCP integration tests
// ---------------------------------------------------------------------------

describe("tool-broker MCP integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("connects and discovers tools from MCP server mock", async () => {
    const fakeClient = makeFakeClient(sampleTools);
    vi.spyOn(McpClientFactory, "create").mockReturnValue(fakeClient as ReturnType<typeof McpClientFactory.create>);

    const broker = new ToolBroker();
    const result = await broker.connectMcpServer(sampleMcpConfig);

    // connect and listTools were called
    expect(fakeClient.connect).toHaveBeenCalledOnce();
    expect(fakeClient.listTools).toHaveBeenCalledOnce();

    // All three tools discovered and returned
    expect(result.tools).toHaveLength(sampleTools.length);
    expect(result.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(["search.query", "db.records_destructive", "fs.write"])
    );

    // Server appears in connected list
    const connected = broker.listConnectedServers();
    expect(connected).toHaveLength(1);
    expect(connected[0]?.id).toBe("test-server");

    // Tools are registered
    const catalog = broker.listCatalog();
    const names = catalog.map((d) => d.name);
    expect(names).toContain("search.query");
    expect(names).toContain("db.records_destructive");
    expect(names).toContain("fs.write");
  });

  it("calls the real MCP client when executing a discovered tool", async () => {
    const fakeClient = makeFakeClient([sampleTools[0]!]);
    vi.spyOn(McpClientFactory, "create").mockReturnValue(fakeClient as ReturnType<typeof McpClientFactory.create>);

    const broker = new ToolBroker();
    await broker.connectMcpServer(sampleMcpConfig);

    const result = await broker.execute({
      runId: "r1",
      roleId: "role-a",
      toolName: "search.query",
      input: { q: "hello" },
      role: "viewer",
      approvalMode: "auto",
      approved: true
    });

    expect(fakeClient.callTool).toHaveBeenCalledWith("search.query", { q: "hello" });
    expect(result.output).toHaveProperty("content");
  });

  it("marks destructive tools as sensitive", async () => {
    const fakeClient = makeFakeClient(sampleTools);
    vi.spyOn(McpClientFactory, "create").mockReturnValue(fakeClient as ReturnType<typeof McpClientFactory.create>);

    const broker = new ToolBroker();
    await broker.connectMcpServer(sampleMcpConfig);

    const catalog = broker.listCatalog();

    const destructive = catalog.find((d) => d.name === "db.records_destructive");
    expect(destructive).toBeDefined();
    expect(destructive?.sensitive).toBe(true);

    const writeFile = catalog.find((d) => d.name === "fs.write");
    expect(writeFile).toBeDefined();
    expect(writeFile?.sensitive).toBe(true);

    const search = catalog.find((d) => d.name === "search.query");
    expect(search).toBeDefined();
    expect(search?.sensitive).toBe(false);
  });

  it("requires approval for sensitive MCP tools", async () => {
    const fakeClient = makeFakeClient(sampleTools);
    vi.spyOn(McpClientFactory, "create").mockReturnValue(fakeClient as ReturnType<typeof McpClientFactory.create>);

    const broker = new ToolBroker();
    await broker.connectMcpServer(sampleMcpConfig);

    // Attempting to execute a sensitive tool in approval mode without approval should throw
    await expect(
      broker.execute({
        runId: "r2",
        roleId: "role-b",
        toolName: "fs.write",
        input: { path: "/etc/hosts" },
        role: "admin",
        approvalMode: "approval",
        approved: false
      })
    ).rejects.toThrow("requires approval");
  });

  it("disconnects MCP server and removes tools", async () => {
    const fakeClient = makeFakeClient(sampleTools);
    vi.spyOn(McpClientFactory, "create").mockReturnValue(fakeClient as ReturnType<typeof McpClientFactory.create>);

    const broker = new ToolBroker();
    await broker.connectMcpServer(sampleMcpConfig);

    // Confirm tools are registered
    expect(broker.listCatalog().map((d) => d.name)).toContain("search.query");

    // Disconnect
    await broker.disconnectMcpServer("test-server");

    expect(fakeClient.disconnect).toHaveBeenCalledOnce();

    // Tools should be gone
    const catalog = broker.listCatalog();
    const names = catalog.map((d) => d.name);
    expect(names).not.toContain("search.query");
    expect(names).not.toContain("db.records_destructive");
    expect(names).not.toContain("fs.write");

    // Server removed from connected list
    expect(broker.listConnectedServers()).toHaveLength(0);
  });

  it("tests MCP server connectivity without persisting", async () => {
    const fakeClient = makeFakeClient(sampleTools);
    vi.spyOn(McpClientFactory, "create").mockReturnValue(fakeClient as ReturnType<typeof McpClientFactory.create>);

    const broker = new ToolBroker();
    const testResult = await broker.testMcpServer(sampleMcpConfig);

    expect(testResult.reachable).toBe(true);
    expect(testResult.toolCount).toBe(sampleTools.length);
    expect(testResult.latencyMs).toBeGreaterThanOrEqual(0);

    // Disconnect must be called even on success
    expect(fakeClient.disconnect).toHaveBeenCalledOnce();

    // No tools should be registered in the broker
    expect(broker.listCatalog()).toHaveLength(0);

    // No server in connected list
    expect(broker.listConnectedServers()).toHaveLength(0);
  });

  it("reports unreachable when MCP server connect fails", async () => {
    const fakeClient = makeFakeClient();
    fakeClient.connect.mockRejectedValue(new Error("ECONNREFUSED"));
    vi.spyOn(McpClientFactory, "create").mockReturnValue(fakeClient as ReturnType<typeof McpClientFactory.create>);

    const broker = new ToolBroker();
    const testResult = await broker.testMcpServer(sampleMcpConfig);

    expect(testResult.reachable).toBe(false);
    expect(testResult.toolCount).toBe(0);
    // disconnect is still called in finally block
    expect(fakeClient.disconnect).toHaveBeenCalledOnce();
  });

  it("reconnects to same server id by replacing previous connection", async () => {
    const firstClient = makeFakeClient([sampleTools[0]!]);
    const secondTools: McpToolDef[] = [
      {
        name: "new.tool",
        description: "A newly added tool",
        inputSchema: { type: "object", properties: {} }
      }
    ];
    const secondClient = makeFakeClient(secondTools);

    const factory = vi.spyOn(McpClientFactory, "create");
    factory.mockReturnValueOnce(firstClient as ReturnType<typeof McpClientFactory.create>);
    factory.mockReturnValueOnce(secondClient as ReturnType<typeof McpClientFactory.create>);

    const broker = new ToolBroker();

    // First connect
    await broker.connectMcpServer(sampleMcpConfig);
    expect(broker.listCatalog().map((d) => d.name)).toContain("search.query");

    // Second connect replaces first
    await broker.connectMcpServer(sampleMcpConfig);

    // Old client was disconnected
    expect(firstClient.disconnect).toHaveBeenCalledOnce();

    // Old tools gone, new tool present
    const names = broker.listCatalog().map((d) => d.name);
    expect(names).not.toContain("search.query");
    expect(names).toContain("new.tool");
  });

  it("listConnectedServers returns all currently connected servers", async () => {
    const configA: McpServerConfig = { ...sampleMcpConfig, id: "server-a", name: "Server A" };
    const configB: McpServerConfig = { ...sampleMcpConfig, id: "server-b", name: "Server B" };

    const clientA = makeFakeClient([sampleTools[0]!]);
    const clientB = makeFakeClient([sampleTools[1]!]);

    const factory = vi.spyOn(McpClientFactory, "create");
    factory.mockReturnValueOnce(clientA as ReturnType<typeof McpClientFactory.create>);
    factory.mockReturnValueOnce(clientB as ReturnType<typeof McpClientFactory.create>);

    const broker = new ToolBroker();
    await broker.connectMcpServer(configA);
    await broker.connectMcpServer(configB);

    const servers = broker.listConnectedServers();
    expect(servers).toHaveLength(2);
    expect(servers.map((s) => s.id)).toEqual(expect.arrayContaining(["server-a", "server-b"]));
  });
});

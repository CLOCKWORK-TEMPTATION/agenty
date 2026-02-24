import { describe, expect, it, vi, beforeEach } from "vitest";
import type { McpServerConfig } from "@repo/types";
import { ToolBroker } from "../src/index.js";
import { McpClientFactory } from "../src/mcp-client.js";
import type { McpToolDef } from "../src/mcp-client.js";

// ---------------------------------------------------------------------------
// Fake MCP client helpers
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

const mcpConfig: McpServerConfig = {
  id: "reliability-server",
  name: "Reliability Test Server",
  transport: "http",
  endpoint: "http://localhost:19999/mcp",
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
    name: "data.write",
    description: "Write data",
    inputSchema: { type: "object", properties: { key: { type: "string" } } }
  }
];

// ---------------------------------------------------------------------------
// Tool broker reliability tests
// ---------------------------------------------------------------------------

describe("tool-broker reliability", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles MCP server connection timeout gracefully", async () => {
    // Simulate a connect() that rejects — this mimics a timeout or refused
    // connection. connectMcpServer must propagate the error rather than
    // silently swallowing it.
    const fakeClient = makeFakeClient();
    fakeClient.connect.mockRejectedValue(new Error("MCP timeout after 30000ms: initialize"));
    vi.spyOn(McpClientFactory, "create").mockReturnValue(
      fakeClient as ReturnType<typeof McpClientFactory.create>
    );

    const broker = new ToolBroker();

    await expect(broker.connectMcpServer(mcpConfig)).rejects.toThrow(/timeout|ECONNREFUSED|initialize/i);

    // No tools should be registered after a failed connect
    expect(broker.listCatalog()).toHaveLength(0);
    // Server must not appear as connected
    expect(broker.listConnectedServers()).toHaveLength(0);
  });

  it("handles MCP server disconnect during tool execution", async () => {
    // Server connects fine and registers tools. Then during callTool() the
    // client throws an error simulating a mid-execution disconnect.
    const fakeClient = makeFakeClient([sampleTools[0]!]);
    fakeClient.callTool.mockRejectedValue(new Error("MCP process exited with code null"));
    vi.spyOn(McpClientFactory, "create").mockReturnValue(
      fakeClient as ReturnType<typeof McpClientFactory.create>
    );

    const broker = new ToolBroker();
    await broker.connectMcpServer(mcpConfig);

    // Execute should propagate the disconnect error
    await expect(
      broker.execute({
        runId: "run-disconnect",
        roleId: "role-1",
        toolName: "search.query",
        input: { q: "test" },
        role: "operator",
        approvalMode: "auto",
        approved: true
      })
    ).rejects.toThrow(/exited|disconnect/i);
  });

  it("removes tools when MCP server disconnects", async () => {
    const fakeClient = makeFakeClient(sampleTools);
    vi.spyOn(McpClientFactory, "create").mockReturnValue(
      fakeClient as ReturnType<typeof McpClientFactory.create>
    );

    const broker = new ToolBroker();
    await broker.connectMcpServer(mcpConfig);

    // Confirm tools are present before disconnect
    const namesBeforeDisconnect = broker.listCatalog().map((d) => d.name);
    expect(namesBeforeDisconnect).toContain("search.query");
    expect(namesBeforeDisconnect).toContain("data.write");

    // Disconnect
    await broker.disconnectMcpServer(mcpConfig.id);

    // Tools and server must be gone
    const namesAfterDisconnect = broker.listCatalog().map((d) => d.name);
    expect(namesAfterDisconnect).not.toContain("search.query");
    expect(namesAfterDisconnect).not.toContain("data.write");
    expect(broker.listConnectedServers()).toHaveLength(0);
    expect(fakeClient.disconnect).toHaveBeenCalledOnce();
  });

  it("parallel tool registrations don't corrupt state", async () => {
    // Connect two different MCP servers concurrently and verify that the
    // resulting catalog contains exactly the tools from both servers with no
    // interleaving corruption.
    const configA: McpServerConfig = { ...mcpConfig, id: "server-a", name: "Server A" };
    const configB: McpServerConfig = { ...mcpConfig, id: "server-b", name: "Server B" };

    const toolsA: McpToolDef[] = [
      {
        name: "a.tool1",
        description: "Tool from A",
        inputSchema: { type: "object" }
      },
      {
        name: "a.tool2",
        description: "Another tool from A",
        inputSchema: { type: "object" }
      }
    ];
    const toolsB: McpToolDef[] = [
      {
        name: "b.tool1",
        description: "Tool from B",
        inputSchema: { type: "object" }
      }
    ];

    const clientA = makeFakeClient(toolsA);
    const clientB = makeFakeClient(toolsB);

    const factory = vi.spyOn(McpClientFactory, "create");
    // Return clientA for configA, clientB for configB
    factory.mockImplementation((cfg) => {
      if (cfg.id === "server-a") {
        return clientA as ReturnType<typeof McpClientFactory.create>;
      }
      return clientB as ReturnType<typeof McpClientFactory.create>;
    });

    const broker = new ToolBroker();

    // Connect both servers in parallel
    await Promise.all([broker.connectMcpServer(configA), broker.connectMcpServer(configB)]);

    const catalogNames = broker.listCatalog().map((d) => d.name);

    // All tools from both servers must be present
    expect(catalogNames).toContain("a.tool1");
    expect(catalogNames).toContain("a.tool2");
    expect(catalogNames).toContain("b.tool1");

    // Total should be exactly 3
    expect(catalogNames).toHaveLength(3);

    // Both servers must appear as connected
    const servers = broker.listConnectedServers();
    expect(servers).toHaveLength(2);
    expect(servers.map((s) => s.id)).toEqual(expect.arrayContaining(["server-a", "server-b"]));
  });

  it("policy enforcement works with rapid concurrent requests", async () => {
    // Register a sensitive tool and fire many concurrent execute() calls,
    // some approved and some not. Policy must be enforced consistently under
    // concurrent load.
    const fakeClient = makeFakeClient([
      {
        name: "data.write",
        description: "Write data — sensitive",
        inputSchema: { type: "object" }
      }
    ]);
    vi.spyOn(McpClientFactory, "create").mockReturnValue(
      fakeClient as ReturnType<typeof McpClientFactory.create>
    );

    const broker = new ToolBroker();
    await broker.connectMcpServer(mcpConfig);

    // data.write matches the .write$ sensitive pattern — it will have requiresApproval: true
    const approvedRequests = Array.from({ length: 5 }, (_, i) =>
      broker.execute({
        runId: `run-approved-${i}`,
        roleId: "role-1",
        toolName: "data.write",
        input: { key: `value-${i}` },
        role: "admin",
        approvalMode: "approval",
        approved: true
      })
    );

    const rejectedRequests = Array.from({ length: 5 }, (_, i) =>
      broker
        .execute({
          runId: `run-rejected-${i}`,
          roleId: "role-1",
          toolName: "data.write",
          input: { key: `value-${i}` },
          role: "admin",
          approvalMode: "approval",
          approved: false
        })
        .catch((err: Error) => err)
    );

    const approvedResults = await Promise.all(approvedRequests);
    const rejectedResults = await Promise.all(rejectedRequests);

    // All approved calls must succeed
    for (const result of approvedResults) {
      expect(result).toHaveProperty("output");
    }

    // All unapproved calls must return Error instances (caught above)
    for (const result of rejectedResults) {
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toMatch(/requires approval/i);
    }
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  McpToolAdapter,
  createServerManager,
  createToolAdapter,
  type McpServerManager
} from "../src/mcp/index.js";

describe("MCP Integration", () => {
  let serverManager: McpServerManager;
  let toolAdapter: McpToolAdapter;

  beforeEach(() => {
    serverManager = createServerManager();
    toolAdapter = createToolAdapter();
  });

  afterEach(async () => {
    await serverManager.stop();
  });

  describe("McpServerManager", () => {
    it("should initialize successfully", () => {
      expect(serverManager).toBeDefined();
      expect(serverManager.listConnectedServers()).toHaveLength(0);
    });

    it("should track server status", () => {
      const statuses = serverManager.listStatuses();
      expect(Array.isArray(statuses)).toBe(true);
    });

    it("should handle disconnect of non-existent server", async () => {
      await expect(serverManager.disconnect("non-existent")).resolves.not.toThrow();
    });

    it("should get undefined for non-existent server", () => {
      const config = serverManager.getConfig("non-existent");
      expect(config).toBeUndefined();

      const client = serverManager.getClient("non-existent");
      expect(client).toBeUndefined();

      const status = serverManager.getStatus("non-existent");
      expect(status).toBeUndefined();
    });

    it("should track server tools", () => {
      const tools = serverManager.getServerTools("test-server");
      expect(tools).toBeInstanceOf(Set);
      expect(tools.size).toBe(0);
    });
  });

  describe("McpToolAdapter", () => {
    it("should initialize with default options", () => {
      expect(toolAdapter).toBeDefined();
    });

    it("should build tool descriptor correctly", () => {
      const descriptor = toolAdapter.buildDescriptor("test-server", {
        name: "test.tool",
        description: "A test tool",
        inputSchema: { type: "object" }
      });

      expect(descriptor.id).toBe("test-server:test.tool");
      expect(descriptor.serverId).toBe("test-server");
      expect(descriptor.name).toBe("test.tool");
      expect(descriptor.description).toBe("A test tool");
      expect(descriptor.sensitive).toBe(false);
    });

    it("should detect sensitive tools", () => {
      const sensitiveNames = [
        "file.write",
        "db.delete",
        "git.push",
        "system.execute",
        "data.drop",
        "record.remove",
        "table.truncate",
        "content.overwrite",
        "resource.destroy"
      ];

      for (const name of sensitiveNames) {
        const descriptor = toolAdapter.buildDescriptor("test", {
          name,
          description: "test",
          inputSchema: {}
        });
        expect(descriptor.sensitive).toBe(true);
      }
    });

    it("should generate policy for non-sensitive tool", () => {
      const descriptor = toolAdapter.buildDescriptor("test", {
        name: "read.data",
        description: "Read data",
        inputSchema: {}
      });

      const policy = toolAdapter.generatePolicy(descriptor);

      expect(policy.toolName).toBe("read.data");
      expect(policy.sensitive).toBe(false);
      expect(policy.requiresApproval).toBe(false);
      expect(policy.allowedRoles).toContain("viewer");
    });

    it("should generate policy for sensitive tool", () => {
      const descriptor = toolAdapter.buildDescriptor("test", {
        name: "data.delete",
        description: "Delete data",
        inputSchema: {}
      });

      const policy = toolAdapter.generatePolicy(descriptor);

      expect(policy.toolName).toBe("data.delete");
      expect(policy.sensitive).toBe(true);
      expect(policy.requiresApproval).toBe(true);
      expect(policy.allowedRoles).not.toContain("viewer");
      expect(policy.allowedRoles).toContain("admin");
    });

    it("should extract tool name from full identifier", () => {
      const toolName = McpToolAdapter.extractToolName("server:tool.name");
      expect(toolName).toBe("tool.name");

      const simpleToolName = McpToolAdapter.extractToolName("tool.name");
      expect(simpleToolName).toBe("tool.name");

      const nestedToolName = McpToolAdapter.extractToolName("server:sub:tool");
      expect(nestedToolName).toBe("sub:tool");
    });

    it("should extract server ID from full identifier", () => {
      const serverId = McpToolAdapter.extractServerId("server:tool.name");
      expect(serverId).toBe("server");

      const noServerId = McpToolAdapter.extractServerId("tool.name");
      expect(noServerId).toBeNull();
    });

    it("should build full identifier", () => {
      const fullId = McpToolAdapter.buildFullIdentifier("server", "tool.name");
      expect(fullId).toBe("server:tool.name");
    });

    it("should validate input against schema", () => {
      const schema = {
        type: "object",
        required: ["name", "age"],
        properties: {
          name: { type: "string" },
          age: { type: "number" }
        }
      };

      const validInput = { name: "John", age: 30 };
      const validResult = toolAdapter.validateInput(validInput, schema);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidInput = { name: "John" };
      const invalidResult = toolAdapter.validateInput(invalidInput, schema);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);

      const wrongTypeInput = { name: "John", age: "thirty" };
      const wrongTypeResult = toolAdapter.validateInput(wrongTypeInput, schema);
      expect(wrongTypeResult.valid).toBe(false);
    });

    it("should build descriptors for multiple tools", () => {
      const toolDefs = [
        {
          name: "tool.one",
          description: "First tool",
          inputSchema: {}
        },
        {
          name: "tool.two",
          description: "Second tool",
          inputSchema: {}
        }
      ];

      const descriptors = toolAdapter.buildDescriptors("test-server", toolDefs);

      expect(descriptors).toHaveLength(2);
      expect(descriptors[0]?.name).toBe("tool.one");
      expect(descriptors[1]?.name).toBe("tool.two");
    });

    it("should generate policies for multiple tools", () => {
      const descriptors = [
        toolAdapter.buildDescriptor("test", {
          name: "read.data",
          description: "Read",
          inputSchema: {}
        }),
        toolAdapter.buildDescriptor("test", {
          name: "data.delete",
          description: "Delete",
          inputSchema: {}
        })
      ];

      const policies = toolAdapter.generatePolicies(descriptors);

      expect(policies).toHaveLength(2);
      expect(policies[0]?.sensitive).toBe(false);
      expect(policies[1]?.sensitive).toBe(true);
    });
  });

  describe("MCP Server Lifecycle", () => {
    it("should handle start and stop gracefully", async () => {
      const manager = createServerManager();
      await expect(manager.stop()).resolves.not.toThrow();
    });
  });
});

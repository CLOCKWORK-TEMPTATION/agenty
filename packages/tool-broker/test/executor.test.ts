import { describe, it, expect, beforeEach } from "vitest";
import { createToolExecutor, type ToolExecutor, type BrokerTool } from "../src/executor.js";
import type { McpToolDescriptor } from "@repo/types";

describe("ToolExecutor", () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    executor = createToolExecutor();
  });

  describe("Tool Registration", () => {
    it("should register a tool successfully", () => {
      const tool: BrokerTool = {
        descriptor: createTestDescriptor("test.tool"),
        source: "mcp",
        execute: async (input) => ({ success: true, input })
      };

      executor.registerTool(tool);
      const tools = executor.listTools();

      expect(tools).toHaveLength(1);
      expect(tools[0]?.descriptor.name).toBe("test.tool");
    });

    it("should prioritize MCP tools over provider-native tools", () => {
      const mcpTool: BrokerTool = {
        descriptor: createTestDescriptor("shared.tool"),
        source: "mcp",
        execute: async () => ({ source: "mcp" })
      };

      const nativeTool: BrokerTool = {
        descriptor: createTestDescriptor("shared.tool"),
        source: "provider-native",
        execute: async () => ({ source: "native" })
      };

      executor.registerTool(nativeTool);
      executor.registerTool(mcpTool);

      const tool = executor.getTool("shared.tool");
      expect(tool?.source).toBe("mcp");
    });

    it("should not replace MCP tool with provider-native tool", () => {
      const mcpTool: BrokerTool = {
        descriptor: createTestDescriptor("test.tool"),
        source: "mcp",
        execute: async () => ({ source: "mcp" })
      };

      const nativeTool: BrokerTool = {
        descriptor: createTestDescriptor("test.tool"),
        source: "provider-native",
        execute: async () => ({ source: "native" })
      };

      executor.registerTool(mcpTool);
      executor.registerTool(nativeTool);

      const tool = executor.getTool("test.tool");
      expect(tool?.source).toBe("mcp");
    });
  });

  describe("Tool Execution", () => {
    it("should execute a tool successfully", async () => {
      const tool: BrokerTool = {
        descriptor: createTestDescriptor("test.execute"),
        source: "mcp",
        execute: async (input) => ({ result: "success", input })
      };

      executor.registerTool(tool);
      executor.registerPolicy({
        toolName: "test.execute",
        sensitive: false,
        requiresApproval: false,
        allowedRoles: ["owner", "admin", "operator", "viewer"]
      });

      const result = await executor.execute({
        runId: "run-1",
        roleId: "role-1",
        toolName: "test.execute",
        input: { param: "value" },
        role: "operator",
        approvalMode: "auto",
        approved: false
      });

      expect(result.output).toEqual({ result: "success", input: { param: "value" } });
      expect(result.trace.status).toBe("completed");
      expect(result.trace.runId).toBe("run-1");
    });

    it("should throw error for unknown tool", async () => {
      await expect(
        executor.execute({
          runId: "run-1",
          roleId: "role-1",
          toolName: "unknown.tool",
          input: {},
          role: "owner",
          approvalMode: "auto",
          approved: false
        })
      ).rejects.toThrow("Tool not found");
    });

    it("should enforce RBAC permissions", async () => {
      const tool: BrokerTool = {
        descriptor: createTestDescriptor("admin.tool"),
        source: "mcp",
        execute: async () => ({ result: "ok" })
      };

      executor.registerTool(tool);
      executor.registerPolicy({
        toolName: "admin.tool",
        sensitive: true,
        requiresApproval: true,
        allowedRoles: ["owner", "admin"]
      });

      await expect(
        executor.execute({
          runId: "run-1",
          roleId: "role-1",
          toolName: "admin.tool",
          input: {},
          role: "viewer",
          approvalMode: "auto",
          approved: false
        })
      ).rejects.toThrow("not allowed to execute");
    });

    it("should require approval for sensitive tools", async () => {
      const tool: BrokerTool = {
        descriptor: createTestDescriptor("sensitive.tool"),
        source: "mcp",
        execute: async () => ({ result: "ok" })
      };

      executor.registerTool(tool);
      executor.registerPolicy({
        toolName: "sensitive.tool",
        sensitive: true,
        requiresApproval: true,
        allowedRoles: ["owner", "admin"]
      });

      await expect(
        executor.execute({
          runId: "run-1",
          roleId: "role-1",
          toolName: "sensitive.tool",
          input: {},
          role: "admin",
          approvalMode: "approval",
          approved: false
        })
      ).rejects.toThrow("requires approval");
    });

    it("should allow sensitive tool execution when approved", async () => {
      const tool: BrokerTool = {
        descriptor: createTestDescriptor("sensitive.tool"),
        source: "mcp",
        execute: async () => ({ result: "ok" })
      };

      executor.registerTool(tool);
      executor.registerPolicy({
        toolName: "sensitive.tool",
        sensitive: true,
        requiresApproval: true,
        allowedRoles: ["owner", "admin"]
      });

      const result = await executor.execute({
        runId: "run-1",
        roleId: "role-1",
        toolName: "sensitive.tool",
        input: {},
        role: "admin",
        approvalMode: "approval",
        approved: true
      });

      expect(result.output).toEqual({ result: "ok" });
      expect(result.trace.status).toBe("completed");
    });
  });

  describe("Execution Tracing", () => {
    beforeEach(() => {
      // Clear history for fresh test
      executor.clearExecutionHistory("run-1");
    });

    it("should record execution trace", async () => {
      const tool: BrokerTool = {
        descriptor: createTestDescriptor("test.trace"),
        source: "mcp",
        execute: async (input) => ({ input })
      };

      executor.registerTool(tool);
      executor.registerPolicy({
        toolName: "test.trace",
        sensitive: false,
        requiresApproval: false,
        allowedRoles: ["owner"]
      });

      const result = await executor.execute({
        runId: "run-1",
        roleId: "role-1",
        toolName: "test.trace",
        input: { test: "data" },
        role: "owner",
        approvalMode: "auto",
        approved: false
      });

      expect(result.trace.runId).toBe("run-1");
      expect(result.trace.roleId).toBe("role-1");
      expect(result.trace.toolName).toBe("test.trace");
      expect(result.trace.status).toBe("completed");
      expect(result.trace.startedAt).toBeDefined();
      expect(result.trace.endedAt).toBeDefined();
      expect(result.trace.metadata?.source).toBe("mcp");
    });

    it("should record failed execution in trace", async () => {
      const tool: BrokerTool = {
        descriptor: createTestDescriptor("test.fail"),
        source: "mcp",
        execute: async () => {
          throw new Error("Tool execution failed");
        }
      };

      executor.registerTool(tool);
      executor.registerPolicy({
        toolName: "test.fail",
        sensitive: false,
        requiresApproval: false,
        allowedRoles: ["owner"]
      });

      await expect(
        executor.execute({
          runId: "run-1",
          roleId: "role-1",
          toolName: "test.fail",
          input: {},
          role: "owner",
          approvalMode: "auto",
          approved: false
        })
      ).rejects.toThrow();

      const history = executor.getExecutionHistory("run-1");
      // Should have 2 entries: one started, one failed (updated)
      expect(history.length).toBeGreaterThanOrEqual(1);
      const lastEntry = history[history.length - 1];
      expect(lastEntry?.status).toBe("failed");
      expect(lastEntry?.metadata?.error).toContain("Tool execution failed");
    });

    it("should track execution history", async () => {
      const tool: BrokerTool = {
        descriptor: createTestDescriptor("test.history"),
        source: "mcp",
        execute: async () => ({ result: "ok" })
      };

      executor.registerTool(tool);
      executor.registerPolicy({
        toolName: "test.history",
        sensitive: false,
        requiresApproval: false,
        allowedRoles: ["owner"]
      });

      await executor.execute({
        runId: "run-1",
        roleId: "role-1",
        toolName: "test.history",
        input: {},
        role: "owner",
        approvalMode: "auto",
        approved: false
      });

      await executor.execute({
        runId: "run-1",
        roleId: "role-2",
        toolName: "test.history",
        input: {},
        role: "owner",
        approvalMode: "auto",
        approved: false
      });

      const history = executor.getExecutionHistory("run-1");
      // Each execution creates 2 trace entries (start + complete)
      expect(history.length).toBeGreaterThanOrEqual(2);

      // Check that we have entries for both role IDs
      const role1Entries = history.filter(h => h.roleId === "role-1");
      const role2Entries = history.filter(h => h.roleId === "role-2");
      expect(role1Entries.length).toBeGreaterThan(0);
      expect(role2Entries.length).toBeGreaterThan(0);
    });
  });

  describe("Retry Logic", () => {
    it("should retry on retryable errors", async () => {
      let attempts = 0;
      const tool: BrokerTool = {
        descriptor: createTestDescriptor("test.retry"),
        source: "mcp",
        execute: async () => {
          attempts += 1;
          if (attempts < 3) {
            throw new Error("Temporary failure");
          }
          return { result: "success" };
        }
      };

      executor.registerTool(tool);
      executor.registerPolicy({
        toolName: "test.retry",
        sensitive: false,
        requiresApproval: false,
        allowedRoles: ["owner"]
      });

      const result = await executor.execute({
        runId: "run-1",
        roleId: "role-1",
        toolName: "test.retry",
        input: {},
        role: "owner",
        approvalMode: "auto",
        approved: false
      });

      expect(result.output).toEqual({ result: "success" });
      expect(attempts).toBe(3);
    });
  });
});

// Helper function
function createTestDescriptor(name: string): McpToolDescriptor {
  return {
    id: `test:${name}`,
    serverId: "test",
    name,
    description: `Test tool: ${name}`,
    inputSchema: {
      type: "object",
      properties: {}
    },
    sensitive: false
  };
}

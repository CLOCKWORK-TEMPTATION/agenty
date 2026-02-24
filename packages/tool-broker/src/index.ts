import type { McpServerConfig, McpToolDescriptor, RbacRole, ToolExecutionTrace, ToolPolicy } from "@repo/types";
import { McpClientFactory } from "./mcp-client.js";
import type { McpClient, McpToolDef } from "./mcp-client.js";

export type ToolSource = "mcp" | "provider-native" | "local-sandbox";

export interface BrokerTool {
  descriptor: McpToolDescriptor;
  source: ToolSource;
  execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface ToolExecutionRequest {
  runId: string;
  roleId: string;
  toolName: string;
  input: Record<string, unknown>;
  role: RbacRole;
  approvalMode: "approval" | "auto";
  approved: boolean;
}

export interface ToolExecutionResult {
  output: Record<string, unknown>;
  trace: ToolExecutionTrace;
}

export interface McpConnectResult {
  tools: McpToolDescriptor[];
}

export interface McpTestResult {
  reachable: boolean;
  latencyMs: number;
  toolCount: number;
}

// ---------------------------------------------------------------------------
// Sensitivity policy
// Patterns that identify destructive / sensitive tool names.
// Any tool whose name matches one of these glob-style patterns is sensitive.
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\.write$/i,
  /\.delete$/i,
  /\.push$/i,
  /\.remove$/i,
  /\.drop$/i,
  /\.truncate$/i,
  /^db\..+_destructive$/i,
  /\.overwrite$/i,
  /\.destroy$/i
];

function isToolSensitive(toolName: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(toolName));
}

function buildToolDescriptor(
  serverId: string,
  toolDef: McpToolDef
): McpToolDescriptor {
  return {
    id: `${serverId}:${toolDef.name}`,
    serverId,
    name: toolDef.name,
    description: toolDef.description,
    inputSchema: toolDef.inputSchema,
    sensitive: isToolSensitive(toolDef.name)
  };
}

// ---------------------------------------------------------------------------
// ToolBroker
// ---------------------------------------------------------------------------

export class ToolBroker {
  private readonly tools = new Map<string, BrokerTool>();
  private readonly policies = new Map<string, ToolPolicy>();

  // MCP lifecycle tracking
  private readonly mcpClients = new Map<string, McpClient>();
  private readonly mcpConfigs = new Map<string, McpServerConfig>();
  // serverId -> set of tool names registered from that server
  private readonly mcpServerTools = new Map<string, Set<string>>();

  public registerTool(tool: BrokerTool): void {
    this.tools.set(tool.descriptor.name, tool);
  }

  public registerPolicy(policy: ToolPolicy): void {
    this.policies.set(policy.toolName, policy);
  }

  public listTools(): BrokerTool[] {
    return Array.from(this.tools.values()).sort((a, b) => {
      const rank = (source: ToolSource): number => {
        if (source === "mcp") {
          return 0;
        }
        if (source === "provider-native") {
          return 1;
        }
        return 2;
      };
      return rank(a.source) - rank(b.source);
    });
  }

  public listCatalog(): McpToolDescriptor[] {
    return this.listTools().map((tool) => tool.descriptor);
  }

  public listConnectedServers(): McpServerConfig[] {
    return Array.from(this.mcpConfigs.values());
  }

  public async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const tool = this.tools.get(request.toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${request.toolName}`);
    }

    const policy = this.policies.get(request.toolName);
    if (policy) {
      if (!policy.allowedRoles.includes(request.role)) {
        throw new Error(`Role ${request.role} is not allowed to execute ${request.toolName}`);
      }
      if (policy.requiresApproval && request.approvalMode === "approval" && !request.approved) {
        throw new Error(`Tool ${request.toolName} requires approval`);
      }
    }

    const startedAt = new Date().toISOString();
    const output = await tool.execute(request.input);
    const endedAt = new Date().toISOString();

    return {
      output,
      trace: {
        runId: request.runId,
        roleId: request.roleId,
        toolName: request.toolName,
        status: "completed",
        startedAt,
        endedAt,
        metadata: {
          source: tool.source
        }
      }
    };
  }

  // ---------------------------------------------------------------------------
  // MCP server lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Connects to an MCP server, discovers its tools, and registers them with
   * source "mcp". Each tool's execute function delegates to the live MCP client.
   */
  public async connectMcpServer(config: McpServerConfig): Promise<McpConnectResult> {
    // Disconnect any existing connection for this server id
    if (this.mcpClients.has(config.id)) {
      await this.disconnectMcpServer(config.id);
    }

    const client = McpClientFactory.create(config);
    await client.connect();

    const toolDefs = await client.listTools();

    this.mcpClients.set(config.id, client);
    this.mcpConfigs.set(config.id, config);

    const registeredNames = new Set<string>();
    const descriptors: McpToolDescriptor[] = [];

    for (const toolDef of toolDefs) {
      const descriptor = buildToolDescriptor(config.id, toolDef);
      const sensitive = descriptor.sensitive;

      // Capture variables for the closure
      const capturedClient = client;
      const capturedName = toolDef.name;

      const brokerTool: BrokerTool = {
        descriptor,
        source: "mcp",
        execute: async (input: Record<string, unknown>) => {
          return capturedClient.callTool(capturedName, input);
        }
      };

      this.tools.set(descriptor.name, brokerTool);

      // Register a default policy for this tool
      this.policies.set(descriptor.name, {
        toolName: descriptor.name,
        sensitive,
        requiresApproval: sensitive,
        allowedRoles: sensitive
          ? ["owner", "admin"]
          : ["owner", "admin", "operator", "viewer"]
      });

      registeredNames.add(descriptor.name);
      descriptors.push(descriptor);
    }

    this.mcpServerTools.set(config.id, registeredNames);

    return { tools: descriptors };
  }

  /**
   * Disconnects from an MCP server and removes all tools registered from it.
   */
  public async disconnectMcpServer(serverId: string): Promise<void> {
    const client = this.mcpClients.get(serverId);
    if (client) {
      client.disconnect();
      this.mcpClients.delete(serverId);
    }

    const toolNames = this.mcpServerTools.get(serverId);
    if (toolNames) {
      for (const name of toolNames) {
        this.tools.delete(name);
        this.policies.delete(name);
      }
      this.mcpServerTools.delete(serverId);
    }

    this.mcpConfigs.delete(serverId);
  }

  /**
   * Tests connectivity to an MCP server without persisting the connection.
   * Returns reachability, round-trip latency, and number of advertised tools.
   */
  public async testMcpServer(config: McpServerConfig): Promise<McpTestResult> {
    const start = Date.now();
    let reachable = false;
    let toolCount = 0;

    const client = McpClientFactory.create(config);
    try {
      await client.connect();
      const tools = await client.listTools();
      toolCount = tools.length;
      reachable = true;
    } catch {
      // reachable stays false
    } finally {
      client.disconnect();
    }

    const latencyMs = Date.now() - start;
    return { reachable, latencyMs, toolCount };
  }
}

// ---------------------------------------------------------------------------
// Default factory
// ---------------------------------------------------------------------------

export const createDefaultToolBroker = (): ToolBroker => {
  const broker = new ToolBroker();

  broker.registerTool({
    source: "mcp",
    descriptor: {
      id: "mcp-filesystem-read",
      serverId: "filesystem",
      name: "filesystem.read",
      description: "Read file content",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" }
        }
      },
      sensitive: false
    },
    execute: async (input) => {
      return {
        status: "ok",
        received: input
      };
    }
  });

  broker.registerPolicy({
    toolName: "filesystem.read",
    sensitive: false,
    requiresApproval: false,
    allowedRoles: ["owner", "admin", "operator", "viewer"]
  });

  broker.registerTool({
    source: "local-sandbox",
    descriptor: {
      id: "local-git-push",
      serverId: "local",
      name: "git.push",
      description: "Push git changes to remote",
      inputSchema: {
        type: "object",
        properties: {
          branch: { type: "string" }
        }
      },
      sensitive: true
    },
    execute: async (input) => ({
      status: "queued",
      received: input
    })
  });

  broker.registerPolicy({
    toolName: "git.push",
    sensitive: true,
    requiresApproval: true,
    allowedRoles: ["owner", "admin"]
  });

  return broker;
};

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

// MCP client types
export type { McpClient, McpToolDef } from "./mcp-client.js";
export { McpStdioClient, McpHttpClient, McpClientFactory } from "./mcp-client.js";

// ToolExecutor
export {
  ToolExecutor,
  createToolExecutor,
  type BrokerTool as ExecutorBrokerTool,
  type ToolPolicy as ExecutorToolPolicy
} from "./executor.js";

// MCP server management
export {
  McpServerManager,
  createServerManager,
  type ServerStatus,
  type ServerHealthCheck
} from "./mcp/index.js";

// MCP tool adapter
export {
  McpToolAdapter,
  createToolAdapter,
  type ToolAdapterOptions
} from "./mcp/index.js";

// MCP stdio client
export {
  StdioClient,
  createStdioClient,
  type StdioClientConfig,
  type StdioMessage,
  type MessageHandler,
  type ErrorHandler,
  type ExitHandler
} from "./mcp/index.js";

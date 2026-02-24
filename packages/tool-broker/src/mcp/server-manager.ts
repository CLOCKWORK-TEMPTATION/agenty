import type { McpServerConfig, McpToolDescriptor } from "@repo/types";
import { AppError } from "@repo/types";
import type { McpClient, McpToolDef } from "../mcp-client.js";
import { McpClientFactory } from "../mcp-client.js";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ServerStatus {
  serverId: string;
  status: "connected" | "disconnected" | "error";
  lastConnectedAt?: string;
  lastError?: string;
  toolCount: number;
}

export interface ServerHealthCheck {
  serverId: string;
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// McpServerManager
// ---------------------------------------------------------------------------

/**
 * McpServerManager handles lifecycle management of MCP servers:
 * - Connection/disconnection
 * - Health monitoring
 * - Reconnection logic
 * - Resource cleanup
 */
export class McpServerManager {
  private readonly clients = new Map<string, McpClient>();
  private readonly configs = new Map<string, McpServerConfig>();
  private readonly status = new Map<string, ServerStatus>();

  // Tools registered per server (serverId -> Set<toolName>)
  private readonly serverTools = new Map<string, Set<string>>();

  // Reconnection tracking
  private readonly reconnectTimers = new Map<string, NodeJS.Timeout>();
  private readonly maxReconnectAttempts = 5;
  private readonly baseReconnectDelayMs = 2000;

  // Health check interval
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly healthCheckIntervalMs = 60000; // 1 minute

  /**
   * Start the server manager with automatic health checks
   */
  public start(): void {
    if (this.healthCheckInterval) {
      return; // Already started
    }

    this.healthCheckInterval = setInterval(() => {
      void this.runHealthChecks();
    }, this.healthCheckIntervalMs);
  }

  /**
   * Stop the server manager and cleanup all resources
   */
  public async stop(): Promise<void> {
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clear all reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    // Disconnect all servers
    const disconnectPromises: Promise<void>[] = [];
    for (const serverId of this.clients.keys()) {
      disconnectPromises.push(this.disconnect(serverId));
    }
    await Promise.all(disconnectPromises);
  }

  /**
   * Connect to an MCP server
   */
  public async connect(config: McpServerConfig): Promise<McpToolDescriptor[]> {
    const traceId = randomUUID();

    // Disconnect existing connection if any
    if (this.clients.has(config.id)) {
      await this.disconnect(config.id);
    }

    // Create client
    const client = McpClientFactory.create(config);

    try {
      // Connect to server
      await client.connect();

      // List available tools
      const toolDefs = await client.listTools();

      // Store client and config
      this.clients.set(config.id, client);
      this.configs.set(config.id, config);

      // Update status
      this.status.set(config.id, {
        serverId: config.id,
        status: "connected",
        lastConnectedAt: new Date().toISOString(),
        toolCount: toolDefs.length
      });

      // Convert to descriptors
      const descriptors = toolDefs.map((toolDef) =>
        this.buildToolDescriptor(config.id, toolDef)
      );

      // Track registered tools
      const toolNames = new Set(descriptors.map((d) => d.name));
      this.serverTools.set(config.id, toolNames);

      return descriptors;
    } catch (error) {
      // Update status on error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStatus: ServerStatus = {
        serverId: config.id,
        status: "error",
        lastError: errorMessage,
        toolCount: 0
      };
      this.status.set(config.id, errorStatus);

      // Cleanup
      client.disconnect();

      throw new AppError({
        message: `Failed to connect to MCP server ${config.name}: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: "MCP_CONNECTION_FAILED",
        retryable: true,
        traceId,
        statusCode: 503,
        details: {
          serverId: config.id,
          serverName: config.name,
          transport: config.transport,
          originalError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Disconnect from an MCP server
   */
  public async disconnect(serverId: string): Promise<void> {
    // Clear reconnect timer if exists
    const timer = this.reconnectTimers.get(serverId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(serverId);
    }

    // Disconnect client
    const client = this.clients.get(serverId);
    if (client) {
      client.disconnect();
      this.clients.delete(serverId);
    }

    // Update status
    this.status.set(serverId, {
      serverId,
      status: "disconnected",
      toolCount: 0
    });

    // Clear tracked tools
    this.serverTools.delete(serverId);
    this.configs.delete(serverId);
  }

  /**
   * Get client for a server
   */
  public getClient(serverId: string): McpClient | undefined {
    return this.clients.get(serverId);
  }

  /**
   * Get config for a server
   */
  public getConfig(serverId: string): McpServerConfig | undefined {
    return this.configs.get(serverId);
  }

  /**
   * Get status for a server
   */
  public getStatus(serverId: string): ServerStatus | undefined {
    return this.status.get(serverId);
  }

  /**
   * List all connected servers
   */
  public listConnectedServers(): McpServerConfig[] {
    return Array.from(this.configs.values()).filter((config) => {
      const status = this.status.get(config.id);
      return status?.status === "connected";
    });
  }

  /**
   * List all server statuses
   */
  public listStatuses(): ServerStatus[] {
    return Array.from(this.status.values());
  }

  /**
   * Get tools registered for a server
   */
  public getServerTools(serverId: string): Set<string> {
    return this.serverTools.get(serverId) ?? new Set();
  }

  /**
   * Check health of a specific server
   */
  public async checkHealth(serverId: string): Promise<ServerHealthCheck> {
    const client = this.clients.get(serverId);
    if (!client) {
      return {
        serverId,
        healthy: false,
        latencyMs: 0,
        error: "Server not connected"
      };
    }

    const start = Date.now();
    try {
      // Try to list tools as health check
      await client.listTools();
      const latencyMs = Date.now() - start;

      return {
        serverId,
        healthy: true,
        latencyMs
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      return {
        serverId,
        healthy: false,
        latencyMs,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Reconnect to a server with exponential backoff
   */
  public async reconnect(serverId: string, attempt = 1): Promise<void> {
    const config = this.configs.get(serverId);
    if (!config || !config.enabled) {
      return;
    }

    if (attempt > this.maxReconnectAttempts) {
      const errorStatus: ServerStatus = {
        serverId,
        status: "error",
        lastError: `Max reconnect attempts (${this.maxReconnectAttempts}) reached`,
        toolCount: 0
      };
      this.status.set(serverId, errorStatus);
      return;
    }

    try {
      await this.connect(config);
    } catch {
      // Calculate backoff delay
      const delay = this.baseReconnectDelayMs * Math.pow(2, attempt - 1);

      // Schedule next reconnect attempt
      const timer = setTimeout(() => {
        void this.reconnect(serverId, attempt + 1);
      }, delay);

      this.reconnectTimers.set(serverId, timer);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Run health checks on all connected servers
   */
  private async runHealthChecks(): Promise<void> {
    const serverIds = Array.from(this.clients.keys());

    for (const serverId of serverIds) {
      const health = await this.checkHealth(serverId);

      if (!health.healthy) {
        // Update status
        const errorStatus: ServerStatus = {
          serverId,
          status: "error",
          toolCount: 0
        };
        if (health.error !== undefined) {
          errorStatus.lastError = health.error;
        }
        this.status.set(serverId, errorStatus);

        // Attempt reconnect
        void this.reconnect(serverId);
      } else {
        // Update status with fresh tool count
        const currentStatus = this.status.get(serverId);
        if (currentStatus) {
          this.status.set(serverId, {
            ...currentStatus,
            status: "connected",
            lastConnectedAt: new Date().toISOString()
          });
        }
      }
    }
  }

  /**
   * Build tool descriptor from MCP tool definition
   */
  private buildToolDescriptor(
    serverId: string,
    toolDef: McpToolDef
  ): McpToolDescriptor {
    return {
      id: `${serverId}:${toolDef.name}`,
      serverId,
      name: toolDef.name,
      description: toolDef.description,
      inputSchema: toolDef.inputSchema,
      sensitive: this.isToolSensitive(toolDef.name)
    };
  }

  /**
   * Check if a tool name indicates sensitivity
   */
  private isToolSensitive(toolName: string): boolean {
    const sensitivePatterns: RegExp[] = [
      /\.write$/i,
      /\.delete$/i,
      /\.push$/i,
      /\.remove$/i,
      /\.drop$/i,
      /\.truncate$/i,
      /^db\..+_destructive$/i,
      /\.overwrite$/i,
      /\.destroy$/i,
      /\.execute$/i,
      /\.run$/i
    ];

    return sensitivePatterns.some((pattern) => pattern.test(toolName));
  }
}

/**
 * Create a default server manager
 */
export function createServerManager(): McpServerManager {
  const manager = new McpServerManager();
  manager.start();
  return manager;
}

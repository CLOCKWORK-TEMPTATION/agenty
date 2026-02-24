import type { McpToolDescriptor, RbacRole } from "@repo/types";
import type { McpClient, McpToolDef } from "../mcp-client.js";
import type { BrokerTool, ToolPolicy, ToolSource } from "../executor.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolAdapterOptions {
  defaultSource?: ToolSource;
  defaultSensitiveRoles?: RbacRole[];
  defaultNonSensitiveRoles?: RbacRole[];
}

// ---------------------------------------------------------------------------
// McpToolAdapter
// ---------------------------------------------------------------------------

/**
 * McpToolAdapter converts MCP tools to the unified BrokerTool format.
 * Handles:
 * - Tool descriptor transformation
 * - Execution delegation to MCP client
 * - Policy generation
 * - Error normalization
 */
export class McpToolAdapter {
  private readonly options: Required<ToolAdapterOptions>;

  public constructor(options: ToolAdapterOptions = {}) {
    this.options = {
      defaultSource: options.defaultSource ?? "mcp",
      defaultSensitiveRoles: options.defaultSensitiveRoles ?? ["owner", "admin"],
      defaultNonSensitiveRoles: options.defaultNonSensitiveRoles ?? [
        "owner",
        "admin",
        "operator",
        "viewer"
      ]
    };
  }

  /**
   * Convert MCP tool definition to BrokerTool
   */
  public adaptTool(
    serverId: string,
    toolDef: McpToolDef,
    client: McpClient
  ): BrokerTool {
    const descriptor = this.buildDescriptor(serverId, toolDef);

    return {
      descriptor,
      source: this.options.defaultSource,
      execute: async (input: Record<string, unknown>) => {
        return this.executeToolCall(client, toolDef.name, input);
      }
    };
  }

  /**
   * Convert multiple MCP tools to BrokerTools
   */
  public adaptTools(
    serverId: string,
    toolDefs: McpToolDef[],
    client: McpClient
  ): BrokerTool[] {
    return toolDefs.map((toolDef) => this.adaptTool(serverId, toolDef, client));
  }

  /**
   * Generate policy for a tool
   */
  public generatePolicy(descriptor: McpToolDescriptor): ToolPolicy {
    return {
      toolName: descriptor.name,
      sensitive: descriptor.sensitive,
      requiresApproval: descriptor.sensitive,
      allowedRoles: descriptor.sensitive
        ? this.options.defaultSensitiveRoles
        : this.options.defaultNonSensitiveRoles
    };
  }

  /**
   * Generate policies for multiple tools
   */
  public generatePolicies(descriptors: McpToolDescriptor[]): ToolPolicy[] {
    return descriptors.map((descriptor) => this.generatePolicy(descriptor));
  }

  /**
   * Build tool descriptor from MCP tool definition
   */
  public buildDescriptor(
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
   * Build descriptors for multiple tools
   */
  public buildDescriptors(
    serverId: string,
    toolDefs: McpToolDef[]
  ): McpToolDescriptor[] {
    return toolDefs.map((toolDef) => this.buildDescriptor(serverId, toolDef));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Execute tool call through MCP client with error normalization
   */
  private async executeToolCall(
    client: McpClient,
    toolName: string,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      return await client.callTool(toolName, input);
    } catch (error) {
      // Normalize MCP errors to standard format
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if it's a known MCP error pattern
      if (errorMessage.includes("MCP tool error")) {
        // Already properly formatted
        throw error;
      }

      if (errorMessage.includes("timeout")) {
        const timeoutError = new Error(`Tool ${toolName} timed out: ${errorMessage}`);
        throw Object.assign(timeoutError, { cause: error });
      }

      if (errorMessage.includes("not connected")) {
        const disconnectError = new Error(
          `Tool ${toolName} unavailable - MCP server disconnected: ${errorMessage}`
        );
        throw Object.assign(disconnectError, { cause: error });
      }

      // Generic error
      const genericError = new Error(`Tool ${toolName} execution failed: ${errorMessage}`);
      throw Object.assign(genericError, { cause: error });
    }
  }

  /**
   * Check if tool name indicates sensitivity
   */
  private isToolSensitive(toolName: string): boolean {
    const sensitivePatterns: RegExp[] = [
      // Destructive operations
      /\.write$/i,
      /\.delete$/i,
      /\.push$/i,
      /\.remove$/i,
      /\.drop$/i,
      /\.truncate$/i,
      /\.overwrite$/i,
      /\.destroy$/i,

      // Database operations
      /^db\..+_destructive$/i,
      /^db\.drop/i,
      /^db\.delete/i,

      // System operations
      /\.execute$/i,
      /\.run$/i,
      /\.eval$/i,
      /\.exec$/i,

      // File operations
      /^file\.write/i,
      /^file\.delete/i,
      /^file\.move/i,
      /^fs\.write/i,
      /^fs\.delete/i,
      /^fs\.rm/i,

      // Network operations
      /\.deploy$/i,
      /\.publish$/i,
      /\.send$/i,

      // Git operations
      /^git\.push/i,
      /^git\.force/i,
      /^git\.delete/i,

      // Cloud operations
      /\.provision$/i,
      /\.terminate$/i,
      /\.shutdown$/i
    ];

    return sensitivePatterns.some((pattern) => pattern.test(toolName));
  }

  /**
   * Extract tool name from full MCP tool identifier
   */
  public static extractToolName(fullIdentifier: string): string {
    // Handle format: "serverId:toolName" -> "toolName"
    const parts = fullIdentifier.split(":");
    return parts.length > 1 ? parts.slice(1).join(":") : fullIdentifier;
  }

  /**
   * Extract server ID from full MCP tool identifier
   */
  public static extractServerId(fullIdentifier: string): string | null {
    // Handle format: "serverId:toolName" -> "serverId"
    const parts = fullIdentifier.split(":");
    const serverId = parts.length > 1 ? parts[0] : undefined;
    return serverId ?? null;
  }

  /**
   * Build full tool identifier from server ID and tool name
   */
  public static buildFullIdentifier(serverId: string, toolName: string): string {
    return `${serverId}:${toolName}`;
  }

  /**
   * Validate input against JSON schema
   */
  public validateInput(
    input: Record<string, unknown>,
    schema: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    // Basic validation - in production, use a proper JSON schema validator
    const errors: string[] = [];

    // Check required properties
    if (schema.type === "object" && schema.required) {
      const required = schema.required as string[];
      for (const key of required) {
        if (!(key in input)) {
          errors.push(`Missing required property: ${key}`);
        }
      }
    }

    // Check property types (basic)
    if (schema.type === "object" && schema.properties) {
      const properties = schema.properties as Record<
        string,
        { type?: string; [key: string]: unknown }
      >;
      for (const [key, value] of Object.entries(input)) {
        const propSchema = properties[key];
        if (propSchema && propSchema.type) {
          const actualType = typeof value;
          const expectedType = propSchema.type;

          if (expectedType === "integer" || expectedType === "number") {
            if (typeof value !== "number") {
              errors.push(
                `Property ${key} should be ${expectedType}, got ${actualType}`
              );
            }
          } else if (expectedType !== actualType) {
            errors.push(
              `Property ${key} should be ${expectedType}, got ${actualType}`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Create a default tool adapter
 */
export function createToolAdapter(options?: ToolAdapterOptions): McpToolAdapter {
  return new McpToolAdapter(options);
}

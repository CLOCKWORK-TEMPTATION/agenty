import type {
  McpToolDescriptor,
  RbacRole,
  ToolExecutionTrace
} from "@repo/types";
import { AppError } from "@repo/types";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolSource = "mcp" | "provider-native" | "local-sandbox";

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

export interface BrokerTool {
  descriptor: McpToolDescriptor;
  source: ToolSource;
  execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface ToolPolicy {
  toolName: string;
  sensitive: boolean;
  requiresApproval: boolean;
  allowedRoles: RbacRole[];
}

// ---------------------------------------------------------------------------
// ToolExecutor
// ---------------------------------------------------------------------------

/**
 * ToolExecutor handles the execution of tools with:
 * - MCP tools priority over provider-native tools
 * - Sensitive tools approval requirements
 * - Full execution tracing
 * - RBAC enforcement
 * - Retry logic with exponential backoff
 */
export class ToolExecutor {
  private readonly tools = new Map<string, BrokerTool>();
  private readonly policies = new Map<string, ToolPolicy>();
  private readonly executionHistory = new Map<string, ToolExecutionTrace[]>();

  // Retry configuration
  private readonly maxRetries = 3;
  private readonly baseRetryDelayMs = 1000;
  private readonly maxRetryDelayMs = 10000;

  /**
   * Register a tool with the executor
   */
  public registerTool(tool: BrokerTool): void {
    // MCP tools take priority - if exists and new tool is MCP, replace
    const existing = this.tools.get(tool.descriptor.name);
    if (existing && existing.source === "mcp" && tool.source !== "mcp") {
      // Don't replace MCP tool with non-MCP tool
      return;
    }
    this.tools.set(tool.descriptor.name, tool);
  }

  /**
   * Register a policy for a tool
   */
  public registerPolicy(policy: ToolPolicy): void {
    this.policies.set(policy.toolName, policy);
  }

  /**
   * Unregister a tool
   */
  public unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
    this.policies.delete(toolName);
  }

  /**
   * List all registered tools, prioritized by source (MCP first)
   */
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

  /**
   * Get a specific tool by name
   */
  public getTool(toolName: string): BrokerTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Execute a tool with full validation, tracing, and retry logic
   */
  public async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const traceId = randomUUID();
    const startedAt = new Date().toISOString();

    // Validate tool exists
    const tool = this.tools.get(request.toolName);
    if (!tool) {
      throw new AppError({
        message: `Tool not found: ${request.toolName}`,
        errorCode: "TOOL_NOT_FOUND",
        retryable: false,
        traceId,
        statusCode: 404,
        details: { toolName: request.toolName }
      });
    }

    // Validate RBAC
    const policy = this.policies.get(request.toolName);
    if (policy) {
      if (!policy.allowedRoles.includes(request.role)) {
        throw new AppError({
          message: `Role ${request.role} is not allowed to execute ${request.toolName}`,
          errorCode: "TOOL_PERMISSION_DENIED",
          retryable: false,
          traceId,
          statusCode: 403,
          details: {
            toolName: request.toolName,
            role: request.role,
            allowedRoles: policy.allowedRoles
          }
        });
      }

      // Check approval requirement for sensitive tools
      if (
        policy.requiresApproval &&
        request.approvalMode === "approval" &&
        !request.approved
      ) {
        throw new AppError({
          message: `Tool ${request.toolName} requires approval`,
          errorCode: "TOOL_APPROVAL_REQUIRED",
          retryable: false,
          traceId,
          statusCode: 403,
          details: {
            toolName: request.toolName,
            sensitive: policy.sensitive
          }
        });
      }
    }

    // Create initial trace
    const trace: ToolExecutionTrace = {
      runId: request.runId,
      roleId: request.roleId,
      toolName: request.toolName,
      status: "started",
      startedAt,
      metadata: {
        source: tool.source,
        traceId,
        approved: request.approved,
        approvalMode: request.approvalMode
      }
    };

    // Record trace start
    this.recordTrace(request.runId, trace);

    try {
      // Execute with retry logic
      const output = await this.executeWithRetry(tool, request.input, traceId);

      // Update trace on success
      const endedAt = new Date().toISOString();
      trace.status = "completed";
      trace.endedAt = endedAt;
      trace.metadata = {
        ...trace.metadata,
        durationMs: new Date(endedAt).getTime() - new Date(startedAt).getTime()
      };

      this.recordTrace(request.runId, trace);

      return {
        output,
        trace
      };
    } catch (error) {
      // Update trace on failure
      const endedAt = new Date().toISOString();
      trace.status = "failed";
      trace.endedAt = endedAt;
      trace.metadata = {
        ...trace.metadata,
        durationMs: new Date(endedAt).getTime() - new Date(startedAt).getTime(),
        error: error instanceof Error ? error.message : String(error)
      };

      this.recordTrace(request.runId, trace);

      // Re-throw with proper error handling
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError({
        message: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: "TOOL_EXECUTION_FAILED",
        retryable: true,
        traceId,
        statusCode: 500,
        details: {
          toolName: request.toolName,
          source: tool.source,
          originalError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Get execution history for a run
   */
  public getExecutionHistory(runId: string): ToolExecutionTrace[] {
    return this.executionHistory.get(runId) ?? [];
  }

  /**
   * Clear execution history for a run
   */
  public clearExecutionHistory(runId: string): void {
    this.executionHistory.delete(runId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Execute tool with exponential backoff retry logic
   */
  private async executeWithRetry(
    tool: BrokerTool,
    input: Record<string, unknown>,
    traceId: string,
    attempt = 1
  ): Promise<Record<string, unknown>> {
    try {
      return await tool.execute(input);
    } catch (error) {
      // Don't retry if it's a non-retryable error
      if (error instanceof AppError && !error.retryable) {
        throw error;
      }

      // Don't retry if max attempts reached
      if (attempt >= this.maxRetries) {
        throw error;
      }

      // Calculate backoff delay with jitter
      const baseDelay = this.baseRetryDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.3 * baseDelay; // 30% jitter
      const delay = Math.min(baseDelay + jitter, this.maxRetryDelayMs);

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Retry
      return this.executeWithRetry(tool, input, traceId, attempt + 1);
    }
  }

  /**
   * Record trace entry
   */
  private recordTrace(runId: string, trace: ToolExecutionTrace): void {
    const history = this.executionHistory.get(runId) ?? [];
    history.push(trace);
    this.executionHistory.set(runId, history);
  }
}

/**
 * Create a default ToolExecutor instance
 */
export function createToolExecutor(): ToolExecutor {
  return new ToolExecutor();
}

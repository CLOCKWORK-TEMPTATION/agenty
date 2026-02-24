import type { RbacRole, TaskRequest } from "@repo/types";
import type { ToolBroker } from "@repo/tool-broker";
import type { SpecialistResult, ToolExecutionResult } from "./types.js";

export interface ToolExecutorState {
  runId: string;
  request: TaskRequest;
  specialistResults: SpecialistResult[];
  toolExecutionResults: ToolExecutionResult[];
  events: string[];
}

export interface ToolExecutorUpdate {
  toolExecutionResults?: ToolExecutionResult[];
  events?: string[];
}

export interface ToolExecutorDependencies {
  toolBroker: ToolBroker;
  userRole?: RbacRole;
}

export function createToolExecutorNode(deps: ToolExecutorDependencies) {
  return async function toolExecutorNode(
    state: ToolExecutorState
  ): Promise<ToolExecutorUpdate> {
    if (!state.specialistResults || state.specialistResults.length === 0) {
      return {
        toolExecutionResults: [],
        events: ["tool_executor.skipped.no_specialists"]
      };
    }

    const toolCalls = extractToolCalls(state.specialistResults);

    if (toolCalls.length === 0) {
      return {
        toolExecutionResults: [],
        events: ["tool_executor.completed.no_tools"]
      };
    }

    const results = await executeTools(toolCalls, state, deps);

    return {
      toolExecutionResults: results,
      events: ["tool_executor.completed"]
    };
  };
}

interface ToolCall {
  roleId: string;
  toolName: string;
  input: Record<string, unknown>;
}

function extractToolCalls(specialistResults: SpecialistResult[]): ToolCall[] {
  const calls: ToolCall[] = [];

  for (const result of specialistResults) {
    for (const toolName of result.toolsUsed) {
      calls.push({
        roleId: result.roleId,
        toolName,
        input: {
          source: "specialist",
          roleId: result.roleId
        }
      });
    }
  }

  return calls;
}

async function executeTools(
  toolCalls: ToolCall[],
  state: ToolExecutorState,
  deps: ToolExecutorDependencies
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];

  for (const call of toolCalls) {
    try {
      const executionResult = await deps.toolBroker.execute({
        runId: state.runId,
        roleId: call.roleId,
        toolName: call.toolName,
        input: call.input,
        role: deps.userRole || "viewer",
        approvalMode: state.request.approvalMode,
        approved: state.request.approvalMode === "auto"
      });

      results.push({
        roleId: call.roleId,
        toolName: call.toolName,
        input: call.input,
        output: executionResult.output,
        status: "completed",
        executedAt: executionResult.trace.endedAt || new Date().toISOString()
      });
    } catch (error) {
      results.push({
        roleId: call.roleId,
        toolName: call.toolName,
        input: call.input,
        output: {
          error: error instanceof Error ? error.message : "Tool execution failed"
        },
        status: "failed",
        executedAt: new Date().toISOString()
      });
    }
  }

  return results;
}

import type { RoleAssignment, TaskRequest } from "@repo/types";
import type { SpecialistResult, ToolExecutionResult } from "./types.js";

export interface AggregateState {
  request: TaskRequest;
  assignments: RoleAssignment[];
  specialistResults: SpecialistResult[];
  toolExecutionResults: ToolExecutionResult[];
  aggregatedOutput?: Record<string, unknown>;
  events: string[];
}

export interface AggregateUpdate {
  aggregatedOutput?: Record<string, unknown>;
  events?: string[];
}

export interface AggregateDependencies {
  liteLLMClient?: {
    chat: (params: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
    }) => Promise<{ content: string }>;
  };
}

export function createAggregateNode(deps: AggregateDependencies = {}) {
  return async function aggregateNode(state: AggregateState): Promise<AggregateUpdate> {
    if (!state.specialistResults || state.specialistResults.length === 0) {
      return {
        aggregatedOutput: {
          status: "no_results",
          message: "No specialist results to aggregate"
        },
        events: ["aggregate.completed.empty"]
      };
    }

    const aggregated = await aggregateResults(state, deps);

    return {
      aggregatedOutput: aggregated,
      events: ["aggregate.completed"]
    };
  };
}

async function aggregateResults(
  state: AggregateState,
  deps: AggregateDependencies
): Promise<Record<string, unknown>> {
  if (deps.liteLLMClient) {
    return aggregateWithLLM(state, deps.liteLLMClient);
  }

  return aggregateSimple(state);
}

async function aggregateWithLLM(
  state: AggregateState,
  client: NonNullable<AggregateDependencies["liteLLMClient"]>
): Promise<Record<string, unknown>> {
  const aggregatorModel =
    state.assignments.find((a) => a.skills.includes("finalizer-core"))?.model ||
    state.assignments[0]?.model ||
    "gpt-4";

  const prompt = buildAggregationPrompt(state);

  try {
    const response = await client.chat({
      model: aggregatorModel,
      messages: [
        {
          role: "system",
          content:
            "You are an aggregator agent. Combine the results from multiple specialists into a coherent final output."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 3000
    });

    return {
      status: "success",
      aggregatedResult: response.content,
      specialistCount: state.specialistResults.length,
      toolExecutionCount: state.toolExecutionResults.length,
      model: aggregatorModel
    };
  } catch (error) {
    return aggregateSimple(state);
  }
}

function aggregateSimple(state: AggregateState): Record<string, unknown> {
  const results = state.specialistResults.map((r) => ({
    roleId: r.roleId,
    output: r.output,
    toolsUsed: r.toolsUsed,
    completedAt: r.completedAt
  }));

  const toolResults = state.toolExecutionResults.map((t) => ({
    toolName: t.toolName,
    status: t.status,
    output: t.output
  }));

  return {
    status: "success",
    task: state.request.title,
    specialistResults: results,
    toolExecutionResults: toolResults,
    summary: `Completed ${results.length} specialist tasks with ${toolResults.length} tool executions`
  };
}

function buildAggregationPrompt(state: AggregateState): string {
  const resultsText = state.specialistResults
    .map(
      (r) => `
Role: ${r.roleId}
Output: ${JSON.stringify(r.output, null, 2)}
Tools Used: ${r.toolsUsed.join(", ")}
`
    )
    .join("\n---\n");

  const toolsText = state.toolExecutionResults
    .map(
      (t) => `
Tool: ${t.toolName}
Status: ${t.status}
Output: ${JSON.stringify(t.output, null, 2)}
`
    )
    .join("\n---\n");

  return `Original Task: ${state.request.title}
Description: ${state.request.description}

Specialist Results:
${resultsText}

Tool Execution Results:
${toolsText}

Aggregate these results into a coherent final output that addresses the original task.`;
}

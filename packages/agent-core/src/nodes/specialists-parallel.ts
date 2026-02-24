import type { RoleAssignment, TaskRequest } from "@repo/types";
import type { ExecutionPlan, SpecialistResult } from "./types.js";

export interface SpecialistsParallelState {
  request: TaskRequest;
  assignments: RoleAssignment[];
  executionPlan?: ExecutionPlan;
  specialistResults: SpecialistResult[];
  events: string[];
}

export interface SpecialistsParallelUpdate {
  specialistResults?: SpecialistResult[];
  events?: string[];
}

export interface SpecialistsParallelDependencies {
  liteLLMClient?: {
    chat: (params: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
    }) => Promise<{ content: string }>;
  };
}

export function createSpecialistsParallelNode(deps: SpecialistsParallelDependencies = {}) {
  return async function specialistsParallelNode(
    state: SpecialistsParallelState
  ): Promise<SpecialistsParallelUpdate> {
    if (!state.assignments || state.assignments.length === 0) {
      throw new Error("No assignments available for specialist execution");
    }

    const results = await executeSpecialistsInParallel(state, deps);

    return {
      specialistResults: results,
      events: ["specialists_parallel.completed"]
    };
  };
}

async function executeSpecialistsInParallel(
  state: SpecialistsParallelState,
  deps: SpecialistsParallelDependencies
): Promise<SpecialistResult[]> {
  const parallelGroups = state.executionPlan?.parallelGroups || [
    state.assignments.map((a) => a.roleId)
  ];

  const allResults: SpecialistResult[] = [];

  for (const group of parallelGroups) {
    const groupAssignments = state.assignments.filter((a) => group.includes(a.roleId));

    const groupPromises = groupAssignments.map((assignment) =>
      executeSpecialist(assignment, state, deps)
    );

    const groupResults = await Promise.all(groupPromises);
    allResults.push(...groupResults);
  }

  return allResults;
}

async function executeSpecialist(
  assignment: RoleAssignment,
  state: SpecialistsParallelState,
  deps: SpecialistsParallelDependencies
): Promise<SpecialistResult> {
  if (!deps.liteLLMClient) {
    return {
      roleId: assignment.roleId,
      agentId: assignment.agentId,
      output: {
        status: "completed",
        message: `${assignment.roleId} completed without LLM client`
      },
      toolsUsed: [],
      completedAt: new Date().toISOString()
    };
  }

  try {
    const prompt = buildSpecialistPrompt(assignment, state);

    const response = await deps.liteLLMClient.chat({
      model: assignment.model,
      messages: [
        {
          role: "system",
          content: `You are a specialist agent assigned to the role: ${assignment.roleId}. Use your assigned tools to complete the task.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    return {
      roleId: assignment.roleId,
      agentId: assignment.agentId,
      output: {
        status: "completed",
        result: response.content,
        model: assignment.model
      },
      toolsUsed: extractToolsFromResponse(response.content, assignment.tools),
      completedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      roleId: assignment.roleId,
      agentId: assignment.agentId,
      output: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      toolsUsed: [],
      completedAt: new Date().toISOString()
    };
  }
}

function buildSpecialistPrompt(
  assignment: RoleAssignment,
  state: SpecialistsParallelState
): string {
  const step = state.executionPlan?.steps.find((s) => s.roleId === assignment.roleId);

  return `Task: ${state.request.title}

Description: ${state.request.description}

Your Role: ${assignment.roleId}
${step ? `Your Action: ${step.action}` : ""}

Available Tools: ${assignment.tools.join(", ")}
Activated Skills: ${assignment.skills.join(", ")}

Execute your part of the task and provide detailed results.`;
}

function extractToolsFromResponse(content: string, availableTools: string[]): string[] {
  const usedTools: string[] = [];

  for (const tool of availableTools) {
    if (content.toLowerCase().includes(tool.toLowerCase())) {
      usedTools.push(tool);
    }
  }

  return usedTools;
}

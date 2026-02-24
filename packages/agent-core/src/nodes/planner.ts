import type { RoleAssignment, TaskRequest } from "@repo/types";
import type { ExecutionPlan, ExecutionStep } from "./types.js";

export interface PlannerState {
  request: TaskRequest;
  assignments: RoleAssignment[];
  revisionCount: number;
  executionPlan?: ExecutionPlan;
  events: string[];
}

export interface PlannerUpdate {
  executionPlan?: ExecutionPlan;
  events?: string[];
}

export interface PlannerDependencies {
  liteLLMClient?: {
    chat: (params: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
    }) => Promise<{ content: string }>;
  };
}

export function createPlannerNode(deps: PlannerDependencies = {}) {
  return async function plannerNode(state: PlannerState): Promise<PlannerUpdate> {
    if (!state.assignments || state.assignments.length === 0) {
      throw new Error("No assignments available for planning");
    }

    let executionPlan: ExecutionPlan;

    if (deps.liteLLMClient) {
      executionPlan = await planWithLLM(state, deps.liteLLMClient);
    } else {
      executionPlan = createDefaultPlan(state);
    }

    return {
      executionPlan,
      events: [`planner.completed.iteration_${state.revisionCount}`]
    };
  };
}

async function planWithLLM(
  state: PlannerState,
  client: NonNullable<PlannerDependencies["liteLLMClient"]>
): Promise<ExecutionPlan> {
  const plannerModel = state.assignments.find((a) => a.skills.includes("planner-core"));
  const modelToUse = plannerModel?.model || state.assignments[0]?.model || "gpt-4";

  const prompt = buildPlanningPrompt(state);

  try {
    const response = await client.chat({
      model: modelToUse,
      messages: [
        {
          role: "system",
          content:
            "You are an expert task planner. Create a detailed execution plan with steps and dependencies."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    return parsePlanFromLLM(response.content, state);
  } catch (error) {
    return createDefaultPlan(state);
  }
}

function buildPlanningPrompt(state: PlannerState): string {
  const rolesInfo = state.assignments
    .map((a) => `- ${a.roleId}: model=${a.model}, tools=${a.tools.join(", ")}`)
    .join("\n");

  return `Task: ${state.request.title}

Description: ${state.request.description}

Available team members:
${rolesInfo}

Create an execution plan with the following:
1. List of execution steps (id, roleId, action, required tools, dependencies)
2. Identify which steps can run in parallel
3. Estimate total duration in minutes

Return as JSON with structure:
{
  "steps": [{"id": "step-1", "roleId": "role-1", "action": "...", "requiredTools": [], "dependencies": []}],
  "parallelGroups": [["step-1", "step-2"]],
  "estimatedDuration": 15
}`;
}

function parsePlanFromLLM(content: string, state: PlannerState): ExecutionPlan {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in LLM response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      steps?: unknown[];
      parallelGroups?: unknown[][];
      estimatedDuration?: number;
    };

    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      throw new Error("Invalid plan structure");
    }

    return {
      steps: parsed.steps as ExecutionStep[],
      parallelGroups: (parsed.parallelGroups || []) as string[][],
      estimatedDuration: parsed.estimatedDuration || 10
    };
  } catch {
    return createDefaultPlan(state);
  }
}

function createDefaultPlan(state: PlannerState): ExecutionPlan {
  const steps: ExecutionStep[] = state.assignments.map((assignment, index) => ({
    id: `step-${index + 1}`,
    roleId: assignment.roleId,
    action: `Execute ${assignment.roleId} tasks`,
    requiredTools: assignment.tools,
    dependencies: index > 0 ? [`step-${index}`] : []
  }));

  const parallelGroups: string[][] = [steps.map((s) => s.id)];

  return {
    steps,
    parallelGroups,
    estimatedDuration: steps.length * 5
  };
}

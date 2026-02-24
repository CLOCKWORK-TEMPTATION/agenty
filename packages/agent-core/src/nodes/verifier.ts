import type { RoleAssignment, RunState, TaskRequest, VerificationResult } from "@repo/types";

export interface VerifierState {
  request: TaskRequest;
  assignments: RoleAssignment[];
  aggregatedOutput?: Record<string, unknown>;
  revisionCount: number;
  verification?: VerificationResult;
  status: RunState["status"];
  events: string[];
}

export interface VerifierUpdate {
  verification?: VerificationResult;
  revisionCount?: number;
  status?: RunState["status"];
  events?: string[];
}

export interface VerifierDependencies {
  liteLLMClient?: {
    chat: (params: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
    }) => Promise<{ content: string }>;
  };
}

const MAX_REVISIONS = 2;

export function createVerifierNode(deps: VerifierDependencies = {}) {
  return async function verifierNode(state: VerifierState): Promise<VerifierUpdate> {
    let verification: VerificationResult;

    if (deps.liteLLMClient) {
      verification = await verifyWithLLM(state, deps.liteLLMClient);
    } else {
      verification = verifyBasic(state);
    }

    const shouldRevise = !verification.passed && state.revisionCount < MAX_REVISIONS;
    const nextRevisionCount = shouldRevise ? state.revisionCount + 1 : state.revisionCount;

    let newStatus: RunState["status"] = "running";
    if (verification.passed) {
      newStatus = "running";
    } else if (nextRevisionCount >= MAX_REVISIONS) {
      newStatus = "failed";
    }

    const events = [
      `verifier.${verification.passed ? "passed" : "failed"}`,
      ...(shouldRevise ? [`revision.${nextRevisionCount}`] : [])
    ];

    return {
      verification,
      revisionCount: nextRevisionCount,
      status: newStatus,
      events
    };
  };
}

async function verifyWithLLM(
  state: VerifierState,
  client: NonNullable<VerifierDependencies["liteLLMClient"]>
): Promise<VerificationResult> {
  const verifierModel =
    state.assignments.find((a) => a.skills.includes("verifier-core"))?.model ||
    state.assignments[0]?.model ||
    "gpt-4";

  const prompt = buildVerificationPrompt(state);

  try {
    const response = await client.chat({
      model: verifierModel,
      messages: [
        {
          role: "system",
          content:
            "You are a verification agent. Analyze the output and determine if it meets the requirements. Return JSON with: {passed: boolean, score: number (0-1), issues: string[]}"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1500
    });

    const parsed = parseVerificationResponse(response.content);
    return parsed;
  } catch (error) {
    return verifyBasic(state);
  }
}

function parseVerificationResponse(content: string): VerificationResult {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      passed?: boolean;
      score?: number;
      issues?: string[];
    };

    return {
      passed: parsed.passed ?? false,
      score: parsed.score ?? 0,
      issues: parsed.issues ?? []
    };
  } catch {
    return {
      passed: false,
      score: 0,
      issues: ["Failed to parse verification response"]
    };
  }
}

function verifyBasic(state: VerifierState): VerificationResult {
  const issues: string[] = [];

  const hasAssignments = state.assignments.length > 0;
  const hasModels = state.assignments.every((assignment) => assignment.model.length > 0);
  const hasOutput = state.aggregatedOutput !== undefined;

  if (!hasAssignments) {
    issues.push("No role assignments found");
  }

  if (!hasModels) {
    issues.push("Some assignments are missing model selection");
  }

  if (!hasOutput) {
    issues.push("No aggregated output available");
  }

  if (hasOutput && state.aggregatedOutput) {
    const outputStatus = state.aggregatedOutput.status;
    if (outputStatus === "failed" || outputStatus === "error") {
      issues.push("Aggregated output indicates failure");
    }
  }

  const passed = issues.length === 0;
  const score = passed ? 1 : Math.max(0, 1 - issues.length * 0.25);

  return {
    passed,
    score,
    issues
  };
}

function buildVerificationPrompt(state: VerifierState): string {
  return `Task: ${state.request.title}

Description: ${state.request.description}

Aggregated Output:
${JSON.stringify(state.aggregatedOutput, null, 2)}

Team Assignments:
${state.assignments.map((a) => `- ${a.roleId}: ${a.model} (tools: ${a.tools.join(", ")})`).join("\n")}

Revision Count: ${state.revisionCount}/${MAX_REVISIONS}

Verify if the output meets the task requirements. Return JSON with:
{
  "passed": boolean,
  "score": number (0-1),
  "issues": string[] (list specific problems if any)
}`;
}

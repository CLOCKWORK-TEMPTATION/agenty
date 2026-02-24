import type { TaskProfile, TaskRequest } from "@repo/types";

export interface ProfileState {
  request: TaskRequest;
  profile?: TaskProfile;
  events: string[];
}

export interface ProfileUpdate {
  profile?: TaskProfile;
  events?: string[];
}

export function profileNode(state: ProfileState): ProfileUpdate {
  const profile = analyzeTaskProfile(state.request);

  return {
    profile,
    events: ["profile.completed"]
  };
}

function analyzeTaskProfile(request: TaskRequest): TaskProfile {
  const descriptionLength = request.description.length;
  const wordCount = request.description.split(/\s+/).length;

  let complexity: TaskProfile["complexity"] = "low";
  if (descriptionLength > 400 || wordCount > 100) {
    complexity = "high";
  } else if (descriptionLength > 200 || wordCount > 50) {
    complexity = "medium";
  }

  const requiredCapabilities: string[] = ["structured-output"];

  const hasCodeKeywords = /\b(code|function|class|method|api|debug|implement|refactor)\b/i.test(
    request.description
  );
  const hasDataKeywords = /\b(data|database|query|sql|analyze|chart|graph)\b/i.test(
    request.description
  );
  const hasResearchKeywords = /\b(research|search|find|investigate|analyze|compare)\b/i.test(
    request.description
  );

  if (hasCodeKeywords || hasDataKeywords || hasResearchKeywords) {
    requiredCapabilities.push("tool-calling");
  }

  if (hasCodeKeywords) {
    requiredCapabilities.push("code-generation");
  }

  if (hasDataKeywords) {
    requiredCapabilities.push("data-analysis");
  }

  let riskLevel: TaskProfile["riskLevel"] = "low";
  if (request.approvalMode === "approval") {
    riskLevel = "medium";
  }

  const hasDestructiveKeywords = /\b(delete|remove|drop|truncate|destroy|overwrite)\b/i.test(
    request.description
  );
  if (hasDestructiveKeywords) {
    riskLevel = "high";
  }

  return {
    complexity,
    requiredCapabilities,
    riskLevel
  };
}

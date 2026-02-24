import type { ModelDecision, ModelProfile, RoleBlueprint, TaskProfile, TaskRequest } from "@repo/types";
import { enforceModelDiversity, routeRoleModel } from "@repo/model-router";

export interface ModelRouteState {
  roles: RoleBlueprint[];
  profile?: TaskProfile;
  request: TaskRequest;
  modelDecisions: ModelDecision[];
  events: string[];
}

export interface ModelRouteUpdate {
  modelDecisions?: ModelDecision[];
  events?: string[];
}

export interface ModelRouteDependencies {
  modelCatalog: ModelProfile[];
}

export function createModelRouteNode(deps: ModelRouteDependencies) {
  return function modelRouteNode(state: ModelRouteState): ModelRouteUpdate {
    if (!state.roles || state.roles.length === 0) {
      throw new Error("No roles available for model routing");
    }

    const profile = state.profile ?? inferProfileFromRequest(state.request);

    const routedDecisions = state.roles.map((role) =>
      routeRoleModel(role, profile, deps.modelCatalog)
    );

    const decisions = applyDiversityFallback(routedDecisions, 2);

    enforceModelDiversity(decisions, 2);

    return {
      modelDecisions: decisions,
      events: ["model_route.completed"]
    };
  };
}

function inferProfileFromRequest(request: TaskRequest): TaskProfile {
  const complexity: TaskProfile["complexity"] =
    request.description.length > 400 ? "high" : "medium";
  return {
    complexity,
    requiredCapabilities: ["structured-output", "tool-calling"],
    riskLevel: request.approvalMode === "approval" ? "medium" : "low"
  };
}

function applyDiversityFallback(decisions: ModelDecision[], minimumUnique: number): ModelDecision[] {
  const diversified = decisions.map((decision) => ({ ...decision }));
  const unique = () => new Set(diversified.map((item) => item.selectedModel));

  if (unique().size >= minimumUnique) {
    return diversified;
  }

  for (const decision of diversified) {
    if (unique().size >= minimumUnique) {
      break;
    }

    for (const fallbackModel of decision.fallbackChain) {
      const usedModels = unique();
      if (usedModels.has(fallbackModel)) {
        continue;
      }

      const fallbackCandidate = decision.candidates.find(
        (candidate) => candidate.model === fallbackModel
      );
      if (!fallbackCandidate) {
        continue;
      }

      decision.selectedModel = fallbackModel;
      decision.score = fallbackCandidate.score;
      break;
    }
  }

  return diversified;
}

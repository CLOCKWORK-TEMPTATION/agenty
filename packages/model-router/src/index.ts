import type { ModelDecision, ModelProfile, RoleBlueprint, TaskProfile } from "@repo/types";

const QUALITY_WEIGHT = 0.65;
const TOOL_RELIABILITY_WEIGHT = 0.2;
const CAPABILITY_FIT_WEIGHT = 0.1;
const LATENCY_RELIABILITY_WEIGHT = 0.05;

export interface RouteModelOptions {
  minContextTokens: number;
  requireTools: boolean;
  requireStructuredOutput: boolean;
  language?: string;
}

export const scoreModel = (model: ModelProfile): number => {
  return (
    model.quality * QUALITY_WEIGHT +
    model.toolReliability * TOOL_RELIABILITY_WEIGHT +
    model.capabilityFit * CAPABILITY_FIT_WEIGHT +
    model.latencyReliability * LATENCY_RELIABILITY_WEIGHT
  );
};

export const applyHardFilters = (
  models: ModelProfile[],
  options: RouteModelOptions
): ModelProfile[] => {
  return models.filter((model) => {
    if (options.requireTools && !model.supportsTools) {
      return false;
    }
    if (options.requireStructuredOutput && !model.supportsStructuredOutput) {
      return false;
    }
    if (model.maxContextTokens < options.minContextTokens) {
      return false;
    }
    if (options.language && !model.languages.includes(options.language)) {
      return false;
    }
    return true;
  });
};

export const routeRoleModel = (
  role: RoleBlueprint,
  taskProfile: TaskProfile,
  catalog: ModelProfile[]
): ModelDecision => {
  const candidates = applyHardFilters(catalog, {
    minContextTokens: taskProfile.complexity === "high" ? 16384 : 8192,
    requireStructuredOutput: true,
    requireTools: role.requiredCapabilities.includes("tool-calling"),
    language: "en"
  });

  if (candidates.length === 0) {
    throw new Error(`No model candidates passed hard filters for role ${role.id}`);
  }

  const scored = candidates
    .map((candidate) => ({ model: candidate, score: scoreModel(candidate) }))
    .sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top) {
    throw new Error(`No scored candidates for role ${role.id}`);
  }

  return {
    roleId: role.id,
    selectedModel: top.model.id,
    score: top.score,
    candidates: scored.map((entry) => ({ model: entry.model.id, score: entry.score })),
    fallbackChain: scored.slice(1, 4).map((entry) => entry.model.id)
  };
};

export const enforceModelDiversity = (
  decisions: ModelDecision[],
  minimumUniqueModels = 2
): void => {
  const selected = new Set(decisions.map((item) => item.selectedModel));
  if (selected.size < minimumUniqueModels) {
    throw new Error(
      `Team model diversity policy failed: requires at least ${minimumUniqueModels} models.`
    );
  }
};

// Export LiteLLM client and provider adapters
export { LiteLLMClient } from "./litellm-client.js";
export * from "./providers/index.js";

// Export semantic cache interceptor
export type {
  SemanticCacheInterceptorConfig,
  CacheInterceptResult
} from "./semantic-cache-interceptor.js";
export { SemanticCacheInterceptor } from "./semantic-cache-interceptor.js";

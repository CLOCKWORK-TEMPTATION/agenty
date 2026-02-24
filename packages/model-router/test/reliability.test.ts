import { describe, expect, it } from "vitest";
import type { ModelDecision, ModelProfile, RoleBlueprint, TaskProfile } from "@repo/types";
import {
  applyHardFilters,
  enforceModelDiversity,
  routeRoleModel,
  scoreModel
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mediumProfile: TaskProfile = {
  complexity: "medium",
  requiredCapabilities: ["tool-calling"],
  riskLevel: "low"
};

const highProfile: TaskProfile = {
  complexity: "high",
  requiredCapabilities: ["tool-calling"],
  riskLevel: "medium"
};

const standardRole: RoleBlueprint = {
  id: "analyst",
  name: "Analyst",
  objective: "Analyse data",
  requiredCapabilities: ["tool-calling"]
};

const nonToolRole: RoleBlueprint = {
  id: "summariser",
  name: "Summariser",
  objective: "Summarise content",
  requiredCapabilities: ["structured-output"]
};

function makeModel(overrides: Partial<ModelProfile>): ModelProfile {
  return {
    id: "base-model",
    provider: "test",
    quality: 0.8,
    toolReliability: 0.8,
    capabilityFit: 0.8,
    latencyReliability: 0.8,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 32768,
    languages: ["en"],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Model-router reliability tests
// ---------------------------------------------------------------------------

describe("model-router reliability", () => {
  it("handles empty model catalog", () => {
    // routeRoleModel must throw a descriptive error — not crash with a
    // TypeError — when no models are in the catalog.
    expect(() => routeRoleModel(standardRole, mediumProfile, [])).toThrow(
      /no model candidates|hard filters/i
    );
  });

  it("handles single model in catalog (diversity violation)", () => {
    // With only one model, routeRoleModel will succeed (it picks the single
    // candidate). However enforceModelDiversity must throw when called on a
    // decisions array where all roles map to the same model.
    const singleModel = makeModel({ id: "only-model" });

    const roleA: RoleBlueprint = {
      id: "role-a",
      name: "Role A",
      objective: "Do A",
      requiredCapabilities: []
    };
    const roleB: RoleBlueprint = {
      id: "role-b",
      name: "Role B",
      objective: "Do B",
      requiredCapabilities: []
    };

    const decisionA = routeRoleModel(roleA, mediumProfile, [singleModel]);
    const decisionB = routeRoleModel(roleB, mediumProfile, [singleModel]);

    expect(decisionA.selectedModel).toBe("only-model");
    expect(decisionB.selectedModel).toBe("only-model");

    // Both decisions select the same model — diversity policy must reject this
    expect(() => enforceModelDiversity([decisionA, decisionB], 2)).toThrow(
      /diversity policy/i
    );
  });

  it("enforceModelDiversity throws when impossible to meet minimum", () => {
    // Build a decisions array where all roles use the same model and there is
    // no alternative in fallbackChain to swap to.
    const decisions: ModelDecision[] = [
      {
        roleId: "r1",
        selectedModel: "model-x",
        score: 0.9,
        candidates: [{ model: "model-x", score: 0.9 }],
        fallbackChain: []
      },
      {
        roleId: "r2",
        selectedModel: "model-x",
        score: 0.9,
        candidates: [{ model: "model-x", score: 0.9 }],
        fallbackChain: []
      },
      {
        roleId: "r3",
        selectedModel: "model-x",
        score: 0.9,
        candidates: [{ model: "model-x", score: 0.9 }],
        fallbackChain: []
      }
    ];

    // Requires 3 unique models but only 1 exists in the decisions
    expect(() => enforceModelDiversity(decisions, 3)).toThrow(/diversity policy/i);
  });

  it("routing with all low-quality models still picks best available", () => {
    // Provide three low-quality models that all pass hard filters.
    // The router must still pick the highest-scoring one (not throw).
    const lowA = makeModel({ id: "low-a", quality: 0.3, toolReliability: 0.3, capabilityFit: 0.3, latencyReliability: 0.3 });
    const lowB = makeModel({ id: "low-b", quality: 0.2, toolReliability: 0.2, capabilityFit: 0.2, latencyReliability: 0.2 });
    const lowC = makeModel({ id: "low-c", quality: 0.1, toolReliability: 0.1, capabilityFit: 0.1, latencyReliability: 0.1 });

    const decision = routeRoleModel(standardRole, mediumProfile, [lowA, lowB, lowC]);

    // Must select the best available (low-a)
    expect(decision.selectedModel).toBe("low-a");
    expect(decision.score).toBeGreaterThan(0);

    // Fallback chain must list the remaining models in descending score order
    expect(decision.fallbackChain[0]).toBe("low-b");
    expect(decision.fallbackChain[1]).toBe("low-c");
  });

  it("handles roles with no matching capabilities", () => {
    // A role that requires tool-calling but all models have supportsTools: false
    // must cause routeRoleModel to throw via the hard-filter path.
    const noToolModels: ModelProfile[] = [
      makeModel({ id: "no-tools-a", supportsTools: false }),
      makeModel({ id: "no-tools-b", supportsTools: false })
    ];

    // standardRole requires ["tool-calling"] — this triggers requireTools: true
    // in applyHardFilters, which will filter out all models
    expect(() => routeRoleModel(standardRole, mediumProfile, noToolModels)).toThrow(
      /no model candidates|hard filters/i
    );
  });

  // -------------------------------------------------------------------------
  // Additional edge cases
  // -------------------------------------------------------------------------

  it("applyHardFilters returns empty when context tokens too small", () => {
    const smallContextModels: ModelProfile[] = [
      makeModel({ id: "tiny", maxContextTokens: 4096 })
    ];

    // high complexity requires minContextTokens: 16384
    const filtered = applyHardFilters(smallContextModels, {
      minContextTokens: 16384,
      requireTools: false,
      requireStructuredOutput: true,
      language: "en"
    });

    expect(filtered).toHaveLength(0);
  });

  it("scoreModel weights quality most heavily", () => {
    // Two models identical except for quality — the higher quality one must score higher
    const highQuality = makeModel({ id: "hq", quality: 1.0, toolReliability: 0.0, capabilityFit: 0.0, latencyReliability: 0.0 });
    const lowQuality = makeModel({ id: "lq", quality: 0.0, toolReliability: 1.0, capabilityFit: 1.0, latencyReliability: 1.0 });

    // quality weight = 0.65; tool+cap+latency weights = 0.20+0.10+0.05 = 0.35
    // highQuality score = 0.65, lowQuality score = 0.35
    expect(scoreModel(highQuality)).toBeGreaterThan(scoreModel(lowQuality));
  });

  it("enforceModelDiversity passes when diversity requirement is met", () => {
    const decisions: ModelDecision[] = [
      {
        roleId: "r1",
        selectedModel: "alpha",
        score: 0.9,
        candidates: [],
        fallbackChain: []
      },
      {
        roleId: "r2",
        selectedModel: "beta",
        score: 0.85,
        candidates: [],
        fallbackChain: []
      }
    ];

    // 2 unique models, requirement is 2 — must not throw
    expect(() => enforceModelDiversity(decisions, 2)).not.toThrow();
  });

  it("routeRoleModel returns correct structure for valid catalog", () => {
    const modelA = makeModel({ id: "model-a", quality: 0.9 });
    const modelB = makeModel({ id: "model-b", quality: 0.8 });

    const decision = routeRoleModel(nonToolRole, mediumProfile, [modelA, modelB]);

    expect(decision).toHaveProperty("roleId", nonToolRole.id);
    expect(decision).toHaveProperty("selectedModel");
    expect(decision).toHaveProperty("score");
    expect(decision).toHaveProperty("candidates");
    expect(decision).toHaveProperty("fallbackChain");
    expect(Array.isArray(decision.candidates)).toBe(true);
    expect(Array.isArray(decision.fallbackChain)).toBe(true);
    // Selected model must come from the catalog
    expect(["model-a", "model-b"]).toContain(decision.selectedModel);
  });

  it("high complexity tasks require larger context window", () => {
    // A model with only 8192 tokens must be filtered out for high complexity tasks
    // (which require minContextTokens: 16384).
    const smallContext = makeModel({ id: "small-ctx", maxContextTokens: 8192 });
    const largeContext = makeModel({ id: "large-ctx", maxContextTokens: 32768 });

    // highProfile => complexity "high" => minContextTokens 16384
    const decision = routeRoleModel(nonToolRole, highProfile, [smallContext, largeContext]);

    // Only large-ctx passes the filter
    expect(decision.selectedModel).toBe("large-ctx");
    expect(decision.candidates).toHaveLength(1);
  });
});

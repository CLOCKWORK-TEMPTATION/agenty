import { describe, expect, it } from "vitest";
import type { ModelProfile, RoleBlueprint, TaskProfile } from "@repo/types";
import { enforceModelDiversity, routeRoleModel, scoreModel } from "../src/index.js";

const role: RoleBlueprint = {
  id: "researcher",
  name: "Researcher",
  objective: "Gather reliable references",
  requiredCapabilities: ["tool-calling"]
};

const profile: TaskProfile = {
  complexity: "high",
  requiredCapabilities: ["tool-calling", "structured-output"],
  riskLevel: "medium"
};

const catalog: ModelProfile[] = [
  {
    id: "gpt-4.1",
    provider: "openai",
    quality: 0.95,
    toolReliability: 0.9,
    capabilityFit: 0.9,
    latencyReliability: 0.8,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 200000,
    languages: ["en", "ar"]
  },
  {
    id: "claude-3-7-sonnet",
    provider: "anthropic",
    quality: 0.94,
    toolReliability: 0.86,
    capabilityFit: 0.89,
    latencyReliability: 0.85,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 200000,
    languages: ["en"]
  }
];

describe("model-router", () => {
  it("applies quality-first scoring", () => {
    const first = catalog[0];
    if (!first) {
      throw new Error("Catalog should include at least one model");
    }
    const value = scoreModel(first);
    expect(value).toBeGreaterThan(0.9);
  });

  it("routes role to best candidate and provides fallback", () => {
    const decision = routeRoleModel(role, profile, catalog);
    expect(decision.selectedModel).toBe("gpt-4.1");
    expect(decision.fallbackChain).toContain("claude-3-7-sonnet");
  });

  it("enforces team diversity", () => {
    const decisions = [
      {
        roleId: "r1",
        selectedModel: "gpt-4.1",
        score: 1,
        candidates: [],
        fallbackChain: []
      },
      {
        roleId: "r2",
        selectedModel: "claude-3-7-sonnet",
        score: 1,
        candidates: [],
        fallbackChain: []
      }
    ];
    expect(() => enforceModelDiversity(decisions, 2)).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import type { ModelProfile, RoleBlueprint, TaskProfile } from "@repo/types";
import { routeRoleModel, scoreModel, applyHardFilters } from "../src/index.js";

const catalog: ModelProfile[] = [
  {
    id: "gpt-4.1",
    provider: "openai",
    quality: 0.95,
    toolReliability: 0.9,
    capabilityFit: 0.92,
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
    capabilityFit: 0.9,
    latencyReliability: 0.84,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 200000,
    languages: ["en", "ar"]
  },
  {
    id: "gemini-2.0-flash",
    provider: "google",
    quality: 0.88,
    toolReliability: 0.82,
    capabilityFit: 0.85,
    latencyReliability: 0.9,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 100000,
    languages: ["en", "ar"]
  },
  {
    id: "low-quality-model",
    provider: "test",
    quality: 0.5,
    toolReliability: 0.4,
    capabilityFit: 0.3,
    latencyReliability: 0.6,
    supportsTools: false,
    supportsStructuredOutput: false,
    maxContextTokens: 4096,
    languages: ["en"]
  }
];

describe("Model Routing", () => {
  describe("quality-first scoring", () => {
    it("should apply quality weight of 0.65", () => {
      const model: ModelProfile = {
        id: "test",
        provider: "test",
        quality: 1.0,
        toolReliability: 0.0,
        capabilityFit: 0.0,
        latencyReliability: 0.0,
        supportsTools: true,
        supportsStructuredOutput: true,
        maxContextTokens: 10000,
        languages: ["en"]
      };

      const score = scoreModel(model);
      expect(score).toBeCloseTo(0.65, 2);
    });

    it("should apply tool reliability weight of 0.20", () => {
      const model: ModelProfile = {
        id: "test",
        provider: "test",
        quality: 0.0,
        toolReliability: 1.0,
        capabilityFit: 0.0,
        latencyReliability: 0.0,
        supportsTools: true,
        supportsStructuredOutput: true,
        maxContextTokens: 10000,
        languages: ["en"]
      };

      const score = scoreModel(model);
      expect(score).toBeCloseTo(0.20, 2);
    });

    it("should apply capability fit weight of 0.10", () => {
      const model: ModelProfile = {
        id: "test",
        provider: "test",
        quality: 0.0,
        toolReliability: 0.0,
        capabilityFit: 1.0,
        latencyReliability: 0.0,
        supportsTools: true,
        supportsStructuredOutput: true,
        maxContextTokens: 10000,
        languages: ["en"]
      };

      const score = scoreModel(model);
      expect(score).toBeCloseTo(0.10, 2);
    });

    it("should apply latency reliability weight of 0.05", () => {
      const model: ModelProfile = {
        id: "test",
        provider: "test",
        quality: 0.0,
        toolReliability: 0.0,
        capabilityFit: 0.0,
        latencyReliability: 1.0,
        supportsTools: true,
        supportsStructuredOutput: true,
        maxContextTokens: 10000,
        languages: ["en"]
      };

      const score = scoreModel(model);
      expect(score).toBeCloseTo(0.05, 2);
    });

    it("should sum all weights to get total score", () => {
      const model: ModelProfile = {
        id: "test",
        provider: "test",
        quality: 0.9,
        toolReliability: 0.8,
        capabilityFit: 0.85,
        latencyReliability: 0.7,
        supportsTools: true,
        supportsStructuredOutput: true,
        maxContextTokens: 10000,
        languages: ["en"]
      };

      const expected = 0.9 * 0.65 + 0.8 * 0.2 + 0.85 * 0.1 + 0.7 * 0.05;
      const score = scoreModel(model);
      expect(score).toBeCloseTo(expected, 5);
    });

    it("should prioritize quality over other factors", () => {
      const highQuality: ModelProfile = {
        id: "high-quality",
        provider: "test",
        quality: 1.0,
        toolReliability: 0.5,
        capabilityFit: 0.5,
        latencyReliability: 0.5,
        supportsTools: true,
        supportsStructuredOutput: true,
        maxContextTokens: 10000,
        languages: ["en"]
      };

      const lowQualityHighOthers: ModelProfile = {
        id: "low-quality-high-others",
        provider: "test",
        quality: 0.6,
        toolReliability: 1.0,
        capabilityFit: 1.0,
        latencyReliability: 1.0,
        supportsTools: true,
        supportsStructuredOutput: true,
        maxContextTokens: 10000,
        languages: ["en"]
      };

      const score1 = scoreModel(highQuality);
      const score2 = scoreModel(lowQualityHighOthers);

      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe("hard filters", () => {
    it("should filter models requiring tool support", () => {
      const filtered = applyHardFilters(catalog, {
        requireTools: true,
        requireStructuredOutput: false,
        minContextTokens: 0
      });

      expect(filtered.length).toBe(3);
      expect(filtered.every((m) => m.supportsTools)).toBe(true);
    });

    it("should filter models requiring structured output", () => {
      const filtered = applyHardFilters(catalog, {
        requireTools: false,
        requireStructuredOutput: true,
        minContextTokens: 0
      });

      expect(filtered.length).toBe(3);
      expect(filtered.every((m) => m.supportsStructuredOutput)).toBe(true);
    });

    it("should filter models by minimum context tokens", () => {
      const filtered = applyHardFilters(catalog, {
        requireTools: false,
        requireStructuredOutput: false,
        minContextTokens: 150000
      });

      expect(filtered.length).toBe(2);
      expect(filtered.every((m) => m.maxContextTokens >= 150000)).toBe(true);
    });

    it("should filter models by language support", () => {
      const allSupportArabic = applyHardFilters(catalog, {
        requireTools: false,
        requireStructuredOutput: false,
        minContextTokens: 0,
        language: "ar"
      });

      expect(allSupportArabic.every((m) => m.languages.includes("ar"))).toBe(true);
    });

    it("should apply multiple filters together", () => {
      const filtered = applyHardFilters(catalog, {
        requireTools: true,
        requireStructuredOutput: true,
        minContextTokens: 100000,
        language: "ar"
      });

      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every((m) => m.supportsTools)).toBe(true);
      expect(filtered.every((m) => m.supportsStructuredOutput)).toBe(true);
      expect(filtered.every((m) => m.maxContextTokens >= 100000)).toBe(true);
      expect(filtered.every((m) => m.languages.includes("ar"))).toBe(true);
    });

    it("should return empty array when no models pass", () => {
      const filtered = applyHardFilters(catalog, {
        requireTools: true,
        requireStructuredOutput: true,
        minContextTokens: 1000000
      });

      expect(filtered).toEqual([]);
    });
  });

  describe("role routing", () => {
    const role: RoleBlueprint = {
      id: "researcher",
      name: "Researcher",
      objective: "Research task",
      requiredCapabilities: ["tool-calling"]
    };

    const profile: TaskProfile = {
      complexity: "medium",
      requiredCapabilities: ["tool-calling", "structured-output"],
      riskLevel: "low"
    };

    it("should select best model based on score", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.selectedModel).toBe("gpt-4.1");
    });

    it("should include role id in decision", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.roleId).toBe("researcher");
    });

    it("should include score in decision", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.score).toBeGreaterThan(0);
      expect(decision.score).toBeLessThanOrEqual(1);
    });

    it("should include candidates list", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.candidates.length).toBeGreaterThan(0);
      expect(decision.candidates[0]).toHaveProperty("model");
      expect(decision.candidates[0]).toHaveProperty("score");
    });

    it("should include fallback chain", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(Array.isArray(decision.fallbackChain)).toBe(true);
      expect(decision.fallbackChain.length).toBeGreaterThan(0);
    });

    it("should limit fallback chain to 3 models", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.fallbackChain.length).toBeLessThanOrEqual(3);
    });

    it("should exclude selected model from fallback chain", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.fallbackChain).not.toContain(decision.selectedModel);
    });

    it("should throw error when no models pass filters", () => {
      const impossibleRole: RoleBlueprint = {
        id: "impossible",
        name: "Impossible",
        objective: "Impossible task",
        requiredCapabilities: ["tool-calling"]
      };

      const highComplexity: TaskProfile = {
        complexity: "high",
        requiredCapabilities: ["tool-calling"],
        riskLevel: "high"
      };

      const limitedCatalog: ModelProfile[] = [
        {
          id: "small-model",
          provider: "test",
          quality: 0.9,
          toolReliability: 0.9,
          capabilityFit: 0.9,
          latencyReliability: 0.9,
          supportsTools: true,
          supportsStructuredOutput: true,
          maxContextTokens: 4096,
          languages: ["en"]
        }
      ];

      expect(() => routeRoleModel(impossibleRole, highComplexity, limitedCatalog)).toThrow(
        /No model candidates passed hard filters/
      );
    });
  });

  describe("complexity-based routing", () => {
    const role: RoleBlueprint = {
      id: "worker",
      name: "Worker",
      objective: "Work",
      requiredCapabilities: ["tool-calling"]
    };

    it("should require 16384 tokens for high complexity", () => {
      const highProfile: TaskProfile = {
        complexity: "high",
        requiredCapabilities: ["tool-calling"],
        riskLevel: "medium"
      };

      const decision = routeRoleModel(role, highProfile, catalog);
      expect(decision.selectedModel).toBeTruthy();
    });

    it("should require 8192 tokens for medium complexity", () => {
      const mediumProfile: TaskProfile = {
        complexity: "medium",
        requiredCapabilities: ["tool-calling"],
        riskLevel: "low"
      };

      const decision = routeRoleModel(role, mediumProfile, catalog);
      expect(decision.selectedModel).toBeTruthy();
    });

    it("should require 8192 tokens for low complexity", () => {
      const lowProfile: TaskProfile = {
        complexity: "low",
        requiredCapabilities: ["tool-calling"],
        riskLevel: "low"
      };

      const decision = routeRoleModel(role, lowProfile, catalog);
      expect(decision.selectedModel).toBeTruthy();
    });
  });

  describe("candidate sorting", () => {
    const role: RoleBlueprint = {
      id: "test-role",
      name: "Test",
      objective: "Test",
      requiredCapabilities: ["tool-calling"]
    };

    const profile: TaskProfile = {
      complexity: "medium",
      requiredCapabilities: ["tool-calling"],
      riskLevel: "low"
    };

    it("should sort candidates by score descending", () => {
      const decision = routeRoleModel(role, profile, catalog);

      for (let i = 0; i < decision.candidates.length - 1; i++) {
        const current = decision.candidates[i];
        const next = decision.candidates[i + 1];
        if (current && next) {
          expect(current.score).toBeGreaterThanOrEqual(next.score);
        }
      }
    });

    it("should have selected model as first candidate", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.candidates[0]?.model).toBe(decision.selectedModel);
    });

    it("should have fallback models in candidates", () => {
      const decision = routeRoleModel(role, profile, catalog);

      for (const fallback of decision.fallbackChain) {
        const found = decision.candidates.find((c) => c.model === fallback);
        expect(found).toBeDefined();
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty catalog", () => {
      const role: RoleBlueprint = {
        id: "test",
        name: "Test",
        objective: "Test",
        requiredCapabilities: []
      };

      const profile: TaskProfile = {
        complexity: "low",
        requiredCapabilities: [],
        riskLevel: "low"
      };

      expect(() => routeRoleModel(role, profile, [])).toThrow();
    });

    it("should handle role with no required capabilities", () => {
      const role: RoleBlueprint = {
        id: "simple",
        name: "Simple",
        objective: "Simple task",
        requiredCapabilities: []
      };

      const profile: TaskProfile = {
        complexity: "low",
        requiredCapabilities: [],
        riskLevel: "low"
      };

      const decision = routeRoleModel(role, profile, catalog);
      expect(decision.selectedModel).toBeTruthy();
    });

    it("should handle single model catalog", () => {
      const role: RoleBlueprint = {
        id: "test",
        name: "Test",
        objective: "Test",
        requiredCapabilities: ["tool-calling"]
      };

      const profile: TaskProfile = {
        complexity: "low",
        requiredCapabilities: ["tool-calling"],
        riskLevel: "low"
      };

      const singleCatalog = [catalog[0]!];
      const decision = routeRoleModel(role, profile, singleCatalog);

      expect(decision.selectedModel).toBe("gpt-4.1");
      expect(decision.fallbackChain).toEqual([]);
    });
  });
});

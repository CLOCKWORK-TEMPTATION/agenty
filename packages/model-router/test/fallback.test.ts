import { describe, expect, it } from "vitest";
import type { ModelProfile, RoleBlueprint, TaskProfile } from "@repo/types";
import { routeRoleModel } from "../src/index.js";

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
    id: "claude-3-5-haiku",
    provider: "anthropic",
    quality: 0.85,
    toolReliability: 0.8,
    capabilityFit: 0.82,
    latencyReliability: 0.88,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 150000,
    languages: ["en"]
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    quality: 0.82,
    toolReliability: 0.78,
    capabilityFit: 0.8,
    latencyReliability: 0.92,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 128000,
    languages: ["en", "ar"]
  }
];

describe("Fallback Chain", () => {
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

  describe("fallback chain generation", () => {
    it("should generate fallback chain", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.fallbackChain).toBeDefined();
      expect(Array.isArray(decision.fallbackChain)).toBe(true);
    });

    it("should include alternative models in fallback", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.fallbackChain.length).toBeGreaterThan(0);
      expect(decision.fallbackChain).toContain("claude-3-7-sonnet");
    });

    it("should limit fallback chain to 3 models", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.fallbackChain.length).toBeLessThanOrEqual(3);
    });

    it("should not include selected model in fallback chain", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.fallbackChain).not.toContain(decision.selectedModel);
    });

    it("should order fallback by score descending", () => {
      const decision = routeRoleModel(role, profile, catalog);

      const fallbackScores = decision.fallbackChain.map((model) => {
        const candidate = decision.candidates.find((c) => c.model === model);
        return candidate?.score ?? 0;
      });

      for (let i = 0; i < fallbackScores.length - 1; i++) {
        const current = fallbackScores[i];
        const next = fallbackScores[i + 1];
        if (current !== undefined && next !== undefined) {
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });

    it("should include next best models after selected", () => {
      const decision = routeRoleModel(role, profile, catalog);
      const selectedIndex = decision.candidates.findIndex(
        (c) => c.model === decision.selectedModel
      );

      expect(selectedIndex).toBe(0);

      for (let i = 0; i < Math.min(3, decision.fallbackChain.length); i++) {
        expect(decision.candidates[i + 1]?.model).toBe(decision.fallbackChain[i]);
      }
    });
  });

  describe("fallback chain with different catalog sizes", () => {
    it("should handle catalog with 2 models", () => {
      const smallCatalog = catalog.slice(0, 2);
      const decision = routeRoleModel(role, profile, smallCatalog);

      expect(decision.fallbackChain.length).toBe(1);
    });

    it("should handle catalog with 3 models", () => {
      const mediumCatalog = catalog.slice(0, 3);
      const decision = routeRoleModel(role, profile, mediumCatalog);

      expect(decision.fallbackChain.length).toBe(2);
    });

    it("should handle catalog with 5+ models", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.fallbackChain.length).toBe(3);
    });

    it("should return empty fallback for single model catalog", () => {
      const singleCatalog = [catalog[0]!];
      const decision = routeRoleModel(role, profile, singleCatalog);

      expect(decision.fallbackChain).toEqual([]);
    });
  });

  describe("fallback quality", () => {
    it("should include high-quality models in fallback", () => {
      const decision = routeRoleModel(role, profile, catalog);

      for (const fallbackModel of decision.fallbackChain) {
        const model = catalog.find((m) => m.id === fallbackModel);
        expect(model?.quality).toBeGreaterThan(0.7);
      }
    });

    it("should prefer models with tool support in fallback", () => {
      const decision = routeRoleModel(role, profile, catalog);

      for (const fallbackModel of decision.fallbackChain) {
        const model = catalog.find((m) => m.id === fallbackModel);
        expect(model?.supportsTools).toBe(true);
      }
    });

    it("should include models with adequate context in fallback", () => {
      const decision = routeRoleModel(role, profile, catalog);

      for (const fallbackModel of decision.fallbackChain) {
        const model = catalog.find((m) => m.id === fallbackModel);
        expect(model?.maxContextTokens).toBeGreaterThan(8000);
      }
    });
  });

  describe("fallback diversity", () => {
    it("should include models from different providers", () => {
      const decision = routeRoleModel(role, profile, catalog);

      const fallbackProviders = decision.fallbackChain.map((model) => {
        const m = catalog.find((c) => c.id === model);
        return m?.provider;
      });

      const uniqueProviders = new Set(fallbackProviders);
      expect(uniqueProviders.size).toBeGreaterThan(1);
    });

    it("should not duplicate models in fallback", () => {
      const decision = routeRoleModel(role, profile, catalog);

      const uniqueFallbacks = new Set(decision.fallbackChain);
      expect(uniqueFallbacks.size).toBe(decision.fallbackChain.length);
    });

    it("should include all unique models from candidates", () => {
      const decision = routeRoleModel(role, profile, catalog);

      for (const fallback of decision.fallbackChain) {
        const found = decision.candidates.find((c) => c.model === fallback);
        expect(found).toBeDefined();
      }
    });
  });

  describe("fallback with filtering", () => {
    it("should respect hard filters in fallback chain", () => {
      const highComplexityProfile: TaskProfile = {
        complexity: "high",
        requiredCapabilities: ["tool-calling"],
        riskLevel: "high"
      };

      const decision = routeRoleModel(role, highComplexityProfile, catalog);

      for (const fallbackModel of decision.fallbackChain) {
        const model = catalog.find((m) => m.id === fallbackModel);
        expect(model?.maxContextTokens).toBeGreaterThanOrEqual(16384);
      }
    });

    it("should only include tool-capable models when required", () => {
      const toolRole: RoleBlueprint = {
        id: "tool-user",
        name: "Tool User",
        objective: "Use tools",
        requiredCapabilities: ["tool-calling"]
      };

      const decision = routeRoleModel(toolRole, profile, catalog);

      for (const fallbackModel of decision.fallbackChain) {
        const model = catalog.find((m) => m.id === fallbackModel);
        expect(model?.supportsTools).toBe(true);
      }
    });

    it("should only include structured-output models", () => {
      const decision = routeRoleModel(role, profile, catalog);

      for (const fallbackModel of decision.fallbackChain) {
        const model = catalog.find((m) => m.id === fallbackModel);
        expect(model?.supportsStructuredOutput).toBe(true);
      }
    });
  });

  describe("fallback usage scenarios", () => {
    it("should provide fallback when primary fails", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.selectedModel).toBe("gpt-4.1");
      expect(decision.fallbackChain[0]).toBe("claude-3-7-sonnet");
    });

    it("should provide multiple fallback options", () => {
      const decision = routeRoleModel(role, profile, catalog);

      expect(decision.fallbackChain.length).toBeGreaterThanOrEqual(2);
    });

    it("should maintain fallback quality standards", () => {
      const decision = routeRoleModel(role, profile, catalog);

      const fallbackScores = decision.fallbackChain.map((model) => {
        const candidate = decision.candidates.find((c) => c.model === model);
        return candidate?.score ?? 0;
      });

      for (const score of fallbackScores) {
        expect(score).toBeGreaterThan(0.5);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle identical scores", () => {
      const identicalCatalog: ModelProfile[] = [
        {
          id: "model-1",
          provider: "test",
          quality: 0.9,
          toolReliability: 0.9,
          capabilityFit: 0.9,
          latencyReliability: 0.9,
          supportsTools: true,
          supportsStructuredOutput: true,
          maxContextTokens: 100000,
          languages: ["en"]
        },
        {
          id: "model-2",
          provider: "test",
          quality: 0.9,
          toolReliability: 0.9,
          capabilityFit: 0.9,
          latencyReliability: 0.9,
          supportsTools: true,
          supportsStructuredOutput: true,
          maxContextTokens: 100000,
          languages: ["en"]
        }
      ];

      const decision = routeRoleModel(role, profile, identicalCatalog);

      expect(decision.fallbackChain.length).toBe(1);
    });

    it("should handle after filtering only one model remains", () => {
      const strictProfile: TaskProfile = {
        complexity: "high",
        requiredCapabilities: ["tool-calling"],
        riskLevel: "high"
      };

      const limitedCatalog: ModelProfile[] = [
        {
          id: "only-one",
          provider: "test",
          quality: 0.95,
          toolReliability: 0.9,
          capabilityFit: 0.9,
          latencyReliability: 0.9,
          supportsTools: true,
          supportsStructuredOutput: true,
          maxContextTokens: 200000,
          languages: ["en"]
        }
      ];

      const decision = routeRoleModel(role, strictProfile, limitedCatalog);

      expect(decision.fallbackChain).toEqual([]);
    });

    it("should handle very large catalog", () => {
      const largeCatalog: ModelProfile[] = Array.from({ length: 20 }, (_, i) => ({
        id: `model-${i}`,
        provider: "test",
        quality: 0.9 - i * 0.01,
        toolReliability: 0.9 - i * 0.01,
        capabilityFit: 0.9 - i * 0.01,
        latencyReliability: 0.9 - i * 0.01,
        supportsTools: true,
        supportsStructuredOutput: true,
        maxContextTokens: 100000,
        languages: ["en"]
      }));

      const decision = routeRoleModel(role, profile, largeCatalog);

      expect(decision.fallbackChain.length).toBe(3);
    });
  });

  describe("fallback chain consistency", () => {
    it("should generate consistent fallback for same input", () => {
      const decision1 = routeRoleModel(role, profile, catalog);
      const decision2 = routeRoleModel(role, profile, catalog);

      expect(decision1.fallbackChain).toEqual(decision2.fallbackChain);
    });

    it("should include fallback models in candidates list", () => {
      const decision = routeRoleModel(role, profile, catalog);

      for (const fallback of decision.fallbackChain) {
        const inCandidates = decision.candidates.some((c) => c.model === fallback);
        expect(inCandidates).toBe(true);
      }
    });

    it("should maintain fallback order based on score", () => {
      const decision = routeRoleModel(role, profile, catalog);

      const scores = decision.fallbackChain.map((model) => {
        const candidate = decision.candidates.find((c) => c.model === model);
        return candidate?.score ?? 0;
      });

      for (let i = 0; i < scores.length - 1; i++) {
        const current = scores[i];
        const next = scores[i + 1];
        if (current !== undefined && next !== undefined) {
          expect(current).toBeGreaterThanOrEqual(next);
        }
      }
    });
  });
});

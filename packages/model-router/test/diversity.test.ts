import { describe, expect, it } from "vitest";
import type { ModelDecision } from "@repo/types";
import { enforceModelDiversity } from "../src/index.js";

describe("Model Diversity Enforcement", () => {
  describe("minimum 2 models requirement", () => {
    it("should pass with 2 different models", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "planner",
          selectedModel: "gpt-4.1",
          score: 0.95,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "specialist",
          selectedModel: "claude-3-7-sonnet",
          score: 0.93,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 2)).not.toThrow();
    });

    it("should pass with more than 2 different models", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "planner",
          selectedModel: "gpt-4.1",
          score: 0.95,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "specialist",
          selectedModel: "claude-3-7-sonnet",
          score: 0.93,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "verifier",
          selectedModel: "gemini-2.0-flash",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 2)).not.toThrow();
    });

    it("should fail with only 1 model", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "planner",
          selectedModel: "gpt-4.1",
          score: 0.95,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "specialist",
          selectedModel: "gpt-4.1",
          score: 0.95,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 2)).toThrow(
        /Team model diversity policy failed/
      );
    });

    it("should fail with empty decisions", () => {
      const decisions: ModelDecision[] = [];

      expect(() => enforceModelDiversity(decisions, 2)).toThrow(
        /Team model diversity policy failed/
      );
    });

    it("should fail with single decision", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "planner",
          selectedModel: "gpt-4.1",
          score: 0.95,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 2)).toThrow(
        /Team model diversity policy failed/
      );
    });
  });

  describe("custom minimum models", () => {
    it("should enforce minimum 3 models when specified", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "r1",
          selectedModel: "model-1",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "r2",
          selectedModel: "model-2",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 3)).toThrow(
        /requires at least 3 models/
      );
    });

    it("should pass with 3 models when minimum is 3", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "r1",
          selectedModel: "model-1",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "r2",
          selectedModel: "model-2",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "r3",
          selectedModel: "model-3",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 3)).not.toThrow();
    });

    it("should enforce minimum 1 model when specified", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "r1",
          selectedModel: "model-1",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 1)).not.toThrow();
    });

    it("should use default minimum of 2 when not specified", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "r1",
          selectedModel: "model-1",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions)).toThrow(
        /requires at least 2 models/
      );
    });
  });

  describe("error messages", () => {
    it("should include minimum count in error message", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "r1",
          selectedModel: "model-1",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      try {
        enforceModelDiversity(decisions, 2);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("2 models");
      }
    });

    it("should mention diversity policy in error", () => {
      const decisions: ModelDecision[] = [];

      try {
        enforceModelDiversity(decisions, 2);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("diversity policy");
      }
    });

    it("should be descriptive for failed policy", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "r1",
          selectedModel: "same-model",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "r2",
          selectedModel: "same-model",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      try {
        enforceModelDiversity(decisions, 2);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("Team model diversity policy failed");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle many decisions with same model", () => {
      const decisions: ModelDecision[] = Array.from({ length: 10 }, (_, i) => ({
        roleId: `role-${i}`,
        selectedModel: "same-model",
        score: 0.9,
        candidates: [],
        fallbackChain: []
      }));

      expect(() => enforceModelDiversity(decisions, 2)).toThrow();
    });

    it("should handle decisions with mixed duplicate and unique models", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "r1",
          selectedModel: "model-1",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "r2",
          selectedModel: "model-1",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "r3",
          selectedModel: "model-2",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "r4",
          selectedModel: "model-2",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 2)).not.toThrow();
    });

    it("should count unique models correctly with many duplicates", () => {
      const decisions: ModelDecision[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          roleId: `r-a-${i}`,
          selectedModel: "model-a",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          roleId: `r-b-${i}`,
          selectedModel: "model-b",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }))
      ];

      expect(() => enforceModelDiversity(decisions, 2)).not.toThrow();
    });

    it("should handle model names with special characters", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "r1",
          selectedModel: "model-1.2.3",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "r2",
          selectedModel: "model@v2",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 2)).not.toThrow();
    });

    it("should handle very large minimum requirement", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "r1",
          selectedModel: "model-1",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 100)).toThrow(
        /requires at least 100 models/
      );
    });

    it("should handle zero minimum requirement", () => {
      const decisions: ModelDecision[] = [];

      expect(() => enforceModelDiversity(decisions, 0)).not.toThrow();
    });
  });

  describe("real-world scenarios", () => {
    it("should enforce diversity for coding team", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "planner",
          selectedModel: "gpt-4.1",
          score: 0.95,
          candidates: [],
          fallbackChain: ["claude-3-7-sonnet", "gemini-2.0-flash"]
        },
        {
          roleId: "specialist",
          selectedModel: "claude-3-7-sonnet",
          score: 0.93,
          candidates: [],
          fallbackChain: ["gpt-4.1", "gemini-2.0-flash"]
        },
        {
          roleId: "verifier",
          selectedModel: "gemini-2.0-flash",
          score: 0.91,
          candidates: [],
          fallbackChain: ["gpt-4.1", "claude-3-7-sonnet"]
        }
      ];

      expect(() => enforceModelDiversity(decisions, 2)).not.toThrow();
    });

    it("should reject team with all same model", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "planner",
          selectedModel: "gpt-4.1",
          score: 0.95,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "specialist",
          selectedModel: "gpt-4.1",
          score: 0.95,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "verifier",
          selectedModel: "gpt-4.1",
          score: 0.95,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 2)).toThrow();
    });

    it("should accept minimal compliant team", () => {
      const decisions: ModelDecision[] = [
        {
          roleId: "worker",
          selectedModel: "model-a",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        },
        {
          roleId: "checker",
          selectedModel: "model-b",
          score: 0.9,
          candidates: [],
          fallbackChain: []
        }
      ];

      expect(() => enforceModelDiversity(decisions, 2)).not.toThrow();
    });
  });
});

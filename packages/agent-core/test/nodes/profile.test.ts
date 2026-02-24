import { describe, expect, it } from "vitest";
import { profileNode } from "../../src/nodes/profile.js";
import type { ProfileState } from "../../src/nodes/profile.js";
import type { TaskRequest } from "@repo/types";

describe("profileNode", () => {
  const baseRequest: TaskRequest = {
    projectId: "project-1",
    userId: "user-1",
    title: "Test task",
    description: "Simple test description",
    domain: "coding",
    approvalMode: "auto"
  };

  describe("complexity detection", () => {
    it("should detect low complexity for short descriptions", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: "Simple task"
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.complexity).toBe("low");
    });

    it("should detect medium complexity for moderate descriptions", () => {
      const description = "This is a moderate task ".repeat(15);
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.complexity).toBe("medium");
    });

    it("should detect high complexity for long descriptions", () => {
      const description = "This is a very complex task with many requirements ".repeat(30);
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.complexity).toBe("high");
    });

    it("should detect high complexity with word count threshold", () => {
      const words = Array(120).fill("word").join(" ");
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: words
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.complexity).toBe("high");
    });

    it("should detect medium complexity with word count threshold", () => {
      const words = Array(70).fill("word").join(" ");
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: words
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.complexity).toBe("medium");
    });
  });

  describe("capability detection", () => {
    it("should always include structured-output capability", () => {
      const state: ProfileState = {
        request: baseRequest,
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.requiredCapabilities).toContain("structured-output");
    });

    it("should detect tool-calling for code keywords", () => {
      const keywords = ["code", "function", "class", "method", "api", "debug", "implement", "refactor"];

      for (const keyword of keywords) {
        const state: ProfileState = {
          request: {
            ...baseRequest,
            description: `Need to ${keyword} something`
          },
          events: []
        };

        const result = profileNode(state);
        expect(result.profile?.requiredCapabilities).toContain("tool-calling");
      }
    });

    it("should detect code-generation for code keywords", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: "Write code for the API endpoint"
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.requiredCapabilities).toContain("code-generation");
      expect(result.profile?.requiredCapabilities).toContain("tool-calling");
    });

    it("should detect data-analysis for data keywords", () => {
      const keywords = ["data", "database", "query", "sql", "analyze", "chart", "graph"];

      for (const keyword of keywords) {
        const state: ProfileState = {
          request: {
            ...baseRequest,
            description: `Need to ${keyword} the results`
          },
          events: []
        };

        const result = profileNode(state);
        expect(result.profile?.requiredCapabilities).toContain("data-analysis");
        expect(result.profile?.requiredCapabilities).toContain("tool-calling");
      }
    });

    it("should detect tool-calling for research keywords", () => {
      const keywords = ["research", "search", "find", "investigate", "analyze", "compare"];

      for (const keyword of keywords) {
        const state: ProfileState = {
          request: {
            ...baseRequest,
            description: `Need to ${keyword} information`
          },
          events: []
        };

        const result = profileNode(state);
        expect(result.profile?.requiredCapabilities).toContain("tool-calling");
      }
    });

    it("should detect multiple capabilities", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: "Write code to query the database and analyze the data with charts"
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.requiredCapabilities).toContain("structured-output");
      expect(result.profile?.requiredCapabilities).toContain("tool-calling");
      expect(result.profile?.requiredCapabilities).toContain("code-generation");
      expect(result.profile?.requiredCapabilities).toContain("data-analysis");
    });

    it("should be case insensitive for keyword detection", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: "WRITE CODE TO IMPLEMENT THE API"
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.requiredCapabilities).toContain("code-generation");
    });
  });

  describe("risk level detection", () => {
    it("should set low risk for auto approval mode", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          approvalMode: "auto"
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.riskLevel).toBe("low");
    });

    it("should set medium risk for approval mode", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          approvalMode: "approval"
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.riskLevel).toBe("medium");
    });

    it("should set high risk for destructive keywords", () => {
      const keywords = ["delete", "remove", "drop", "truncate", "destroy", "overwrite"];

      for (const keyword of keywords) {
        const state: ProfileState = {
          request: {
            ...baseRequest,
            description: `Need to ${keyword} the database`,
            approvalMode: "auto"
          },
          events: []
        };

        const result = profileNode(state);
        expect(result.profile?.riskLevel).toBe("high");
      }
    });

    it("should set high risk even with approval mode if destructive", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: "Delete all user records",
          approvalMode: "approval"
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.riskLevel).toBe("high");
    });

    it("should be case insensitive for destructive keywords", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: "DROP the table",
          approvalMode: "auto"
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.riskLevel).toBe("high");
    });
  });

  describe("events", () => {
    it("should add profile.completed event", () => {
      const state: ProfileState = {
        request: baseRequest,
        events: []
      };

      const result = profileNode(state);

      expect(result.events).toContain("profile.completed");
    });

    it("should not modify existing events array", () => {
      const existingEvents = ["previous.event"];
      const state: ProfileState = {
        request: baseRequest,
        events: existingEvents
      };

      const result = profileNode(state);

      expect(existingEvents).toEqual(["previous.event"]);
      expect(result.events).toContain("profile.completed");
    });
  });

  describe("edge cases", () => {
    it("should handle empty description", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: ""
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.complexity).toBe("low");
      expect(result.profile?.requiredCapabilities).toContain("structured-output");
    });

    it("should handle description with only whitespace", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: "   \n\t   "
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.complexity).toBe("low");
    });

    it("should handle unicode characters", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: "كتابة كود للـ API مع قاعدة بيانات"
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile).toBeDefined();
      expect(result.profile?.requiredCapabilities).toContain("structured-output");
    });

    it("should handle multiple consecutive spaces", () => {
      const description = "word    word    word";
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.complexity).toBe("low");
    });

    it("should handle mixed case keywords", () => {
      const state: ProfileState = {
        request: {
          ...baseRequest,
          description: "WriTe CoDe to QuErY DaTaBaSe"
        },
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.requiredCapabilities).toContain("code-generation");
      expect(result.profile?.requiredCapabilities).toContain("data-analysis");
    });
  });

  describe("complete profile structure", () => {
    it("should return complete profile object", () => {
      const state: ProfileState = {
        request: baseRequest,
        events: []
      };

      const result = profileNode(state);

      expect(result.profile).toBeDefined();
      expect(result.profile).toHaveProperty("complexity");
      expect(result.profile).toHaveProperty("requiredCapabilities");
      expect(result.profile).toHaveProperty("riskLevel");
    });

    it("should have valid complexity values", () => {
      const state: ProfileState = {
        request: baseRequest,
        events: []
      };

      const result = profileNode(state);

      expect(["low", "medium", "high"]).toContain(result.profile?.complexity);
    });

    it("should have valid risk level values", () => {
      const state: ProfileState = {
        request: baseRequest,
        events: []
      };

      const result = profileNode(state);

      expect(["low", "medium", "high"]).toContain(result.profile?.riskLevel);
    });

    it("should have at least one required capability", () => {
      const state: ProfileState = {
        request: baseRequest,
        events: []
      };

      const result = profileNode(state);

      expect(result.profile?.requiredCapabilities.length).toBeGreaterThan(0);
    });
  });
});

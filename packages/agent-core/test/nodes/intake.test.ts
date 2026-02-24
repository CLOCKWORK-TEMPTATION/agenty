import { describe, expect, it } from "vitest";
import { intakeNode } from "../../src/nodes/intake.js";
import type { IntakeState } from "../../src/nodes/intake.js";

describe("intakeNode", () => {
  const validState: IntakeState = {
    runId: "run_123",
    request: {
      projectId: "project-1",
      userId: "user-1",
      title: "Build API",
      description: "Create REST API with authentication",
      domain: "coding",
      approvalMode: "auto"
    },
    status: "draft",
    events: []
  };

  describe("validation success", () => {
    it("should accept valid state", () => {
      const result = intakeNode(validState);

      expect(result.status).toBe("running");
      expect(result.events).toHaveLength(1);
      expect(result.events?.[0]).toMatch(/^intake\.completed\./);
    });

    it("should accept all valid domains", () => {
      const domains = ["coding", "research", "content", "data", "operations"];

      for (const domain of domains) {
        const state: IntakeState = {
          ...validState,
          request: { ...validState.request, domain }
        };

        const result = intakeNode(state);
        expect(result.status).toBe("running");
      }
    });

    it("should accept both approval modes", () => {
      const approvalModes = ["approval", "auto"];

      for (const approvalMode of approvalModes) {
        const state: IntakeState = {
          ...validState,
          request: { ...validState.request, approvalMode }
        };

        const result = intakeNode(state);
        expect(result.status).toBe("running");
      }
    });

    it("should accept optional language field", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, language: "ar" }
      };

      const result = intakeNode(state);
      expect(result.status).toBe("running");
    });

    it("should accept title with max length", () => {
      const maxTitle = "A".repeat(200);
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, title: maxTitle }
      };

      const result = intakeNode(state);
      expect(result.status).toBe("running");
    });

    it("should accept description with max length", () => {
      const maxDescription = "A".repeat(10000);
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, description: maxDescription }
      };

      const result = intakeNode(state);
      expect(result.status).toBe("running");
    });
  });

  describe("validation failures", () => {
    it("should reject missing projectId", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, projectId: "" }
      };

      expect(() => intakeNode(state)).toThrow(/Missing required field: projectId/);
    });

    it("should reject missing userId", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, userId: "" }
      };

      expect(() => intakeNode(state)).toThrow(/Missing required field: userId/);
    });

    it("should reject missing title", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, title: "" }
      };

      expect(() => intakeNode(state)).toThrow(/Missing required field: title/);
    });

    it("should reject missing description", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, description: "" }
      };

      expect(() => intakeNode(state)).toThrow(/Missing required field: description/);
    });

    it("should reject missing domain", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, domain: "" }
      };

      expect(() => intakeNode(state)).toThrow(/Missing required field: domain/);
    });

    it("should reject whitespace-only projectId", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, projectId: "   " }
      };

      expect(() => intakeNode(state)).toThrow(/Missing required field: projectId/);
    });

    it("should reject invalid domain", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, domain: "invalid" }
      };

      expect(() => intakeNode(state)).toThrow(/Invalid domain/);
    });

    it("should reject invalid approval mode", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, approvalMode: "invalid" }
      };

      expect(() => intakeNode(state)).toThrow(/Invalid approvalMode/);
    });

    it("should reject title too long", () => {
      const longTitle = "A".repeat(201);
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, title: longTitle }
      };

      expect(() => intakeNode(state)).toThrow(/Title too long/);
    });

    it("should reject description too long", () => {
      const longDescription = "A".repeat(10001);
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, description: longDescription }
      };

      expect(() => intakeNode(state)).toThrow(/Description too long/);
    });

    it("should include all validation errors in message", () => {
      const state: IntakeState = {
        ...validState,
        request: {
          projectId: "",
          userId: "",
          title: "",
          description: "",
          domain: "invalid",
          approvalMode: "invalid"
        }
      };

      expect(() => intakeNode(state)).toThrow(/projectId/);
      expect(() => intakeNode(state)).toThrow(/userId/);
    });
  });

  describe("edge cases", () => {
    it("should handle unicode characters in title", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, title: "بناء API بالعربية 🚀" }
      };

      const result = intakeNode(state);
      expect(result.status).toBe("running");
    });

    it("should handle multiline description", () => {
      const state: IntakeState = {
        ...validState,
        request: {
          ...validState.request,
          description: "Line 1\nLine 2\nLine 3"
        }
      };

      const result = intakeNode(state);
      expect(result.status).toBe("running");
    });

    it("should handle special characters", () => {
      const state: IntakeState = {
        ...validState,
        request: {
          ...validState.request,
          title: "API & Database + Cache (v2.0)"
        }
      };

      const result = intakeNode(state);
      expect(result.status).toBe("running");
    });

    it("should preserve runId in event", () => {
      const runId = "run_custom_123";
      const state: IntakeState = {
        ...validState,
        runId
      };

      const result = intakeNode(state);
      expect(result.events?.[0]).toContain(runId);
    });
  });

  describe("error codes", () => {
    it("should throw error with INTAKE_VALIDATION_FAILED code", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, projectId: "" }
      };

      try {
        intakeNode(state);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as { errorCode?: string }).errorCode).toBe("INTAKE_VALIDATION_FAILED");
      }
    });

    it("should include descriptive error message", () => {
      const state: IntakeState = {
        ...validState,
        request: { ...validState.request, domain: "" }
      };

      try {
        intakeNode(state);
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain("Intake validation failed");
      }
    });
  });
});

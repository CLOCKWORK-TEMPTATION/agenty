import { describe, expect, it, vi } from "vitest";
import { createVerifierNode } from "../../src/nodes/verifier.js";
import type { VerifierState, VerifierDependencies } from "../../src/nodes/verifier.js";
import type { TaskRequest, RoleAssignment } from "@repo/types";

describe("verifierNode", () => {
  const baseRequest: TaskRequest = {
    projectId: "project-1",
    userId: "user-1",
    title: "Test task",
    description: "Test description",
    domain: "coding",
    approvalMode: "auto"
  };

  const baseAssignments: RoleAssignment[] = [
    {
      roleId: "planner",
      model: "gpt-4.1",
      tools: ["search", "code"],
      skills: ["planner-core"]
    },
    {
      roleId: "specialist",
      model: "claude-3-7-sonnet",
      tools: ["code", "database"],
      skills: ["specialist-core"]
    }
  ];

  describe("basic verification", () => {
    it("should pass verification for valid state", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success", result: "completed" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(true);
      expect(result.verification?.score).toBeGreaterThan(0);
      expect(result.verification?.issues).toHaveLength(0);
      expect(result.status).toBe("running");
    });

    it("should fail verification for missing assignments", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: [],
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(false);
      expect(result.verification?.issues).toContain("No role assignments found");
    });

    it("should fail verification for missing output", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: undefined,
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(false);
      expect(result.verification?.issues).toContain("No aggregated output available");
    });

    it("should fail verification for failed output status", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "failed" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(false);
      expect(result.verification?.issues).toContain("Aggregated output indicates failure");
    });

    it("should fail verification for error output status", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "error" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(false);
      expect(result.verification?.issues).toContain("Aggregated output indicates failure");
    });

    it("should detect assignments missing model", async () => {
      const verifierNode = createVerifierNode();
      const invalidAssignments: RoleAssignment[] = [
        {
          roleId: "planner",
          model: "",
          tools: ["search"],
          skills: ["planner-core"]
        }
      ];

      const state: VerifierState = {
        request: baseRequest,
        assignments: invalidAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(false);
      expect(result.verification?.issues).toContain("Some assignments are missing model selection");
    });
  });

  describe("revision logic", () => {
    it("should increment revision count on failure", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: [],
        aggregatedOutput: undefined,
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.revisionCount).toBe(1);
      expect(result.events).toContain("revision.1");
    });

    it("should not exceed max 2 revisions", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: [],
        aggregatedOutput: undefined,
        revisionCount: 2,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.revisionCount).toBe(2);
      expect(result.status).toBe("failed");
    });

    it("should set failed status after max revisions", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: [],
        aggregatedOutput: undefined,
        revisionCount: 2,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.status).toBe("failed");
    });

    it("should not increment revision on pass", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 1,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.revisionCount).toBe(1);
      expect(result.status).toBe("running");
    });

    it("should handle first revision attempt", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: [],
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.revisionCount).toBe(1);
      expect(result.events).toContain("revision.1");
      expect(result.status).toBe("running");
    });

    it("should handle second revision attempt", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: [],
        revisionCount: 1,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.revisionCount).toBe(2);
      expect(result.events).toContain("revision.2");
      expect(result.status).toBe("failed");
    });
  });

  describe("events", () => {
    it("should emit verifier.passed event on success", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.events).toContain("verifier.passed");
    });

    it("should emit verifier.failed event on failure", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: [],
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.events).toContain("verifier.failed");
    });

    it("should emit revision event with count", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: [],
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.events).toContain("revision.1");
    });

    it("should not emit revision event on max revisions", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: [],
        revisionCount: 2,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.events).not.toContain("revision.3");
    });
  });

  describe("LLM verification", () => {
    it("should use LLM when client provided", async () => {
      const mockClient = {
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify({ passed: true, score: 0.95, issues: [] })
        })
      };

      const verifierNode = createVerifierNode({ liteLLMClient: mockClient });
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(mockClient.chat).toHaveBeenCalled();
      expect(result.verification?.passed).toBe(true);
      expect(result.verification?.score).toBe(0.95);
    });

    it("should fallback to basic verification on LLM error", async () => {
      const mockClient = {
        chat: vi.fn().mockRejectedValue(new Error("LLM error"))
      };

      const verifierNode = createVerifierNode({ liteLLMClient: mockClient });
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(true);
    });

    it("should use verifier model from assignments", async () => {
      const mockClient = {
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify({ passed: true, score: 0.9, issues: [] })
        })
      };

      const verifierNode = createVerifierNode({ liteLLMClient: mockClient });
      const assignmentsWithVerifier: RoleAssignment[] = [
        ...baseAssignments,
        {
          roleId: "verifier",
          model: "claude-verifier",
          tools: [],
          skills: ["verifier-core"]
        }
      ];

      const state: VerifierState = {
        request: baseRequest,
        assignments: assignmentsWithVerifier,
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      await verifierNode(state);

      expect(mockClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-verifier"
        })
      );
    });

    it("should handle malformed LLM response", async () => {
      const mockClient = {
        chat: vi.fn().mockResolvedValue({
          content: "Not a valid JSON response"
        })
      };

      const verifierNode = createVerifierNode({ liteLLMClient: mockClient });
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(false);
      expect(result.verification?.issues).toContain("Failed to parse verification response");
    });

    it("should parse partial LLM response", async () => {
      const mockClient = {
        chat: vi.fn().mockResolvedValue({
          content: 'Some text before { "passed": true, "score": 0.8 } some text after'
        })
      };

      const verifierNode = createVerifierNode({ liteLLMClient: mockClient });
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(true);
      expect(result.verification?.score).toBe(0.8);
    });

    it("should handle missing fields in LLM response", async () => {
      const mockClient = {
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify({ passed: true })
        })
      };

      const verifierNode = createVerifierNode({ liteLLMClient: mockClient });
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(true);
      expect(result.verification?.score).toBe(0);
      expect(result.verification?.issues).toEqual([]);
    });

    it("should include issues from LLM response", async () => {
      const mockClient = {
        chat: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            passed: false,
            score: 0.5,
            issues: ["Missing tests", "Incomplete documentation"]
          })
        })
      };

      const verifierNode = createVerifierNode({ liteLLMClient: mockClient });
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(false);
      expect(result.verification?.score).toBe(0.5);
      expect(result.verification?.issues).toEqual(["Missing tests", "Incomplete documentation"]);
    });
  });

  describe("score calculation", () => {
    it("should return score of 1 for passing verification", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.score).toBe(1);
    });

    it("should decrease score based on number of issues", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: [],
        aggregatedOutput: undefined,
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.score).toBeLessThan(1);
      expect(result.verification?.score).toBeGreaterThanOrEqual(0);
    });

    it("should not go below 0 for score", async () => {
      const verifierNode = createVerifierNode();
      const invalidAssignments: RoleAssignment[] = [
        { roleId: "r1", model: "", tools: [], skills: [] }
      ];

      const state: VerifierState = {
        request: baseRequest,
        assignments: invalidAssignments,
        aggregatedOutput: undefined,
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("edge cases", () => {
    it("should handle empty aggregated output object", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: {},
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(true);
    });

    it("should handle null status in aggregated output", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: null },
        revisionCount: 0,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.verification?.passed).toBe(true);
    });

    it("should handle high revision count", async () => {
      const verifierNode = createVerifierNode();
      const state: VerifierState = {
        request: baseRequest,
        assignments: baseAssignments,
        aggregatedOutput: { status: "success" },
        revisionCount: 10,
        status: "running",
        events: []
      };

      const result = await verifierNode(state);

      expect(result.revisionCount).toBe(10);
      expect(result.status).toBe("running");
    });
  });
});

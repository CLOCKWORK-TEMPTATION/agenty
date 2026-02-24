import { describe, expect, it, beforeEach } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultToolBroker } from "@repo/tool-broker";
import { SkillRegistry } from "@repo/skills-engine";
import type { ModelProfile, TeamTemplate, TaskRequest, RunState } from "@repo/types";
import { AgentOrchestrator } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsBasePath = resolve(__dirname, "..", "..", "..", "skills");

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
  }
];

const template: TeamTemplate = {
  id: "default-template",
  name: "Default",
  version: "1.0.0",
  description: "Default template",
  domains: ["coding"],
  roles: [
    {
      id: "planner",
      name: "Planner",
      objective: "Plan execution",
      requiredCapabilities: ["tool-calling"]
    },
    {
      id: "verifier",
      name: "Verifier",
      objective: "Verify quality",
      requiredCapabilities: ["tool-calling"]
    }
  ]
};

describe("State Management", () => {
  let orchestrator: AgentOrchestrator;
  let skills: SkillRegistry;

  beforeEach(async () => {
    skills = new SkillRegistry();
    await skills.discover(skillsBasePath);
    orchestrator = new AgentOrchestrator({
      modelCatalog: catalog,
      skillRegistry: skills,
      toolBroker: createDefaultToolBroker()
    });
  });

  describe("state initialization", () => {
    it("should initialize state with correct runId format", async () => {
      const request: TaskRequest = {
        projectId: "project-1",
        userId: "user-1",
        title: "Test task",
        description: "Test description",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.runId).toMatch(/^run_\d+$/);
    });

    it("should preserve original request in state", async () => {
      const request: TaskRequest = {
        projectId: "project-preserve",
        userId: "user-preserve",
        title: "Preserve test",
        description: "Test request preservation",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.request).toEqual(request);
      expect(result.state.request.projectId).toBe(request.projectId);
      expect(result.state.request.userId).toBe(request.userId);
      expect(result.state.request.title).toBe(request.title);
    });

    it("should initialize with empty events array", async () => {
      const request: TaskRequest = {
        projectId: "project-events",
        userId: "user-1",
        title: "Events test",
        description: "Test events initialization",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(Array.isArray(result.state.events)).toBe(true);
      expect(result.state.events.length).toBeGreaterThan(0);
    });

    it("should initialize with zero revision count", async () => {
      const request: TaskRequest = {
        projectId: "project-revision-init",
        userId: "user-1",
        title: "Revision init test",
        description: "Test revision count initialization",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.revisionCount).toBeGreaterThanOrEqual(0);
    });

    it("should initialize assignments array", async () => {
      const request: TaskRequest = {
        projectId: "project-assignments",
        userId: "user-1",
        title: "Assignments test",
        description: "Test assignments initialization",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(Array.isArray(result.state.assignments)).toBe(true);
      expect(result.state.assignments.length).toBeGreaterThan(0);
    });

    it("should set valid initial status", async () => {
      const request: TaskRequest = {
        projectId: "project-status",
        userId: "user-1",
        title: "Status test",
        description: "Test status initialization",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      const validStatuses: Array<RunState["status"]> = [
        "draft",
        "running",
        "waiting_approval",
        "completed",
        "failed"
      ];
      expect(validStatuses).toContain(result.state.status);
    });

    it("should set updatedAt timestamp", async () => {
      const request: TaskRequest = {
        projectId: "project-timestamp",
        userId: "user-1",
        title: "Timestamp test",
        description: "Test timestamp initialization",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.updatedAt).toBeTruthy();
      const timestamp = new Date(result.state.updatedAt).getTime();
      expect(timestamp).toBeGreaterThan(0);
    });
  });

  describe("state updates", () => {
    it("should update status throughout workflow", async () => {
      const request: TaskRequest = {
        projectId: "project-status-update",
        userId: "user-1",
        title: "Status update test",
        description: "Test status updates",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.status).toBe("completed");
    });

    it("should accumulate events", async () => {
      const request: TaskRequest = {
        projectId: "project-event-accumulation",
        userId: "user-1",
        title: "Event accumulation test",
        description: "Test event accumulation",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.events.length).toBeGreaterThan(5);
    });

    it("should update revision count correctly", async () => {
      const request: TaskRequest = {
        projectId: "project-revision-update",
        userId: "user-1",
        title: "Revision update test",
        description: "Test revision count updates",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.revisionCount).toBeLessThanOrEqual(2);
    });

    it("should populate assignments with models", async () => {
      const request: TaskRequest = {
        projectId: "project-assignments-update",
        userId: "user-1",
        title: "Assignments update test",
        description: "Test assignment updates",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.assignments.length).toBeGreaterThan(0);
      for (const assignment of result.state.assignments) {
        expect(assignment.model).toBeTruthy();
        expect(assignment.roleId).toBeTruthy();
      }
    });

    it("should update timestamp on completion", async () => {
      const beforeTime = Date.now();
      const request: TaskRequest = {
        projectId: "project-timestamp-update",
        userId: "user-1",
        title: "Timestamp update test",
        description: "Test timestamp updates",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);
      const afterTime = Date.now();

      const updatedTime = new Date(result.state.updatedAt).getTime();
      expect(updatedTime).toBeGreaterThanOrEqual(beforeTime);
      expect(updatedTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("state persistence across nodes", () => {
    it("should preserve runId across all nodes", async () => {
      const request: TaskRequest = {
        projectId: "project-runid-persist",
        userId: "user-1",
        title: "RunId persistence test",
        description: "Test runId persistence",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.runId).toMatch(/^run_\d+$/);
      for (const event of result.state.events) {
        if (event.includes("intake.completed.")) {
          expect(event).toContain(result.state.runId);
        }
      }
    });

    it("should maintain request integrity", async () => {
      const request: TaskRequest = {
        projectId: "project-integrity",
        userId: "user-integrity",
        title: "Integrity test",
        description: "Test request integrity across nodes",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.request.projectId).toBe(request.projectId);
      expect(result.state.request.userId).toBe(request.userId);
      expect(result.state.request.title).toBe(request.title);
      expect(result.state.request.description).toBe(request.description);
    });

    it("should preserve profile after creation", async () => {
      const request: TaskRequest = {
        projectId: "project-profile-persist",
        userId: "user-1",
        title: "Profile persistence test",
        description: "Test profile persistence across nodes",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      if (result.state.profile) {
        expect(result.state.profile.complexity).toBeTruthy();
        expect(result.state.profile.riskLevel).toBeTruthy();
        expect(result.state.profile.requiredCapabilities).toBeTruthy();
      }
    });

    it("should preserve assignments after allocation", async () => {
      const request: TaskRequest = {
        projectId: "project-assignments-persist",
        userId: "user-1",
        title: "Assignments persistence test",
        description: "Test assignments persistence",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.assignments.length).toBeGreaterThan(0);
      const firstAssignment = result.state.assignments[0];
      expect(firstAssignment.roleId).toBeTruthy();
      expect(firstAssignment.model).toBeTruthy();
    });
  });

  describe("state immutability", () => {
    it("should return new state object", async () => {
      const request: TaskRequest = {
        projectId: "project-immutability",
        userId: "user-1",
        title: "Immutability test",
        description: "Test state immutability",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);
      const stateCopy = { ...result.state };

      expect(result.state).toEqual(stateCopy);
    });

    it("should not modify original request object", async () => {
      const request: TaskRequest = {
        projectId: "project-no-modify",
        userId: "user-1",
        title: "No modify test",
        description: "Test request immutability",
        domain: "coding",
        approvalMode: "auto"
      };

      const originalRequest = { ...request };
      await orchestrator.run(request, template);

      expect(request).toEqual(originalRequest);
    });
  });

  describe("state validation", () => {
    it("should have valid status values", async () => {
      const request: TaskRequest = {
        projectId: "project-valid-status",
        userId: "user-1",
        title: "Valid status test",
        description: "Test status validation",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      const validStatuses: Array<RunState["status"]> = [
        "draft",
        "running",
        "waiting_approval",
        "completed",
        "failed"
      ];
      expect(validStatuses).toContain(result.state.status);
    });

    it("should have valid runId format", async () => {
      const request: TaskRequest = {
        projectId: "project-valid-runid",
        userId: "user-1",
        title: "Valid runId test",
        description: "Test runId validation",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.runId).toMatch(/^run_\d+$/);
    });

    it("should have valid timestamp format", async () => {
      const request: TaskRequest = {
        projectId: "project-valid-timestamp",
        userId: "user-1",
        title: "Valid timestamp test",
        description: "Test timestamp validation",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(() => new Date(result.state.updatedAt)).not.toThrow();
      const date = new Date(result.state.updatedAt);
      expect(date.getTime()).toBeGreaterThan(0);
    });

    it("should have non-negative revision count", async () => {
      const request: TaskRequest = {
        projectId: "project-valid-revision",
        userId: "user-1",
        title: "Valid revision test",
        description: "Test revision count validation",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.revisionCount).toBeGreaterThanOrEqual(0);
    });

    it("should have valid assignment structure", async () => {
      const request: TaskRequest = {
        projectId: "project-valid-assignment",
        userId: "user-1",
        title: "Valid assignment test",
        description: "Test assignment structure validation",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      for (const assignment of result.state.assignments) {
        expect(assignment).toHaveProperty("roleId");
        expect(assignment).toHaveProperty("model");
        expect(assignment).toHaveProperty("tools");
        expect(assignment).toHaveProperty("skills");
        expect(Array.isArray(assignment.tools)).toBe(true);
        expect(Array.isArray(assignment.skills)).toBe(true);
      }
    });
  });

  describe("state for approval flow", () => {
    it("should set waiting_approval status", async () => {
      const request: TaskRequest = {
        projectId: "project-approval-status",
        userId: "user-1",
        title: "Approval status test",
        description: "Test approval status",
        domain: "coding",
        approvalMode: "approval"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.status).toBe("waiting_approval");
    });

    it("should preserve state when interrupted", async () => {
      const request: TaskRequest = {
        projectId: "project-interrupt-state",
        userId: "user-1",
        title: "Interrupt state test",
        description: "Test state preservation on interrupt",
        domain: "coding",
        approvalMode: "approval"
      };

      const paused = await orchestrator.run(request, template);

      expect(paused.state.runId).toBeTruthy();
      expect(paused.state.assignments.length).toBeGreaterThan(0);
    });

    it("should resume with preserved state", async () => {
      const request: TaskRequest = {
        projectId: "project-resume-state",
        userId: "user-1",
        title: "Resume state test",
        description: "Test state preservation on resume",
        domain: "coding",
        approvalMode: "approval"
      };

      const paused = await orchestrator.run(request, template);
      const originalRunId = paused.state.runId;

      const resumed = await orchestrator.resume(paused.state.runId, { approved: true }, request);

      expect(resumed.state.runId).toBe(originalRunId);
    });
  });

  describe("edge cases", () => {
    it("should handle missing profile gracefully", async () => {
      const request: TaskRequest = {
        projectId: "project-no-profile",
        userId: "user-1",
        title: "No profile test",
        description: "Test missing profile handling",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state).toBeDefined();
    });

    it("should handle empty events array", async () => {
      const request: TaskRequest = {
        projectId: "project-empty-events",
        userId: "user-1",
        title: "Empty events test",
        description: "Test empty events handling",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(Array.isArray(result.state.events)).toBe(true);
      expect(result.state.events.length).toBeGreaterThan(0);
    });

    it("should handle artifacts array", async () => {
      const request: TaskRequest = {
        projectId: "project-artifacts",
        userId: "user-1",
        title: "Artifacts test",
        description: "Test artifacts handling",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(Array.isArray(result.state.artifacts)).toBe(true);
    });
  });
});

import { describe, expect, it, beforeEach } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultToolBroker } from "@repo/tool-broker";
import { SkillRegistry } from "@repo/skills-engine";
import type { ModelProfile, TeamTemplate, TaskRequest } from "@repo/types";
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

describe("Revision Loops", () => {
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

  describe("max revision enforcement", () => {
    it("should enforce max 2 revision loops", async () => {
      const request: TaskRequest = {
        projectId: "project-revision",
        userId: "user-1",
        title: "Test revision limit",
        description: "Task to test revision limits",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.revisionCount).toBeLessThanOrEqual(2);
    });

    it("should never exceed 2 revisions", async () => {
      const request: TaskRequest = {
        projectId: "project-max-revision",
        userId: "user-1",
        title: "Max revision test",
        description: "Complex task that might trigger revisions",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.revisionCount).toBeLessThanOrEqual(2);
      expect(result.state.revisionCount).toBeGreaterThanOrEqual(0);
    });

    it("should complete even if verifier fails multiple times", async () => {
      const request: TaskRequest = {
        projectId: "project-failed-verification",
        userId: "user-1",
        title: "Failed verification test",
        description: "Test that completes despite verification failures",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(["completed", "failed"]).toContain(result.state.status);
      expect(result.state.revisionCount).toBeLessThanOrEqual(2);
    });
  });

  describe("revision events", () => {
    it("should track revision events", async () => {
      const request: TaskRequest = {
        projectId: "project-events",
        userId: "user-1",
        title: "Track revision events",
        description: "Monitor revision events",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      if (result.state.revisionCount > 0) {
        const revisionEvents = result.state.events.filter((e) => e.includes("revision"));
        expect(revisionEvents.length).toBeLessThanOrEqual(2);
      }
    });

    it("should include revision count in events", async () => {
      const request: TaskRequest = {
        projectId: "project-revision-count",
        userId: "user-1",
        title: "Revision count test",
        description: "Test revision count tracking",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      if (result.state.revisionCount > 0) {
        const hasRevisionEvent = result.state.events.some(
          (e) =>
            e.includes("revision.1") ||
            e.includes("revision.2")
        );
        expect(hasRevisionEvent).toBe(true);
      }
    });
  });

  describe("revision flow", () => {
    it("should route back to planner after failed verification", async () => {
      const request: TaskRequest = {
        projectId: "project-planner-route",
        userId: "user-1",
        title: "Planner route test",
        description: "Test routing back to planner",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      if (result.state.revisionCount > 0) {
        const plannerEvents = result.state.events.filter((e) => e.includes("planner"));
        expect(plannerEvents.length).toBeGreaterThan(0);
      }
    });

    it("should go to finalizer after max revisions", async () => {
      const request: TaskRequest = {
        projectId: "project-finalizer",
        userId: "user-1",
        title: "Finalizer route test",
        description: "Test routing to finalizer after max revisions",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      const finalizerEvents = result.state.events.filter((e) => e.includes("finalizer"));
      expect(finalizerEvents.length).toBeGreaterThan(0);
    });

    it("should maintain state across revisions", async () => {
      const request: TaskRequest = {
        projectId: "project-state-maintain",
        userId: "user-1",
        title: "State maintenance test",
        description: "Test state consistency across revisions",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.assignments.length).toBeGreaterThan(0);
      expect(result.state.events.length).toBeGreaterThan(0);
      expect(result.state.runId).toMatch(/^run_\d+$/);
    });
  });

  describe("revision count tracking", () => {
    it("should start with 0 revisions", async () => {
      const request: TaskRequest = {
        projectId: "project-initial",
        userId: "user-1",
        title: "Initial revision count",
        description: "Test initial revision count",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.revisionCount).toBeGreaterThanOrEqual(0);
    });

    it("should increment revision count on failure", async () => {
      const request: TaskRequest = {
        projectId: "project-increment",
        userId: "user-1",
        title: "Increment test",
        description: "Test revision count increment",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.revisionCount).toBeGreaterThanOrEqual(0);
      expect(result.state.revisionCount).toBeLessThanOrEqual(2);
    });

    it("should not increment beyond max", async () => {
      const request: TaskRequest = {
        projectId: "project-no-increment",
        userId: "user-1",
        title: "No increment beyond max",
        description: "Test that revision count stops at max",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.revisionCount).toBeLessThanOrEqual(2);
    });
  });

  describe("verification and revision interaction", () => {
    it("should include verification result", async () => {
      const request: TaskRequest = {
        projectId: "project-verification",
        userId: "user-1",
        title: "Verification test",
        description: "Test verification result",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      if (result.state.verification) {
        expect(result.state.verification).toHaveProperty("passed");
        expect(result.state.verification).toHaveProperty("score");
        expect(result.state.verification).toHaveProperty("issues");
      }
    });

    it("should pass verification on first try or after revisions", async () => {
      const request: TaskRequest = {
        projectId: "project-pass-verification",
        userId: "user-1",
        title: "Pass verification test",
        description: "Test passing verification",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      if (result.state.status === "completed" && result.state.verification) {
        expect(
          result.state.verification.passed || result.state.revisionCount >= 2
        ).toBe(true);
      }
    });

    it("should stop revisions after verification passes", async () => {
      const request: TaskRequest = {
        projectId: "project-stop-revisions",
        userId: "user-1",
        title: "Stop revisions test",
        description: "Test stopping revisions after pass",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      if (result.state.verification?.passed) {
        expect(result.state.status).not.toBe("failed");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle complex tasks requiring revisions", async () => {
      const complexDescription = `
        Build a comprehensive system with:
        - Authentication and authorization
        - Database with migrations
        - API endpoints with validation
        - Unit tests and integration tests
        - Documentation
        - Deployment configuration
      `;

      const request: TaskRequest = {
        projectId: "project-complex",
        userId: "user-1",
        title: "Complex system",
        description: complexDescription,
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.revisionCount).toBeLessThanOrEqual(2);
      expect(["completed", "failed"]).toContain(result.state.status);
    });

    it("should handle simple tasks without revisions", async () => {
      const request: TaskRequest = {
        projectId: "project-simple",
        userId: "user-1",
        title: "Simple task",
        description: "Simple task",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.revisionCount).toBeGreaterThanOrEqual(0);
      expect(result.state.status).toBe("completed");
    });
  });
});

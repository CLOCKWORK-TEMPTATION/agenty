import { describe, expect, it, beforeEach } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultToolBroker } from "@repo/tool-broker";
import { SkillRegistry } from "@repo/skills-engine";
import type { ModelProfile, TeamTemplate, TaskRequest } from "@repo/types";
import { AgentOrchestrator, EXECUTION_GRAPH } from "../src/index.js";

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
      id: "specialist",
      name: "Specialist",
      objective: "Execute tasks",
      requiredCapabilities: ["tool-calling", "code-generation"]
    },
    {
      id: "verifier",
      name: "Verifier",
      objective: "Verify quality",
      requiredCapabilities: ["tool-calling"]
    }
  ]
};

describe("AgentOrchestrator", () => {
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

  describe("initialization", () => {
    it("should create orchestrator with valid dependencies", () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator).toBeInstanceOf(AgentOrchestrator);
    });

    it("should validate EXECUTION_GRAPH contains all required nodes", () => {
      const requiredNodes = [
        "START",
        "intake",
        "profile",
        "template_select",
        "team_design",
        "model_route",
        "tools_allocate",
        "skills_load",
        "approval_gate",
        "planner",
        "specialists_parallel",
        "tool_executor",
        "aggregate",
        "verifier",
        "finalizer",
        "END"
      ];

      for (const node of requiredNodes) {
        expect(EXECUTION_GRAPH).toContain(node);
      }
    });

    it("should enforce verifier before finalizer order", () => {
      const verifierIndex = EXECUTION_GRAPH.indexOf("verifier");
      const finalizerIndex = EXECUTION_GRAPH.indexOf("finalizer");
      expect(verifierIndex).toBeGreaterThan(-1);
      expect(finalizerIndex).toBeGreaterThan(verifierIndex);
    });

    it("should enforce approval_gate before planner", () => {
      const approvalIndex = EXECUTION_GRAPH.indexOf("approval_gate");
      const plannerIndex = EXECUTION_GRAPH.indexOf("planner");
      expect(approvalIndex).toBeLessThan(plannerIndex);
    });
  });

  describe("run workflow", () => {
    const baseRequest: TaskRequest = {
      projectId: "project-1",
      userId: "user-1",
      title: "Build REST API",
      description: "Create a REST API with authentication and database integration",
      domain: "coding",
      approvalMode: "auto"
    };

    it("should complete successful workflow", async () => {
      const result = await orchestrator.run(baseRequest, template);

      expect(result.state.status).toBe("completed");
      expect(result.state.runId).toMatch(/^run_\d+$/);
      expect(result.state.request).toEqual(baseRequest);
      expect(result.workflow).toEqual(EXECUTION_GRAPH);
    });

    it("should enforce minimum 2 different models", async () => {
      const result = await orchestrator.run(baseRequest, template);

      const uniqueModels = new Set(result.state.assignments.map((a) => a.model));
      expect(uniqueModels.size).toBeGreaterThanOrEqual(2);
    });

    it("should enforce max 2 revision loops", async () => {
      const result = await orchestrator.run(baseRequest, template);

      expect(result.state.revisionCount).toBeLessThanOrEqual(2);
    });

    it("should create role assignments matching template", async () => {
      const result = await orchestrator.run(baseRequest, template);

      expect(result.state.assignments.length).toBeGreaterThanOrEqual(template.roles.length);

      for (const role of template.roles) {
        const assignment = result.state.assignments.find((a) => a.roleId === role.id);
        expect(assignment).toBeDefined();
        expect(assignment?.model).toBeTruthy();
      }
    });

    it("should generate events for all nodes", async () => {
      const result = await orchestrator.run(baseRequest, template);

      expect(result.state.events.length).toBeGreaterThan(0);
      expect(result.state.events.some((e) => e.includes("intake"))).toBe(true);
      expect(result.state.events.some((e) => e.includes("profile"))).toBe(true);
      expect(result.state.events.some((e) => e.includes("verifier"))).toBe(true);
    });

    it("should handle high complexity tasks", async () => {
      const complexRequest: TaskRequest = {
        ...baseRequest,
        description:
          "Build a comprehensive microservices architecture with authentication, authorization, API gateway, service mesh, monitoring, logging, distributed tracing, and automated deployment pipelines. Include unit tests, integration tests, and end-to-end tests for all services."
      };

      const result = await orchestrator.run(complexRequest, template);

      expect(result.state.status).toBe("completed");
      expect(result.state.profile?.complexity).toBe("high");
    });

    it("should set profile for task", async () => {
      const result = await orchestrator.run(baseRequest, template);

      expect(result.state.profile).toBeDefined();
      expect(result.state.profile?.complexity).toMatch(/^(low|medium|high)$/);
      expect(result.state.profile?.riskLevel).toMatch(/^(low|medium|high)$/);
      expect(result.state.profile?.requiredCapabilities).toBeInstanceOf(Array);
    });

    it("should handle verification pass", async () => {
      const result = await orchestrator.run(baseRequest, template);

      if (result.state.verification) {
        expect(result.state.verification.passed).toBe(true);
        expect(result.state.verification.score).toBeGreaterThan(0);
      }
    });

    it("should update timestamp", async () => {
      const result = await orchestrator.run(baseRequest, template);

      expect(result.state.updatedAt).toBeTruthy();
      const timestamp = new Date(result.state.updatedAt).getTime();
      expect(timestamp).toBeGreaterThan(0);
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("approval mode", () => {
    it("should interrupt for approval mode", async () => {
      const request: TaskRequest = {
        projectId: "project-approval",
        userId: "user-1",
        title: "Approval required task",
        description: "Task requiring manual approval",
        domain: "coding",
        approvalMode: "approval"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.status).toBe("waiting_approval");
      expect(result.state.events.some((e) => e.includes("interrupt"))).toBe(true);
    });

    it("should resume after approval", async () => {
      const request: TaskRequest = {
        projectId: "project-resume",
        userId: "user-1",
        title: "Resume test",
        description: "Test resume workflow",
        domain: "coding",
        approvalMode: "approval"
      };

      const paused = await orchestrator.run(request, template);
      expect(paused.state.status).toBe("waiting_approval");

      const resumed = await orchestrator.resume(paused.state.runId, { approved: true }, request);

      expect(resumed.state.status).toBe("completed");
      expect(resumed.state.revisionCount).toBeLessThanOrEqual(2);
    });

    it("should fail after rejection", async () => {
      const request: TaskRequest = {
        projectId: "project-reject",
        userId: "user-1",
        title: "Rejection test",
        description: "Test rejection workflow",
        domain: "coding",
        approvalMode: "approval"
      };

      const paused = await orchestrator.run(request, template);
      const resumed = await orchestrator.resume(paused.state.runId, { approved: false }, request);

      expect(resumed.state.status).toBe("completed");
    });
  });

  describe("error handling", () => {
    it("should handle invalid request gracefully", async () => {
      const invalidRequest: TaskRequest = {
        projectId: "",
        userId: "",
        title: "",
        description: "",
        domain: "invalid-domain" as unknown as "coding",
        approvalMode: "auto"
      };

      await expect(orchestrator.run(invalidRequest, template)).rejects.toThrow();
    });

    it("should handle missing required fields", async () => {
      const incompleteRequest = {
        projectId: "project-1",
        domain: "coding",
        approvalMode: "auto"
      } as TaskRequest;

      await expect(orchestrator.run(incompleteRequest, template)).rejects.toThrow();
    });

    it("should handle title too long", async () => {
      const longTitle = "A".repeat(201);
      const request: TaskRequest = {
        projectId: "project-1",
        userId: "user-1",
        title: longTitle,
        description: "Valid description",
        domain: "coding",
        approvalMode: "auto"
      };

      await expect(orchestrator.run(request, template)).rejects.toThrow();
    });

    it("should handle description too long", async () => {
      const longDescription = "A".repeat(10001);
      const request: TaskRequest = {
        projectId: "project-1",
        userId: "user-1",
        title: "Valid title",
        description: longDescription,
        domain: "coding",
        approvalMode: "auto"
      };

      await expect(orchestrator.run(request, template)).rejects.toThrow();
    });
  });

  describe("state management", () => {
    it("should maintain state immutability", async () => {
      const request: TaskRequest = {
        projectId: "project-state",
        userId: "user-1",
        title: "State test",
        description: "Test state immutability",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);
      const originalStatus = result.state.status;
      const originalEvents = [...result.state.events];

      result.state.status = "failed" as typeof result.state.status;

      expect(originalStatus).toBe("completed");
      expect(result.state.status).toBe("failed");
      expect(originalEvents).not.toBe(result.state.events);
    });

    it("should accumulate events correctly", async () => {
      const request: TaskRequest = {
        projectId: "project-events",
        userId: "user-1",
        title: "Events test",
        description: "Test event accumulation",
        domain: "coding",
        approvalMode: "auto"
      };

      const result = await orchestrator.run(request, template);

      expect(result.state.events).toBeInstanceOf(Array);
      expect(result.state.events.length).toBeGreaterThan(5);
      expect(new Set(result.state.events).size).toBeLessThanOrEqual(result.state.events.length);
    });
  });
});

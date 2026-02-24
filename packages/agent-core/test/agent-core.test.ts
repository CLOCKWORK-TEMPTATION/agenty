import { describe, expect, it } from "vitest";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDefaultToolBroker } from "@repo/tool-broker";
import { SkillRegistry } from "@repo/skills-engine";
import type { ModelProfile, TeamTemplate } from "@repo/types";
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

describe("agent-core", () => {
  it("preserves verifier before finalizer", () => {
    const verifierIndex = EXECUTION_GRAPH.indexOf("verifier");
    const finalizerIndex = EXECUTION_GRAPH.indexOf("finalizer");
    expect(verifierIndex).toBeGreaterThan(-1);
    expect(finalizerIndex).toBeGreaterThan(verifierIndex);
  });

  it("runs orchestrator and returns completed state", async () => {
    const skills = new SkillRegistry();
    await skills.discover(skillsBasePath);
    const orchestrator = new AgentOrchestrator({
      modelCatalog: catalog,
      skillRegistry: skills,
      toolBroker: createDefaultToolBroker()
    });

    const result = await orchestrator.run(
      {
        projectId: "project-1",
        userId: "user-1",
        title: "Build feature",
        description: "Create an API endpoint with tests",
        domain: "coding",
        approvalMode: "auto"
      },
      template
    );

    expect(result.state.status).toBe("completed");
    expect(result.state.revisionCount).toBeLessThanOrEqual(2);
    expect(result.state.assignments.length).toBe(2);
    expect(new Set(result.state.assignments.map((assignment) => assignment.model)).size).toBeGreaterThanOrEqual(2);
  });

  it("supports approval interrupt then resume", async () => {
    const skills = new SkillRegistry();
    await skills.discover(skillsBasePath);
    const orchestrator = new AgentOrchestrator({
      modelCatalog: catalog,
      skillRegistry: skills,
      toolBroker: createDefaultToolBroker()
    });

    const paused = await orchestrator.run(
      {
        projectId: "project-2",
        userId: "user-2",
        title: "Approval flow",
        description: "Run with approval gate",
        domain: "coding",
        approvalMode: "approval"
      },
      template
    );

    expect(paused.state.status).toBe("waiting_approval");
    expect(paused.state.events.some((event) => event.includes("approval_gate.interrupt"))).toBe(true);

    const resumed = await orchestrator.resume(
      paused.state.runId,
      { approved: true },
      paused.state.request
    );

    expect(resumed.state.status).toBe("completed");
    expect(resumed.state.revisionCount).toBeLessThanOrEqual(2);
  });
});

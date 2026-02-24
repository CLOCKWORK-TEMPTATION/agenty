import assert from "node:assert/strict";
import { createDefaultGateway } from "../packages/a2a-gateway/dist/index.js";
import { createDefaultToolBroker } from "../packages/tool-broker/dist/index.js";
import { routeRoleModel, scoreModel } from "../packages/model-router/dist/index.js";
import { decryptValue, encryptValue, sanitizeForDlp } from "../packages/security/dist/index.js";
import { SkillRegistry } from "../packages/skills-engine/dist/index.js";
import { buildApp } from "../apps/api/dist/app.js";

const run = async () => {
  const report = [];

  const toolBroker = createDefaultToolBroker();
  const tools = toolBroker.listCatalog();
  assert.ok(tools.length >= 2, "tool catalog should contain tools");
  report.push("tool-broker catalog ok");

  await assert.rejects(
    () =>
      toolBroker.execute({
        runId: "run-1",
        roleId: "role-1",
        toolName: "git.push",
        input: { branch: "main" },
        role: "admin",
        approvalMode: "approval",
        approved: false
      }),
    /requires approval/
  );
  report.push("sensitive approval guard ok");

  const encoded = encryptValue("secret");
  assert.equal(decryptValue(encoded), "secret");
  assert.equal(sanitizeForDlp("mail user@example.com"), "mail [REDACTED]");
  report.push("security crypto and dlp ok");

  const score = scoreModel({
    id: "gpt-4.1",
    provider: "openai",
    quality: 0.95,
    toolReliability: 0.9,
    capabilityFit: 0.9,
    latencyReliability: 0.8,
    supportsTools: true,
    supportsStructuredOutput: true,
    maxContextTokens: 200000,
    languages: ["en", "ar"]
  });
  assert.ok(score > 0.8, "quality-first score should be high");

  const decision = routeRoleModel(
    {
      id: "planner",
      name: "Planner",
      objective: "Plan execution",
      requiredCapabilities: ["tool-calling"]
    },
    {
      complexity: "medium",
      requiredCapabilities: ["tool-calling"],
      riskLevel: "low"
    },
    [
      {
        id: "gpt-4.1",
        provider: "openai",
        quality: 0.95,
        toolReliability: 0.9,
        capabilityFit: 0.9,
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
        toolReliability: 0.88,
        capabilityFit: 0.88,
        latencyReliability: 0.82,
        supportsTools: true,
        supportsStructuredOutput: true,
        maxContextTokens: 200000,
        languages: ["en", "ar"]
      }
    ]
  );
  assert.equal(decision.selectedModel, "gpt-4.1");
  report.push("model router quality-first ok");

  const skills = new SkillRegistry();
  await skills.discover("skills");
  const activated = await skills.activate("orchestrator-core");
  assert.ok(activated.content.length > 0, "skill should load content");
  report.push("skills progressive disclosure ok");

  const gateway = createDefaultGateway();
  const a2aResult = await gateway.submitTask({
    requestId: "req-1",
    sourceAgent: "orchestrator",
    targetAgent: "planner",
    objective: "Build plan",
    payload: {}
  });
  assert.equal(a2aResult.status, "completed");
  report.push("a2a gateway ok");

  const app = await buildApp({ logger: false });
  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    assert.equal(health.statusCode, 200);

    const run = await app.inject({
      method: "POST",
      url: "/api/v1/team/run",
      headers: { "x-role": "owner" },
      payload: {
        projectId: "project-1",
        userId: "user-1",
        title: "Implement",
        description: "Implement endpoint and tests",
        domain: "coding",
        approvalMode: "approval"
      }
    });

    assert.equal(run.statusCode, 200);
    const body = run.json();
    assert.ok(body?.data?.runId, "run id should exist");

    const runDetails = await app.inject({ method: "GET", url: `/api/v1/runs/${body.data.runId}` });
    assert.equal(runDetails.statusCode, 200);
    report.push("api lifecycle endpoints ok");
  } finally {
    await app.close();
  }

  process.stdout.write("Smoke tests passed:\n");
  for (const line of report) {
    process.stdout.write(`- ${line}\n`);
  }
};

run().catch((error) => {
  process.stderr.write(
    `Smoke tests failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});

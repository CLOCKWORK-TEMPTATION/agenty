import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ModelProfile, TeamTemplate, TaskRequest } from "@repo/types";
import { SkillRegistry } from "@repo/skills-engine";
import type { ToolBroker } from "@repo/tool-broker";
import { AgentOrchestrator } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsBasePath = resolve(__dirname, "..", "..", "..", "skills");

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

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

const twoRoleTemplate: TeamTemplate = {
  id: "perf-template",
  name: "Performance Template",
  version: "1.0.0",
  description: "Template used for performance benchmarks",
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

const baseRequest: TaskRequest = {
  projectId: "perf-project",
  userId: "perf-user",
  title: "Performance benchmark task",
  description: "Short description for performance testing",
  domain: "coding",
  approvalMode: "auto"
};

function makeMockToolBroker(): ToolBroker {
  return {
    listCatalog: vi.fn().mockReturnValue([
      {
        id: "fs-read",
        serverId: "fs",
        name: "filesystem.read",
        description: "Read a file",
        inputSchema: { type: "object" },
        sensitive: false
      }
    ]),
    listTools: vi.fn().mockReturnValue([]),
    listConnectedServers: vi.fn().mockReturnValue([]),
    registerTool: vi.fn(),
    registerPolicy: vi.fn(),
    execute: vi.fn().mockResolvedValue({ output: {}, trace: {} }),
    connectMcpServer: vi.fn().mockResolvedValue({ tools: [] }),
    disconnectMcpServer: vi.fn().mockResolvedValue(undefined),
    testMcpServer: vi.fn().mockResolvedValue({ reachable: true, latencyMs: 0, toolCount: 0 })
  } as unknown as ToolBroker;
}

// Build a single shared orchestrator for all performance tests to avoid the
// cost of re-discovering skills on every test case.
let sharedOrchestrator: AgentOrchestrator | undefined;

async function getOrchestrator(): Promise<AgentOrchestrator> {
  if (!sharedOrchestrator) {
    const registry = new SkillRegistry();
    await registry.discover(skillsBasePath);
    sharedOrchestrator = new AgentOrchestrator({
      modelCatalog: catalog,
      skillRegistry: registry,
      toolBroker: makeMockToolBroker()
    });
  }
  return sharedOrchestrator;
}

// ---------------------------------------------------------------------------
// Performance tests
// ---------------------------------------------------------------------------

describe("performance", { timeout: 10000 }, () => {
  describe("latency", () => {
    it("completes a simple auto-mode run under 500ms", async () => {
      const orchestrator = await getOrchestrator();

      const start = performance.now();
      const result = await orchestrator.run(baseRequest, twoRoleTemplate);
      const elapsed = performance.now() - start;

      expect(result.state.status).toBe("completed");
      expect(elapsed).toBeLessThan(500);
    });

    it("completes model routing for 5 roles under 100ms", () => {
      // Test the model routing algorithm directly for 5 roles — this is a
      // pure CPU computation that should be extremely fast.
      const { routeRoleModel } = require("@repo/model-router");

      const fiveRoles = Array.from({ length: 5 }, (_, i) => ({
        id: `role-${i}`,
        name: `Role ${i}`,
        objective: "Perform task",
        requiredCapabilities: ["tool-calling"]
      }));

      const profile = {
        complexity: "medium" as const,
        requiredCapabilities: ["tool-calling"],
        riskLevel: "low" as const
      };

      const start = performance.now();
      const decisions = fiveRoles.map((role) => routeRoleModel(role, profile, catalog));
      const elapsed = performance.now() - start;

      // Verify routing completed correctly
      expect(decisions).toHaveLength(5);
      // Elapsed must be well under 100ms
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe("throughput", () => {
    it("handles 10 concurrent runs without errors", async () => {
      const orchestrator = await getOrchestrator();

      const concurrentRuns = Array.from({ length: 10 }, (_, i) =>
        orchestrator.run(
          {
            ...baseRequest,
            projectId: `concurrent-proj-${i}`,
            title: `Concurrent run ${i}`
          },
          twoRoleTemplate
        )
      );

      const results = await Promise.all(concurrentRuns);

      // All runs must complete without throwing and reach a terminal status
      for (const result of results) {
        expect(["completed", "failed"]).toContain(result.state.status);
      }

      // Majority (at least 8 out of 10) should succeed
      const completed = results.filter((r) => r.state.status === "completed");
      expect(completed.length).toBeGreaterThanOrEqual(8);
    });

    it("handles 50 sequential runs without memory leak indicators", async () => {
      const orchestrator = await getOrchestrator();

      // Take a heap snapshot proxy: track the events array size across runs —
      // if state was leaking into subsequent runs the events arrays would grow.
      const eventCounts: number[] = [];

      for (let i = 0; i < 50; i++) {
        const result = await orchestrator.run(
          {
            ...baseRequest,
            projectId: `seq-proj-${i}`,
            title: `Sequential run ${i}`
          },
          twoRoleTemplate
        );
        eventCounts.push(result.state.events.length);
      }

      // Each run should produce a bounded, consistent number of events.
      // The first and last run should not differ by more than a factor of 3.
      const firstCount = eventCounts[0] ?? 0;
      const lastCount = eventCounts[eventCounts.length - 1] ?? 0;
      expect(lastCount).toBeLessThanOrEqual(firstCount * 3 + 5);

      // No run should produce an absurd number of events (memory growth proxy)
      for (const count of eventCounts) {
        expect(count).toBeLessThan(200);
      }
    });
  });

  describe("state size", () => {
    it("run state serializes to under 100KB for typical run", async () => {
      const orchestrator = await getOrchestrator();
      const result = await orchestrator.run(baseRequest, twoRoleTemplate);

      const serialized = JSON.stringify(result.state);
      const sizeBytes = Buffer.byteLength(serialized, "utf8");

      // 100 KB = 102400 bytes
      expect(sizeBytes).toBeLessThan(102400);
    });

    it("events array stays bounded for normal execution", async () => {
      const orchestrator = await getOrchestrator();
      const result = await orchestrator.run(baseRequest, twoRoleTemplate);

      // A normal run through the graph visits ~12 nodes, each emitting 1-2 events.
      // Max revision loops add at most 4 more (2 * planner + 2 * verifier extra).
      // Allow generous headroom but catch unbounded accumulation.
      expect(result.state.events.length).toBeGreaterThan(0);
      expect(result.state.events.length).toBeLessThan(60);
    });
  });
});

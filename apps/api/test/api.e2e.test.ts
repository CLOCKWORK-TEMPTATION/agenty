import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import WebSocket from "ws";

let app: FastifyInstance;
let runId: string;

beforeAll(async () => {
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/agents";
  app = await buildApp({ logger: false });
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

describe("api e2e", () => {
  it("creates draft, runs task, and fetches run", async () => {
    const draft = await app.inject({
      method: "POST",
      url: "/api/v1/team/draft",
      headers: { "x-role": "owner" },
      payload: {
        projectId: "project-1",
        userId: "user-1",
        title: "Implement feature",
        description: "Implement endpoint and tests",
        domain: "coding",
        approvalMode: "approval"
      }
    });

    expect(draft.statusCode).toBe(200);

    const run = await app.inject({
      method: "POST",
      url: "/api/v1/team/run",
      headers: { "x-role": "owner" },
      payload: {
        projectId: "project-1",
        userId: "user-1",
        title: "Implement feature",
        description: "Implement endpoint and tests",
        domain: "coding",
        approvalMode: "approval"
      }
    });

    expect(run.statusCode, `Unexpected /team/run response: ${run.body}`).toBe(200);
    const runBody = run.json<{ data: { runId: string } }>();
    runId = runBody.data.runId;

    const runDetails = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${runId}`
    });

    expect(runDetails.statusCode).toBe(200);
  });

  it("serves models, templates, skills, mcp, and a2a endpoints", async () => {
    const models = await app.inject({ method: "GET", url: "/api/v1/models/catalog" });
    expect(models.statusCode).toBe(200);

    const templates = await app.inject({ method: "GET", url: "/api/v1/templates" });
    expect(templates.statusCode).toBe(200);

    const skills = await app.inject({ method: "GET", url: "/api/v1/skills" });
    expect(skills.statusCode).toBe(200);

    const mcpCatalog = await app.inject({ method: "GET", url: "/api/v1/mcp/catalog" });
    expect(mcpCatalog.statusCode).toBe(200);

    const a2aAgents = await app.inject({ method: "GET", url: "/api/v1/a2a/agents" });
    expect(a2aAgents.statusCode).toBe(200);
  });

  it("persists runs across app restart", async () => {
    const run = await app.inject({
      method: "POST",
      url: "/api/v1/team/run",
      headers: { "x-role": "owner" },
      payload: {
        projectId: "project-persist",
        userId: "user-persist",
        title: "Persisted run",
        description: "Verify DB-backed run persistence",
        domain: "coding",
        approvalMode: "auto"
      }
    });

    expect(run.statusCode, `Unexpected /team/run response: ${run.body}`).toBe(200);
    const runBody = run.json<{ data: { runId: string } }>();
    const persistedRunId = runBody.data.runId;

    await app.close();
    app = await buildApp({ logger: false });

    const runDetails = await app.inject({
      method: "GET",
      url: `/api/v1/runs/${persistedRunId}`
    });

    expect(runDetails.statusCode).toBe(200);
  });

  it("streams run events over WebSocket in realtime", async () => {
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    expect(port).toBeGreaterThan(0);

    const run = await app.inject({
      method: "POST",
      url: "/api/v1/team/run",
      headers: { "x-role": "owner" },
      payload: {
        projectId: "project-ws",
        userId: "user-ws",
        title: "Realtime",
        description: "Validate websocket stream",
        domain: "coding",
        approvalMode: "auto"
      }
    });
    expect(run.statusCode).toBe(200);
    const runBody = run.json<{ data: { runId: string } }>();

    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/v1/runs/${runBody.data.runId}/ws`);

    const receivedEvent = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timed out waiting for websocket event"));
      }, 5000);

      socket.on("message", (raw) => {
        const payload = JSON.parse(raw.toString()) as { event?: string };
        if (payload.event && payload.event.includes("tool.demo.approved")) {
          clearTimeout(timeout);
          resolve(payload.event);
        }
      });

      socket.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      socket.on("open", async () => {
        await app.inject({
          method: "POST",
          url: `/api/v1/runs/${runBody.data.runId}/tool-approve`,
          headers: { "x-role": "owner" },
          payload: {
            toolName: "demo",
            approved: true,
            userId: "user-ws",
            projectId: "project-ws"
          }
        });
      });
    });

    expect(receivedEvent).toContain("tool.demo.approved");
    socket.close();
  });
});

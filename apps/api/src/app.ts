import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";
import { createDefaultGateway } from "@repo/a2a-gateway";
import { AgentOrchestrator } from "@repo/agent-core";
import { modelCatalog, defaultTemplates } from "./catalog.js";
import Fastify from "fastify";
import { AuditTrail } from "@repo/observability";
import { can, sanitizeForDlp, securityPlugin } from "@repo/security";
import { SkillRegistry } from "@repo/skills-engine";
import { createDefaultToolBroker } from "@repo/tool-broker";
import type { AppError, ArtifactMeta, McpServerConfig, TaskRequest, TeamTemplate } from "@repo/types";
import { getRoleFromRequest, makeTraceId, ok } from "./helpers.js";
import { createStore } from "./store.js";
import { z } from "zod";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { WebSocket } from "ws";

export interface AppOptions {
  logger?: boolean;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const skillsBasePath = resolve(__dirname, "..", "..", "..", "skills");

const taskSchema = z.object({
  projectId: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  domain: z.enum(["coding", "research", "content", "data", "operations"]),
  approvalMode: z.enum(["approval", "auto"]),
  metadata: z.record(z.unknown()).optional(),
  language: z.string().optional(),
  templateId: z.string().optional()
});

const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().min(1),
  domains: z.array(z.enum(["coding", "research", "content", "data", "operations"])),
  roles: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      objective: z.string().min(1),
      requiredCapabilities: z.array(z.string().min(1)),
      sensitiveTools: z.boolean().optional()
    })
  )
});

const mcpServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  transport: z.enum(["stdio", "http"]),
  endpoint: z.string().min(1),
  authType: z.enum(["none", "api_key", "oauth"]),
  enabled: z.boolean()
});

export const buildApp = async (options: AppOptions = {}) => {
  const app = Fastify({
    logger: options.logger ?? false
  });

  const audit = new AuditTrail();
  const skillRegistry = new SkillRegistry();
  await skillRegistry.discover(skillsBasePath);
  const toolBroker = createDefaultToolBroker();
  const orchestrator = new AgentOrchestrator({
    modelCatalog,
    skillRegistry,
    toolBroker
  });
  const a2aGateway = createDefaultGateway();
  const store = await createStore(defaultTemplates);
  const runEventSockets = new Map<string, Set<WebSocket>>();

  const removeRunSocket = (runId: string, socket: WebSocket) => {
    const sockets = runEventSockets.get(runId);
    if (!sockets) {
      return;
    }
    sockets.delete(socket);
    if (sockets.size === 0) {
      runEventSockets.delete(runId);
    }
  };

  const publishRunEvent = (runId: string, event: string) => {
    const sockets = runEventSockets.get(runId);
    if (!sockets || sockets.size === 0) {
      return;
    }

    const payload = JSON.stringify({
      event,
      ts: new Date().toISOString()
    });
    for (const socket of sockets) {
      if (socket.readyState === 1) {
        socket.send(payload);
      }
    }
  };

  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(websocket);
  await app.register(securityPlugin);

  app.setErrorHandler((error, _request, reply) => {
    const traceId = makeTraceId();
    const appError = error as AppError;
    const maybe = (appError as unknown as { toApiError?: () => unknown }).toApiError;
    if (typeof maybe === "function") {
      reply
        .status((appError as unknown as { statusCode?: number }).statusCode ?? 500)
        .send(maybe());
      return;
    }
    reply.status(500).send({
      error_code: "internal_error",
      message: "Unexpected server error",
      retryable: false,
      trace_id: traceId
    });
  });

  app.get("/health", async (_request, reply) => {
    ok(reply, makeTraceId(), { status: "ok" });
  });

  app.post("/api/v1/team/draft", async (request, reply) => {
    const traceId = makeTraceId();
    const parsed = taskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Invalid payload");
    }

    const role = getRoleFromRequest(request);
    if (
      !can(
        { userId: parsed.data.userId, roles: [role], projectId: parsed.data.projectId },
        "team:write"
      )
    ) {
      return reply.forbidden();
    }

    const draftId = `draft_${Date.now()}`;
    await store.createDraft({
      id: draftId,
      request: parsed.data,
      templateId: parsed.data.templateId ?? "coding-default",
      approved: false,
      createdAt: new Date().toISOString()
    });

    audit.append({
      eventId: draftId,
      actorId: parsed.data.userId,
      action: "team.draft.create",
      resource: parsed.data.projectId,
      outcome: "allow",
      createdAt: new Date().toISOString()
    });

    ok(reply, traceId, {
      draftId,
      approved: false,
      templateId: parsed.data.templateId ?? "coding-default"
    });
  });

  app.post("/api/v1/team/approve", async (request, reply) => {
    const traceId = makeTraceId();
    const body = z
      .object({
        draftId: z.string().min(1),
        userId: z.string().min(1),
        projectId: z.string().min(1)
      })
      .safeParse(request.body);
    if (!body.success) {
      return reply.badRequest("Invalid payload");
    }

    const role = getRoleFromRequest(request);
    if (
      !can(
        { userId: body.data.userId, roles: [role], projectId: body.data.projectId },
        "tool:approve"
      )
    ) {
      return reply.forbidden();
    }

    const draft = await store.approveDraft(body.data.draftId);
    if (!draft) {
      return reply.notFound("Draft not found");
    }

    ok(reply, traceId, { draftId: draft.id, approved: true });
  });

  app.post("/api/v1/team/run", async (request, reply) => {
    const traceId = makeTraceId();
    const parsed = taskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Invalid payload");
    }

    const cleanedDescription = sanitizeForDlp(parsed.data.description);
    const task: TaskRequest = {
      projectId: parsed.data.projectId,
      userId: parsed.data.userId,
      title: parsed.data.title,
      description: cleanedDescription,
      domain: parsed.data.domain,
      approvalMode: parsed.data.approvalMode
    };
    if (parsed.data.metadata) {
      task.metadata = parsed.data.metadata;
    }
    if (parsed.data.language) {
      task.language = parsed.data.language;
    }

    const templateId =
      parsed.data.templateId ??
      (parsed.data.domain === "research" ? "research-default" : "coding-default");
    const template = await store.getTemplate(templateId);
    if (!template) {
      return reply.notFound("Template not found");
    }

    const run = await orchestrator.run(task, template);
    const persistedRunState = {
      ...run.state,
      request: {
        ...run.state.request,
        metadata: {
          ...(run.state.request.metadata ?? {}),
          templateId
        }
      }
    };

    await store.upsertRun(persistedRunState);
    await store.replaceRunEvents(persistedRunState.runId, persistedRunState.events);
    for (const event of persistedRunState.events) {
      publishRunEvent(persistedRunState.runId, event);
    }
    await store.saveCheckpoint(
      persistedRunState.runId,
      {
        status: persistedRunState.status,
        revisionCount: persistedRunState.revisionCount
      },
      {
        reason: "run_created"
      }
    );

    ok(reply, traceId, {
      runId: persistedRunState.runId,
      status: persistedRunState.status,
      workflow: run.workflow,
      assignments: persistedRunState.assignments
    });
  });

  app.post("/api/v1/team/runs/:runId/resume", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ runId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.badRequest("Invalid run id");
    }
    const run = await store.getRun(params.data.runId);
    if (!run) {
      return reply.notFound("Run not found");
    }

    if (run.status === "waiting_approval") {
      const resumed = await orchestrator.resume(run.runId, { approved: true }, run.request);
      await store.upsertRun(resumed.state);
      await store.replaceRunEvents(resumed.state.runId, resumed.state.events);
      for (const event of resumed.state.events) {
        publishRunEvent(resumed.state.runId, event);
      }
      await store.saveCheckpoint(
        resumed.state.runId,
        {
          status: resumed.state.status,
          revisionCount: resumed.state.revisionCount
        },
        {
          reason: "run_resumed_approval"
        }
      );

      ok(reply, traceId, { runId: resumed.state.runId, status: resumed.state.status });
      return;
    }

    run.status = "running";
    run.events.push("run.resumed");
    run.updatedAt = new Date().toISOString();
    await store.upsertRun(run);
    await store.appendRunEvent(run.runId, "run.resumed");
    publishRunEvent(run.runId, "run.resumed");
    await store.saveCheckpoint(
      run.runId,
      {
        status: run.status,
        revisionCount: run.revisionCount
      },
      {
        reason: "run_resumed"
      }
    );
    ok(reply, traceId, { runId: run.runId, status: run.status });
  });

  app.get("/api/v1/runs/:runId", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ runId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.badRequest("Invalid run id");
    }
    const run = await store.getRun(params.data.runId);
    if (!run) {
      return reply.notFound("Run not found");
    }
    ok(reply, traceId, run);
  });

  // ---------------------------------------------------------------------------
  // Teams management
  // ---------------------------------------------------------------------------

  app.get("/api/v1/teams", async (request, reply) => {
    const traceId = makeTraceId();
    const query = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(20),
        status: z.enum(["active", "inactive", "draft"]).optional()
      })
      .safeParse(request.query);

    if (!query.success) {
      return reply.badRequest("Invalid query parameters");
    }

    const { page, limit, status } = query.data;
    const teams = await store.listTeams({ status, limit, offset: (page - 1) * limit });
    const total = await store.countTeams({ status });

    ok(reply, traceId, {
      items: teams,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  });

  app.get("/api/v1/teams/:teamId", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ teamId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.badRequest("Invalid team id");
    }

    const team = await store.getTeam(params.data.teamId);
    if (!team) {
      return reply.notFound("Team not found");
    }

    ok(reply, traceId, team);
  });

  // ---------------------------------------------------------------------------
  // Runs list with pagination
  // ---------------------------------------------------------------------------

  app.get("/api/v1/runs", async (request, reply) => {
    const traceId = makeTraceId();
    const query = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(20),
        status: z.enum(["draft", "running", "waiting_approval", "completed", "failed", "cancelled"]).optional(),
        teamId: z.string().optional(),
        projectId: z.string().optional()
      })
      .safeParse(request.query);

    if (!query.success) {
      return reply.badRequest("Invalid query parameters");
    }

    const { page, limit, status, teamId, projectId } = query.data;
    const runs = await store.listRuns({ status, teamId, projectId, limit, offset: (page - 1) * limit });
    const total = await store.countRuns({ status, teamId, projectId });

    ok(reply, traceId, {
      items: runs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  });

  // ---------------------------------------------------------------------------
  // Run actions (approve, cancel)
  // ---------------------------------------------------------------------------

  app.post("/api/v1/runs/:runId/approve", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ runId: z.string().min(1) }).safeParse(request.params);
    const body = z
      .object({
        userId: z.string().min(1),
        projectId: z.string().min(1),
        feedback: z.string().optional()
      })
      .safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.badRequest("Invalid payload");
    }

    const role = getRoleFromRequest(request);
    if (
      !can(
        { userId: body.data.userId, roles: [role], projectId: body.data.projectId },
        "run:approve"
      )
    ) {
      return reply.forbidden();
    }

    const run = await store.getRun(params.data.runId);
    if (!run) {
      return reply.notFound("Run not found");
    }

    if (run.status !== "waiting_approval") {
      return reply.badRequest("Run is not waiting for approval");
    }

    // Resume the run with approval
    const resumeValue: { approved: boolean; feedback?: string } = { approved: true };
    if (body.data.feedback) {
      resumeValue.feedback = body.data.feedback;
    }
    const resumed = await orchestrator.resume(run.runId, resumeValue, run.request);
    await store.upsertRun(resumed.state);
    await store.replaceRunEvents(resumed.state.runId, resumed.state.events);
    for (const event of resumed.state.events) {
      publishRunEvent(resumed.state.runId, event);
    }
    await store.saveCheckpoint(
      resumed.state.runId,
      {
        status: resumed.state.status,
        revisionCount: resumed.state.revisionCount
      },
      {
        reason: "run_approved",
        approvedBy: body.data.userId,
        feedback: body.data.feedback
      }
    );

    audit.append({
      eventId: `approve_${Date.now()}`,
      actorId: body.data.userId,
      action: "run.approve",
      resource: params.data.runId,
      outcome: "allow",
      createdAt: new Date().toISOString()
    });

    ok(reply, traceId, { runId: resumed.state.runId, status: resumed.state.status, approved: true });
  });

  app.post("/api/v1/runs/:runId/cancel", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ runId: z.string().min(1) }).safeParse(request.params);
    const body = z
      .object({
        userId: z.string().min(1),
        projectId: z.string().min(1),
        reason: z.string().optional()
      })
      .safeParse(request.body);

    if (!params.success || !body.success) {
      return reply.badRequest("Invalid payload");
    }

    const role = getRoleFromRequest(request);
    if (
      !can(
        { userId: body.data.userId, roles: [role], projectId: body.data.projectId },
        "run:cancel"
      )
    ) {
      return reply.forbidden();
    }

    const run = await store.getRun(params.data.runId);
    if (!run) {
      return reply.notFound("Run not found");
    }

    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      return reply.badRequest("Run is already in a terminal state");
    }

    run.status = "cancelled";
    run.events.push("run.cancelled");
    run.updatedAt = new Date().toISOString();
    if (body.data.reason) {
      run.request.metadata = { ...(run.request.metadata ?? {}), cancelReason: body.data.reason };
    }

    await store.upsertRun(run);
    await store.appendRunEvent(run.runId, "run.cancelled");
    publishRunEvent(run.runId, "run.cancelled");
    await store.saveCheckpoint(
      run.runId,
      {
        status: run.status,
        revisionCount: run.revisionCount
      },
      {
        reason: "run_cancelled",
        cancelledBy: body.data.userId,
        cancelReason: body.data.reason
      }
    );

    audit.append({
      eventId: `cancel_${Date.now()}`,
      actorId: body.data.userId,
      action: "run.cancel",
      resource: params.data.runId,
      outcome: "allow",
      createdAt: new Date().toISOString()
    });

    ok(reply, traceId, { runId: run.runId, status: run.status, cancelled: true });
  });

  app.get("/api/v1/runs/:runId/events", async (request, reply) => {
    const params = z.object({ runId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.badRequest("Invalid run id");
    }

    const events = await store.listRunEvents(params.data.runId);
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");

    for (const item of events) {
      reply.raw.write(`data: ${JSON.stringify({ event: item, ts: new Date().toISOString() })}\n\n`);
    }
    reply.raw.end();
    return reply;
  });

  app.get("/api/v1/runs/:runId/ws", { websocket: true }, async (socket, request) => {
    const params = z.object({ runId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      socket.send(
        JSON.stringify({
          error: "invalid_run_id"
        })
      );
      socket.close(1008, "Invalid run id");
      return;
    }

    const runId = params.data.runId;
    const sockets = runEventSockets.get(runId) ?? new Set<WebSocket>();
    sockets.add(socket);
    runEventSockets.set(runId, sockets);

    const backlog = await store.listRunEvents(runId);
    for (const event of backlog) {
      socket.send(
        JSON.stringify({
          event,
          ts: new Date().toISOString()
        })
      );
    }

    socket.on("close", () => {
      removeRunSocket(runId, socket);
    });

    socket.on("error", () => {
      removeRunSocket(runId, socket);
    });
  });

  app.post("/api/v1/runs/:runId/tool-approve", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ runId: z.string().min(1) }).safeParse(request.params);
    const body = z
      .object({
        toolName: z.string().min(1),
        approved: z.boolean(),
        userId: z.string().min(1),
        projectId: z.string().min(1)
      })
      .safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.badRequest("Invalid payload");
    }

    const role = getRoleFromRequest(request);
    if (
      !can(
        { userId: body.data.userId, roles: [role], projectId: body.data.projectId },
        "tool:approve"
      )
    ) {
      return reply.forbidden();
    }

    const run = await store.getRun(params.data.runId);
    if (!run) {
      return reply.notFound("Run not found");
    }
    const event = `tool.${body.data.toolName}.${body.data.approved ? "approved" : "rejected"}`;
    run.events.push(event);
    run.updatedAt = new Date().toISOString();
    await store.upsertRun(run);
    await store.appendRunEvent(run.runId, event);
    publishRunEvent(run.runId, event);
    await store.saveCheckpoint(
      run.runId,
      {
        status: run.status,
        revisionCount: run.revisionCount
      },
      {
        reason: "tool_approval",
        toolName: body.data.toolName,
        approved: body.data.approved
      }
    );

    ok(reply, traceId, {
      runId: params.data.runId,
      toolName: body.data.toolName,
      approved: body.data.approved
    });
  });

  app.get("/api/v1/models/catalog", async (_request, reply) => {
    ok(reply, makeTraceId(), { items: modelCatalog, total: modelCatalog.length });
  });

  app.get("/api/v1/templates", async (_request, reply) => {
    const items = await store.listTemplates();
    ok(reply, makeTraceId(), { items, total: items.length });
  });

  app.post("/api/v1/templates", async (request, reply) => {
    const traceId = makeTraceId();
    const parsed = templateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Invalid template payload");
    }
    await store.upsertTemplate(parsed.data as TeamTemplate);
    ok(reply, traceId, parsed.data);
  });

  app.put("/api/v1/templates/:id", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    const parsed = templateSchema.safeParse(request.body);
    if (!params.success || !parsed.success) {
      return reply.badRequest("Invalid payload");
    }
    if (params.data.id !== parsed.data.id) {
      return reply.badRequest("Template id mismatch");
    }
    await store.upsertTemplate(parsed.data as TeamTemplate);
    ok(reply, traceId, parsed.data);
  });

  app.get("/api/v1/skills", async (_request, reply) => {
    const items = skillRegistry.list();
    ok(reply, makeTraceId(), { items, total: items.length });
  });

  app.post("/api/v1/skills/install", async (request, reply) => {
    const body = z.object({ skillId: z.string().min(1) }).safeParse(request.body);
    if (!body.success) {
      return reply.badRequest("Invalid payload");
    }
    const skill = await skillRegistry.activate(body.data.skillId);
    ok(reply, makeTraceId(), {
      skillId: skill.id,
      category: skill.category,
      activated: true
    });
  });

  app.post("/api/v1/skills/reload", async (_request, reply) => {
    await skillRegistry.discover(skillsBasePath);
    ok(reply, makeTraceId(), { reloaded: true, total: skillRegistry.list().length });
  });

  app.get("/api/v1/mcp/catalog", async (_request, reply) => {
    ok(reply, makeTraceId(), {
      items: toolBroker.listCatalog(),
      total: toolBroker.listCatalog().length
    });
  });

  app.post("/api/v1/mcp/servers", async (request, reply) => {
    const parsed = mcpServerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Invalid payload");
    }
    await store.upsertMcpServer(parsed.data as McpServerConfig);
    ok(reply, makeTraceId(), parsed.data);
  });

  app.put("/api/v1/mcp/servers/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    const parsed = mcpServerSchema.safeParse(request.body);
    if (!params.success || !parsed.success) {
      return reply.badRequest("Invalid payload");
    }
    if (params.data.id !== parsed.data.id) {
      return reply.badRequest("MCP id mismatch");
    }
    await store.upsertMcpServer(parsed.data as McpServerConfig);
    ok(reply, makeTraceId(), parsed.data);
  });

  app.post("/api/v1/mcp/servers/:id/test", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.badRequest("Invalid id");
    }
    const server = await store.getMcpServer(params.data.id);
    if (!server) {
      return reply.notFound("Server not found");
    }
    ok(reply, makeTraceId(), {
      id: server.id,
      reachable: true,
      checkedAt: new Date().toISOString()
    });
  });

  app.post("/api/v1/a2a/tasks", async (request, reply) => {
    const body = z
      .object({
        requestId: z.string().min(1),
        sourceAgent: z.string().min(1),
        targetAgent: z.string().min(1),
        objective: z.string().min(1),
        payload: z.record(z.unknown())
      })
      .safeParse(request.body);
    if (!body.success) {
      return reply.badRequest("Invalid payload");
    }
    const result = await a2aGateway.submitTask(body.data);
    ok(reply, makeTraceId(), result);
  });

  app.get("/api/v1/a2a/agents", async (_request, reply) => {
    ok(reply, makeTraceId(), {
      items: a2aGateway.listCards(),
      total: a2aGateway.listCards().length
    });
  });

  app.post("/api/v1/integrations/slack/events", async (_request, reply) => {
    ok(reply, makeTraceId(), { accepted: true, provider: "slack" });
  });

  app.post("/api/v1/integrations/github/webhook", async (_request, reply) => {
    ok(reply, makeTraceId(), { accepted: true, provider: "github" });
  });

  // ---------------------------------------------------------------------------
  // Artifact management
  // ---------------------------------------------------------------------------

  const artifactUploadSchema = z.object({
    name: z.string().min(1).max(512),
    mimeType: z.string().min(1).max(256),
    content: z.string().min(1) // base64-encoded binary content
  });

  app.post("/api/v1/runs/:runId/artifacts", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ runId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.badRequest("Invalid run id");
    }

    const run = await store.getRun(params.data.runId);
    if (!run) {
      return reply.notFound("Run not found");
    }

    const parsed = artifactUploadSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Invalid artifact payload — expected { name, mimeType, content (base64) }");
    }

    let contentBuffer: Buffer;
    try {
      contentBuffer = Buffer.from(parsed.data.content, "base64");
    } catch {
      return reply.badRequest("content must be a valid base64 string");
    }

    const artifactId = `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const createdAt = new Date().toISOString();

    await store.saveArtifact({
      id: artifactId,
      runId: params.data.runId,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType,
      sizeBytes: contentBuffer.byteLength,
      content: contentBuffer,
      createdAt
    });

    const meta: ArtifactMeta = {
      id: artifactId,
      runId: params.data.runId,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType,
      sizeBytes: contentBuffer.byteLength,
      createdAt
    };

    ok(reply, traceId, meta);
  });

  app.get("/api/v1/runs/:runId/artifacts", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ runId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.badRequest("Invalid run id");
    }

    const run = await store.getRun(params.data.runId);
    if (!run) {
      return reply.notFound("Run not found");
    }

    const items = await store.listArtifacts(params.data.runId);
    ok(reply, traceId, { items, total: items.length });
  });

  app.get("/api/v1/artifacts/:id", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.badRequest("Invalid artifact id");
    }

    const artifact = await store.getArtifact(params.data.id);
    if (!artifact) {
      return reply.notFound("Artifact not found");
    }

    const meta: ArtifactMeta = {
      id: artifact.id,
      runId: artifact.runId,
      name: artifact.name,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
      createdAt: artifact.createdAt
    };

    ok(reply, traceId, meta);
  });

  app.get("/api/v1/artifacts/:id/download", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.badRequest("Invalid artifact id");
    }

    const artifact = await store.getArtifact(params.data.id);
    if (!artifact) {
      return reply.notFound("Artifact not found");
    }

    const safeName = artifact.name.replace(/[^\w.-]/g, "_");

    reply.raw.setHeader("Content-Type", artifact.mimeType);
    reply.raw.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}"`
    );
    reply.raw.setHeader("Content-Length", artifact.sizeBytes.toString());
    reply.raw.setHeader("Cache-Control", "private, max-age=3600");
    reply.raw.end(artifact.content);
    return reply;
  });

  app.delete("/api/v1/artifacts/:id", async (request, reply) => {
    const traceId = makeTraceId();
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) {
      return reply.badRequest("Invalid artifact id");
    }

    const deleted = await store.deleteArtifact(params.data.id);
    if (!deleted) {
      return reply.notFound("Artifact not found");
    }

    ok(reply, traceId, { deleted: true });
  });

  return app;
};

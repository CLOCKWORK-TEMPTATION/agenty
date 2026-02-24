/**
 * E2E Test Setup Utilities
 * Shared setup and helper functions for all E2E tests
 */

import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.js";
import type { TaskRequest, RunState } from "@repo/types";

export const E2E_TIMEOUT = 120000; // 2 minutes

export interface E2ETestContext {
  app: FastifyInstance;
  projectId: string;
  userId: string;
}

/**
 * Initialize E2E test context with Fastify app instance
 */
export const setupE2EContext = async (): Promise<E2ETestContext> => {
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/agents_test";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.LITELLM_API_BASE ??= "http://localhost:4001";

  const app = await buildApp({ logger: false });

  return {
    app,
    projectId: `e2e_project_${Date.now()}`,
    userId: `e2e_user_${Date.now()}`
  };
};

/**
 * Cleanup E2E test context
 */
export const teardownE2EContext = async (ctx: E2ETestContext): Promise<void> => {
  if (ctx.app) {
    await ctx.app.close();
  }
};

/**
 * Create a team draft
 */
export const createDraft = async (
  app: FastifyInstance,
  request: Partial<TaskRequest> & { projectId: string; userId: string }
): Promise<{ draftId: string; approved: boolean; templateId: string }> => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/team/draft",
    headers: { "x-role": "owner" },
    payload: {
      title: request.title ?? "E2E Test Task",
      description: request.description ?? "E2E test task description",
      domain: request.domain ?? "coding",
      approvalMode: request.approvalMode ?? "auto",
      ...request
    }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Draft creation failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ data: { draftId: string; approved: boolean; templateId: string } }>();
  return body.data;
};

/**
 * Approve a draft
 */
export const approveDraft = async (
  app: FastifyInstance,
  draftId: string,
  projectId: string,
  userId: string
): Promise<{ draftId: string; approved: boolean }> => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/team/approve",
    headers: { "x-role": "owner" },
    payload: { draftId, projectId, userId }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Draft approval failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ data: { draftId: string; approved: boolean } }>();
  return body.data;
};

/**
 * Run a team task
 */
export const runTeamTask = async (
  app: FastifyInstance,
  request: Partial<TaskRequest> & { projectId: string; userId: string }
): Promise<{ runId: string; status: string; workflow: string[]; assignments: unknown[] }> => {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/team/run",
    headers: { "x-role": "owner" },
    payload: {
      title: request.title ?? "E2E Test Task",
      description: request.description ?? "E2E test task description",
      domain: request.domain ?? "coding",
      approvalMode: request.approvalMode ?? "auto",
      ...request
    }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Team run failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ data: { runId: string; status: string; workflow: string[]; assignments: unknown[] } }>();
  return body.data;
};

/**
 * Get run details
 */
export const getRun = async (
  app: FastifyInstance,
  runId: string
): Promise<RunState> => {
  const response = await app.inject({
    method: "GET",
    url: `/api/v1/runs/${runId}`
  });

  if (response.statusCode !== 200) {
    throw new Error(`Get run failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ data: RunState }>();
  return body.data;
};

/**
 * Resume a run
 */
export const resumeRun = async (
  app: FastifyInstance,
  runId: string
): Promise<{ runId: string; status: string }> => {
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/team/runs/${runId}/resume`
  });

  if (response.statusCode !== 200) {
    throw new Error(`Resume run failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ data: { runId: string; status: string } }>();
  return body.data;
};

/**
 * Approve tool usage
 */
export const approveTool = async (
  app: FastifyInstance,
  runId: string,
  toolName: string,
  approved: boolean,
  projectId: string,
  userId: string
): Promise<{ runId: string; toolName: string; approved: boolean }> => {
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/runs/${runId}/tool-approve`,
    headers: { "x-role": "owner" },
    payload: { toolName, approved, projectId, userId }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Tool approval failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ data: { runId: string; toolName: string; approved: boolean } }>();
  return body.data;
};

/**
 * Get run events
 */
export const getRunEvents = async (
  app: FastifyInstance,
  runId: string
): Promise<string[]> => {
  const response = await app.inject({
    method: "GET",
    url: `/api/v1/runs/${runId}/events`
  });

  if (response.statusCode !== 200) {
    throw new Error(`Get events failed: ${response.statusCode} ${response.body}`);
  }

  const events: string[] = [];
  const lines = response.body.split('\n\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6)) as { event: string };
      events.push(data.event);
    }
  }
  return events;
};

/**
 * Wait for run to complete or reach specific status
 */
export const waitForRunStatus = async (
  app: FastifyInstance,
  runId: string,
  targetStatus: string,
  timeoutMs = 30000
): Promise<RunState> => {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const run = await getRun(app, runId);
    if (run.status === targetStatus) {
      return run;
    }

    // Wait 500ms before checking again
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Timeout waiting for run ${runId} to reach status ${targetStatus}`);
};

/**
 * Upload artifact to run
 */
export const uploadArtifact = async (
  app: FastifyInstance,
  runId: string,
  name: string,
  mimeType: string,
  content: string
): Promise<{ id: string; runId: string; name: string; mimeType: string; sizeBytes: number }> => {
  const response = await app.inject({
    method: "POST",
    url: `/api/v1/runs/${runId}/artifacts`,
    payload: { name, mimeType, content: Buffer.from(content).toString('base64') }
  });

  if (response.statusCode !== 200) {
    throw new Error(`Artifact upload failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ data: { id: string; runId: string; name: string; mimeType: string; sizeBytes: number } }>();
  return body.data;
};

/**
 * List artifacts for a run
 */
export const listArtifacts = async (
  app: FastifyInstance,
  runId: string
): Promise<Array<{ id: string; name: string; mimeType: string; sizeBytes: number }>> => {
  const response = await app.inject({
    method: "GET",
    url: `/api/v1/runs/${runId}/artifacts`
  });

  if (response.statusCode !== 200) {
    throw new Error(`List artifacts failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ data: { items: Array<{ id: string; name: string; mimeType: string; sizeBytes: number }> } }>();
  return body.data.items;
};

/**
 * Get model catalog
 */
export const getModelCatalog = async (
  app: FastifyInstance
): Promise<unknown[]> => {
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/models/catalog"
  });

  if (response.statusCode !== 200) {
    throw new Error(`Get model catalog failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<{ data: { items: unknown[] } }>();
  return body.data.items;
};

/**
 * Verify minimum model diversity (at least 2 different models)
 */
export const verifyModelDiversity = (assignments: Array<{ model: string }>): boolean => {
  const uniqueModels = new Set(assignments.map(a => a.model));
  return uniqueModels.size >= 2;
};

/**
 * Verify workflow graph order
 */
export const verifyWorkflowOrder = (workflow: string[]): boolean => {
  const expectedNodes = [
    'intake',
    'profile',
    'template_select',
    'team_design',
    'model_route',
    'tools_allocate',
    'skills_load',
    'approval_gate',
    'planner',
    'specialists_parallel',
    'tool_executor',
    'aggregate',
    'verifier',
    'finalizer'
  ];

  // Check that all expected nodes are present
  for (const node of expectedNodes) {
    if (!workflow.includes(node)) {
      return false;
    }
  }

  // Check that verifier comes before finalizer
  const verifierIndex = workflow.indexOf('verifier');
  const finalizerIndex = workflow.indexOf('finalizer');
  if (verifierIndex >= finalizerIndex) {
    return false;
  }

  return true;
};

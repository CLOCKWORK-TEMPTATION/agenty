/**
 * Typed API client for the multi-agent orchestration platform.
 * All paths proxy through Next.js rewrites to the Fastify API server.
 * Use NEXT_PUBLIC_API_URL for explicit client-side base (defaults to "" for proxy).
 */

import type {
  ArtifactMeta,
  RunState,
  TaskDomain,
  ApprovalMode,
  TeamTemplate,
  McpServerConfig,
  RoleAssignment,
} from "@repo/types";

// ---------------------------------------------------------------------------
// Base URL resolution
// ---------------------------------------------------------------------------

/** Resolved at runtime: empty string means requests go through Next.js rewrite proxy. */
const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "")
    : (process.env.API_INTERNAL_URL ?? "http://localhost:4000");

// ---------------------------------------------------------------------------
// Shared response envelope types
// ---------------------------------------------------------------------------

export interface ApiOk<T> {
  ok: true;
  data: T;
  trace_id?: string;
}

export interface ApiErr {
  ok: false;
  error_code: string;
  message: string;
  retryable: boolean;
  trace_id: string;
}

export type ApiResult<T> = ApiOk<T> | ApiErr;

export interface Paginated<T> {
  items: T[];
  total: number;
}

// ---------------------------------------------------------------------------
// Domain-specific data shapes returned by the API
// ---------------------------------------------------------------------------

export interface ModelItem {
  id: string;
  provider: string;
  quality: number;
  toolReliability: number;
  supportsTools: boolean;
  maxContextTokens: number;
}

export interface TemplateItem {
  id: string;
  name: string;
  version: string;
  description: string;
  domains: TaskDomain[];
}

export interface SkillItem {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface DraftData {
  draftId: string;
  approved: boolean;
  templateId: string;
}

export interface ApproveData {
  draftId: string;
  approved: boolean;
}

export interface RunData {
  runId: string;
  status: string;
  workflow: string;
  assignments: RoleAssignment[];
}

export interface ResumeData {
  runId: string;
  status: string;
}

export interface ToolApproveData {
  runId: string;
  toolName: string;
  approved: boolean;
}

export interface McpCatalogItem {
  id: string;
  name: string;
  description: string;
  transport: "stdio" | "http";
  endpoint: string;
}

export interface McpTestResult {
  id: string;
  reachable: boolean;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Request payload types
// ---------------------------------------------------------------------------

export interface CreateDraftPayload {
  projectId: string;
  userId: string;
  title: string;
  description: string;
  domain: TaskDomain;
  approvalMode: ApprovalMode;
  templateId?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface ApproveDraftPayload {
  draftId: string;
}

export interface RunTeamPayload {
  projectId: string;
  userId: string;
  title: string;
  description: string;
  domain: TaskDomain;
  approvalMode: ApprovalMode;
  templateId?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTemplatePayload {
  /** Optional: supply an explicit ID. If omitted the server generates one. */
  id?: string;
  name: string;
  version: string;
  description: string;
  domains: TaskDomain[];
  roles: Array<{
    id: string;
    name: string;
    objective: string;
    requiredCapabilities: string[];
    sensitiveTools?: boolean;
  }>;
}

export interface UpdateTemplatePayload extends Partial<CreateTemplatePayload> {}

export interface CreateMcpServerPayload {
  name: string;
  transport: "stdio" | "http";
  endpoint: string;
  authType: "none" | "api_key" | "oauth";
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  options?: RequestInit & { revalidate?: number | false }
): Promise<ApiResult<T>> {
  const { revalidate, ...fetchOptions } = options ?? {};

  const cacheOption: RequestInit =
    revalidate === false
      ? { cache: "no-store" }
      : revalidate !== undefined
        ? { next: { revalidate } } as RequestInit
        : { cache: "no-store" };

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...cacheOption,
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...(fetchOptions.headers ?? {}),
      },
    });

    const body = (await response.json()) as ApiResult<T>;

    if (!response.ok || !body.ok) {
      const errBody = body as ApiErr;
      return {
        ok: false,
        error_code: errBody.error_code ?? "HTTP_ERROR",
        message: errBody.message ?? `HTTP ${response.status}`,
        retryable: errBody.retryable ?? false,
        trace_id: errBody.trace_id ?? "",
      };
    }

    return body as ApiOk<T>;
  } catch (err) {
    return {
      ok: false,
      error_code: "NETWORK_ERROR",
      message: err instanceof Error ? err.message : "Network request failed",
      retryable: true,
      trace_id: "",
    };
  }
}

// ---------------------------------------------------------------------------
// Catalog / discovery
// ---------------------------------------------------------------------------

/** Fetch all models from the LiteLLM routing catalog. */
export function fetchModels(): Promise<ApiResult<Paginated<ModelItem>>> {
  return apiFetch<Paginated<ModelItem>>("/api/v1/models/catalog", {
    revalidate: 60,
  });
}

/** Fetch all team templates with version metadata. */
export function fetchTemplates(): Promise<ApiResult<Paginated<TemplateItem>>> {
  return apiFetch<Paginated<TemplateItem>>("/api/v1/templates", {
    revalidate: 30,
  });
}

/** Fetch all available agent skills. */
export function fetchSkills(): Promise<ApiResult<Paginated<SkillItem>>> {
  return apiFetch<Paginated<SkillItem>>("/api/v1/skills", {
    revalidate: 60,
  });
}

// ---------------------------------------------------------------------------
// Team lifecycle
// ---------------------------------------------------------------------------

/** Create a draft team configuration without executing it. */
export function createDraft(payload: CreateDraftPayload): Promise<ApiResult<DraftData>> {
  return apiFetch<DraftData>("/api/v1/team/draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Approve a draft so it can proceed to execution. */
export function approveDraft(payload: ApproveDraftPayload): Promise<ApiResult<ApproveData>> {
  return apiFetch<ApproveData>("/api/v1/team/approve", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Submit a task to the LangGraph pipeline and start a full team run.
 * Returns the runId used for all subsequent event/status calls.
 */
export function runTeam(payload: RunTeamPayload): Promise<ApiResult<RunData>> {
  return apiFetch<RunData>("/api/v1/team/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Run management
// ---------------------------------------------------------------------------

/** Fetch the current state snapshot for a run. */
export function fetchRun(runId: string): Promise<ApiResult<RunState>> {
  return apiFetch<RunState>(`/api/v1/runs/${runId}`, {
    cache: "no-store",
  });
}

/** Resume a paused run (e.g. after human_feedback gate approval). */
export function resumeRun(runId: string): Promise<ApiResult<ResumeData>> {
  return apiFetch<ResumeData>(`/api/v1/team/runs/${runId}/resume`, {
    method: "POST",
    body: JSON.stringify({ action: "approve" }),
  });
}

/**
 * Cancel a running run.
 * Implemented as a resume with a "cancel" action which transitions the
 * run to "failed" status via the graph's error path.
 */
export function cancelRun(runId: string): Promise<ApiResult<ResumeData>> {
  return apiFetch<ResumeData>(`/api/v1/team/runs/${runId}/resume`, {
    method: "POST",
    body: JSON.stringify({ action: "cancel" }),
  });
}

/**
 * Retry a failed run.
 * Resumes from the last checkpoint with a "retry" action so the graph
 * can attempt execution again.
 */
export function retryRun(runId: string): Promise<ApiResult<ResumeData>> {
  return apiFetch<ResumeData>(`/api/v1/team/runs/${runId}/resume`, {
    method: "POST",
    body: JSON.stringify({ action: "retry" }),
  });
}

// ---------------------------------------------------------------------------
// Tool approval
// ---------------------------------------------------------------------------

/**
 * Approve or reject a sensitive tool call that is waiting for human approval.
 */
export function approveToolCall(
  runId: string,
  toolName: string,
  userId: string,
  projectId: string,
  approved = true
): Promise<ApiResult<ToolApproveData>> {
  return apiFetch<ToolApproveData>(`/api/v1/runs/${runId}/tool-approve`, {
    method: "POST",
    body: JSON.stringify({ toolName, userId, projectId, approved }),
  });
}

// ---------------------------------------------------------------------------
// Template management
// ---------------------------------------------------------------------------

/** Create a new team template. */
export function createTemplate(
  payload: CreateTemplatePayload
): Promise<ApiResult<TeamTemplate>> {
  return apiFetch<TeamTemplate>("/api/v1/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Update an existing team template by ID. */
export function updateTemplate(
  id: string,
  payload: UpdateTemplatePayload
): Promise<ApiResult<TeamTemplate>> {
  return apiFetch<TeamTemplate>(`/api/v1/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** Delete a team template by ID. */
export function deleteTemplate(id: string): Promise<ApiResult<{ deleted: boolean }>> {
  return apiFetch<{ deleted: boolean }>(`/api/v1/templates/${id}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// MCP catalog and server management
// ---------------------------------------------------------------------------

/** Fetch available MCP tool catalog. */
export function fetchMcpCatalog(): Promise<
  ApiResult<Paginated<McpCatalogItem>>
> {
  return apiFetch<Paginated<McpCatalogItem>>("/api/v1/mcp/catalog", {
    revalidate: 30,
  });
}

/** Register a new MCP server. */
export function createMcpServer(
  payload: CreateMcpServerPayload
): Promise<ApiResult<McpServerConfig>> {
  return apiFetch<McpServerConfig>("/api/v1/mcp/servers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Test connectivity to an MCP server by ID. */
export function testMcpServer(id: string): Promise<ApiResult<McpTestResult>> {
  return apiFetch<McpTestResult>(`/api/v1/mcp/servers/${id}/test`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// ---------------------------------------------------------------------------
// Artifact management
// ---------------------------------------------------------------------------

export interface UploadArtifactPayload {
  name: string;
  mimeType: string;
  /** Base64-encoded binary content. */
  content: string;
}

/**
 * List artifacts (metadata only) for a specific run.
 * Returns a paginated envelope: { items: ArtifactMeta[], total: number }.
 */
export function fetchArtifacts(
  runId: string
): Promise<ApiResult<Paginated<ArtifactMeta>>> {
  return apiFetch<Paginated<ArtifactMeta>>(
    `/api/v1/runs/${runId}/artifacts`,
    { cache: "no-store" }
  );
}

/**
 * Returns the direct download URL for an artifact.
 * The URL resolves through the Next.js rewrite proxy to the API server.
 * Use this as an `href` on an anchor tag or via window.location.
 */
export function downloadArtifactUrl(id: string): string {
  return `${API_BASE}/api/v1/artifacts/${id}/download`;
}

/**
 * Upload an artifact for a run.
 * `content` must be a base64-encoded string of the raw file bytes.
 * Returns the ArtifactMeta of the newly created artifact.
 */
export function uploadArtifact(
  runId: string,
  payload: UploadArtifactPayload
): Promise<ApiResult<ArtifactMeta>> {
  return apiFetch<ArtifactMeta>(`/api/v1/runs/${runId}/artifacts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Delete an artifact by its ID.
 * Returns { deleted: true } on success.
 */
export function deleteArtifact(
  id: string
): Promise<ApiResult<{ deleted: boolean }>> {
  return apiFetch<{ deleted: boolean }>(`/api/v1/artifacts/${id}`, {
    method: "DELETE",
  });
}

import type { ArtifactMeta, McpServerConfig, RunState, TeamTemplate } from "@repo/types";
import type { Pool } from "pg";
import { ensureCoreSchema, getPool } from "./index.js";

export interface PersistedTeamDraft {
  id: string;
  request: Record<string, unknown>;
  templateId: string;
  approved: boolean;
  createdAt: string;
}

interface DraftRow {
  id: string;
  request: Record<string, unknown>;
  template_id: string;
  approved: boolean;
  created_at: Date;
}

interface RunRow {
  payload: RunState;
}

interface EventRow {
  payload: { event?: unknown };
  event_type: string;
}

interface TemplateRow {
  body: TeamTemplate;
}

interface McpRow {
  id: string;
  name: string;
  transport: "stdio" | "http";
  endpoint: string;
  auth_type: "none" | "api_key" | "oauth";
  enabled: boolean;
}

interface ArtifactRow {
  id: string;
  run_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  content: Buffer;
  created_at: Date;
}

interface ArtifactMetaRow {
  id: string;
  run_id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: Date;
}

export interface ArtifactRecord {
  id: string;
  runId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  content: Buffer;
  createdAt: string;
}

export class PostgresAppRepository {
  private readonly pool: Pool;

  private constructor(pool: Pool) {
    this.pool = pool;
  }

  public static async create(): Promise<PostgresAppRepository> {
    await ensureCoreSchema();
    return new PostgresAppRepository(getPool());
  }

  public async upsertTemplate(template: TeamTemplate): Promise<void> {
    await this.pool.query(
      `INSERT INTO templates (id, name, version, body)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id)
       DO UPDATE SET name = EXCLUDED.name, version = EXCLUDED.version, body = EXCLUDED.body`,
      [template.id, template.name, template.version, JSON.stringify(template)]
    );
  }

  public async listTemplates(): Promise<TeamTemplate[]> {
    const result = await this.pool.query<TemplateRow>(
      "SELECT body FROM templates ORDER BY created_at ASC"
    );
    return result.rows.map((row) => row.body);
  }

  public async getTemplate(templateId: string): Promise<TeamTemplate | null> {
    const result = await this.pool.query<TemplateRow>("SELECT body FROM templates WHERE id = $1", [templateId]);
    return result.rows[0]?.body ?? null;
  }

  public async createDraft(draft: PersistedTeamDraft): Promise<void> {
    await this.ensureActorProjectFromRequest(draft.request);
    const projectId = this.readString(draft.request, "projectId") ?? "project-default";
    const userId = this.readString(draft.request, "userId") ?? "user-default";

    await this.pool.query(
      `INSERT INTO team_drafts (id, project_id, user_id, template_id, request, approved, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::timestamptz, NOW())
       ON CONFLICT (id)
       DO UPDATE SET template_id = EXCLUDED.template_id,
                     request = EXCLUDED.request,
                     approved = EXCLUDED.approved,
                     updated_at = NOW()`,
      [
        draft.id,
        projectId,
        userId,
        draft.templateId,
        JSON.stringify(draft.request),
        draft.approved,
        draft.createdAt
      ]
    );
  }

  public async getDraft(draftId: string): Promise<PersistedTeamDraft | null> {
    const result = await this.pool.query<DraftRow>(
      `SELECT id, request, template_id, approved, created_at
       FROM team_drafts
       WHERE id = $1`,
      [draftId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      request: row.request,
      templateId: row.template_id,
      approved: row.approved,
      createdAt: row.created_at.toISOString()
    };
  }

  public async approveDraft(draftId: string): Promise<PersistedTeamDraft | null> {
    const result = await this.pool.query<DraftRow>(
      `UPDATE team_drafts
       SET approved = TRUE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, request, template_id, approved, created_at`,
      [draftId]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      request: row.request,
      templateId: row.template_id,
      approved: row.approved,
      createdAt: row.created_at.toISOString()
    };
  }

  public async upsertRun(run: RunState): Promise<void> {
    await this.ensureActorProject(run.request.userId, run.request.projectId);

    await this.pool.query(
      `INSERT INTO runs (id, project_id, user_id, status, payload, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET status = EXCLUDED.status,
                     payload = EXCLUDED.payload,
                     updated_at = NOW()`,
      [
        run.runId,
        run.request.projectId,
        run.request.userId,
        run.status,
        JSON.stringify(run)
      ]
    );
  }

  public async getRun(runId: string): Promise<RunState | null> {
    const result = await this.pool.query<RunRow>("SELECT payload FROM runs WHERE id = $1", [runId]);
    return result.rows[0]?.payload ?? null;
  }

  public async replaceRunEvents(runId: string, events: string[]): Promise<void> {
    await this.pool.query("DELETE FROM run_events WHERE run_id = $1", [runId]);

    for (const event of events) {
      await this.appendRunEvent(runId, event);
    }
  }

  public async appendRunEvent(runId: string, event: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO run_events (run_id, event_type, payload)
       VALUES ($1, $2, $3::jsonb)`,
      [runId, event, JSON.stringify({ event, ts: new Date().toISOString() })]
    );
  }

  public async listRunEvents(runId: string): Promise<string[]> {
    const result = await this.pool.query<EventRow>(
      `SELECT payload, event_type
       FROM run_events
       WHERE run_id = $1
       ORDER BY id ASC`,
      [runId]
    );

    return result.rows.map((row) => {
      const payloadEvent = row.payload?.event;
      if (typeof payloadEvent === "string") {
        return payloadEvent;
      }
      return row.event_type;
    });
  }

  public async saveCheckpoint(
    runId: string,
    state: Record<string, unknown>,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO run_checkpoints (run_id, state, metadata)
       VALUES ($1, $2::jsonb, $3::jsonb)`,
      [runId, JSON.stringify(state), JSON.stringify(metadata)]
    );
  }

  public async upsertMcpServer(config: McpServerConfig): Promise<void> {
    await this.pool.query(
      `INSERT INTO mcp_servers_registry (id, name, transport, endpoint, auth_type, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id)
       DO UPDATE SET name = EXCLUDED.name,
                     transport = EXCLUDED.transport,
                     endpoint = EXCLUDED.endpoint,
                     auth_type = EXCLUDED.auth_type,
                     enabled = EXCLUDED.enabled`,
      [config.id, config.name, config.transport, config.endpoint, config.authType, config.enabled]
    );
  }

  public async getMcpServer(id: string): Promise<McpServerConfig | null> {
    const result = await this.pool.query<McpRow>(
      `SELECT id, name, transport, endpoint, auth_type, enabled
       FROM mcp_servers_registry
       WHERE id = $1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      transport: row.transport,
      endpoint: row.endpoint,
      authType: row.auth_type,
      enabled: row.enabled
    };
  }

  public async saveArtifact(artifact: ArtifactRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO artifacts (id, run_id, name, mime_type, size_bytes, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
       ON CONFLICT (id)
       DO UPDATE SET name = EXCLUDED.name,
                     mime_type = EXCLUDED.mime_type,
                     size_bytes = EXCLUDED.size_bytes,
                     content = EXCLUDED.content`,
      [
        artifact.id,
        artifact.runId,
        artifact.name,
        artifact.mimeType,
        artifact.sizeBytes,
        artifact.content,
        artifact.createdAt
      ]
    );
  }

  public async getArtifact(id: string): Promise<ArtifactRecord | null> {
    const result = await this.pool.query<ArtifactRow>(
      `SELECT id, run_id, name, mime_type, size_bytes, content, created_at
       FROM artifacts
       WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      runId: row.run_id,
      name: row.name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      content: row.content,
      createdAt: row.created_at.toISOString()
    };
  }

  public async listArtifacts(runId: string): Promise<ArtifactMeta[]> {
    const result = await this.pool.query<ArtifactMetaRow>(
      `SELECT id, run_id, name, mime_type, size_bytes, created_at
       FROM artifacts
       WHERE run_id = $1
       ORDER BY created_at ASC`,
      [runId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      name: row.name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at.toISOString()
    }));
  }

  public async deleteArtifact(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM artifacts WHERE id = $1`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Runs list and count
  // ---------------------------------------------------------------------------

  public async listRuns(options: {
    status?: string | undefined;
    teamId?: string | undefined;
    projectId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<RunState[]> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    if (options.status) {
      conditions.push(`payload->>'status' = $${paramIdx++}`);
      params.push(options.status);
    }
    if (options.projectId) {
      conditions.push(`payload->'request'->>'projectId' = $${paramIdx++}`);
      params.push(options.projectId);
    }
    if (options.teamId) {
      conditions.push(`payload->'request'->'metadata'->>'templateId' = $${paramIdx++}`);
      params.push(options.teamId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitClause = options.limit ? `LIMIT $${paramIdx++}` : "";
    const offsetClause = options.offset ? `OFFSET $${paramIdx++}` : "";

    if (options.limit) params.push(options.limit);
    if (options.offset) params.push(options.offset);

    const result = await this.pool.query<RunRow>(
      `SELECT payload FROM runs ${whereClause} ORDER BY created_at DESC ${limitClause} ${offsetClause}`,
      params
    );
    return result.rows.map((row) => row.payload);
  }

  public async countRuns(options: {
    status?: string | undefined;
    teamId?: string | undefined;
    projectId?: string | undefined;
  }): Promise<number> {
    const conditions: string[] = [];
    const params: string[] = [];
    let paramIdx = 1;

    if (options.status) {
      conditions.push(`payload->>'status' = $${paramIdx++}`);
      params.push(options.status);
    }
    if (options.projectId) {
      conditions.push(`payload->'request'->>'projectId' = $${paramIdx++}`);
      params.push(options.projectId);
    }
    if (options.teamId) {
      conditions.push(`payload->'request'->'metadata'->>'templateId' = $${paramIdx++}`);
      params.push(options.teamId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM runs ${whereClause}`,
      params
    );
    return parseInt(result.rows[0]?.count ?? "0", 10);
  }

  // ---------------------------------------------------------------------------
  // Teams list and count
  // ---------------------------------------------------------------------------

  public async listTeams(options: {
    status?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Array<{
    id: string;
    name: string;
    description: string;
    status: "active" | "inactive" | "draft";
    templateId: string;
    projectId: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
  }>> {
    // For now, return teams from team_drafts as there's no dedicated teams table yet
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    // Map draft status to team status
    if (options.status) {
      if (options.status === "draft") {
        conditions.push(`approved = false`);
      } else if (options.status === "active") {
        conditions.push(`approved = true`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limitClause = options.limit ? `LIMIT $${paramIdx++}` : "";
    const offsetClause = options.offset ? `OFFSET $${paramIdx++}` : "";

    if (options.limit) params.push(options.limit);
    if (options.offset) params.push(options.offset);

    const result = await this.pool.query<{
      id: string;
      request: Record<string, unknown>;
      template_id: string;
      approved: boolean;
      created_at: Date;
    }>(
      `SELECT id, request, template_id, approved, created_at
       FROM team_drafts ${whereClause} ORDER BY created_at DESC ${limitClause} ${offsetClause}`,
      params
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: (row.request.title as string) ?? row.id,
      description: (row.request.description as string) ?? "",
      status: row.approved ? "active" : "draft" as "active" | "inactive" | "draft",
      templateId: row.template_id,
      projectId: (row.request.projectId as string) ?? "default",
      createdAt: row.created_at.toISOString(),
      updatedAt: row.created_at.toISOString(),
      metadata: (row.request.metadata as Record<string, unknown>) || undefined
    }));
  }

  public async countTeams(options: { status?: string | undefined }): Promise<number> {
    const conditions: string[] = [];

    if (options.status) {
      if (options.status === "draft") {
        conditions.push(`approved = false`);
      } else if (options.status === "active") {
        conditions.push(`approved = true`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM team_drafts ${whereClause}`
    );
    return parseInt(result.rows[0]?.count ?? "0", 10);
  }

  public async getTeam(teamId: string): Promise<{
    id: string;
    name: string;
    description: string;
    status: "active" | "inactive" | "draft";
    templateId: string;
    projectId: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
  } | null> {
    const result = await this.pool.query<{
      id: string;
      request: Record<string, unknown>;
      template_id: string;
      approved: boolean;
      created_at: Date;
    }>(
      `SELECT id, request, template_id, approved, created_at
       FROM team_drafts WHERE id = $1`,
      [teamId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      name: (row.request.title as string) ?? row.id,
      description: (row.request.description as string) ?? "",
      status: row.approved ? "active" : "draft" as "active" | "inactive" | "draft",
      templateId: row.template_id,
      projectId: (row.request.projectId as string) ?? "default",
      createdAt: row.created_at.toISOString(),
      updatedAt: row.created_at.toISOString(),
      metadata: (row.request.metadata as Record<string, unknown>) || undefined
    };
  }

  private async ensureActorProjectFromRequest(request: Record<string, unknown>): Promise<void> {
    const projectId = this.readString(request, "projectId");
    const userId = this.readString(request, "userId");

    if (!projectId || !userId) {
      return;
    }

    await this.ensureActorProject(userId, projectId);
  }

  private async ensureActorProject(userId: string, projectId: string): Promise<void> {

    await this.pool.query(
      `INSERT INTO users (id, email)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@local.invalid`]
    );

    await this.pool.query(
      `INSERT INTO projects (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [projectId, projectId]
    );
  }

  private readString(payload: Record<string, unknown>, key: string): string | null {
    const value = payload[key];
    return typeof value === "string" && value.length > 0 ? value : null;
  }
}

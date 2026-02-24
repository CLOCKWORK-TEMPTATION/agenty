import { PostgresAppRepository } from "@repo/db";
import type { ArtifactRecord } from "@repo/db";
import type { ArtifactMeta, McpServerConfig, RunState, TeamTemplate } from "@repo/types";

export interface TeamDraft {
  id: string;
  request: Record<string, unknown>;
  templateId: string;
  approved: boolean;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  status: "active" | "inactive" | "draft";
  templateId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ListOptions {
  status?: string | undefined;
  limit?: number;
  offset?: number;
  teamId?: string;
  projectId?: string;
}

export interface AppStore {
  createDraft(draft: TeamDraft): Promise<void>;
  getDraft(draftId: string): Promise<TeamDraft | null>;
  approveDraft(draftId: string): Promise<TeamDraft | null>;
  upsertRun(run: RunState): Promise<void>;
  getRun(runId: string): Promise<RunState | null>;
  listRuns(options: {
    status?: string | undefined;
    teamId?: string | undefined;
    projectId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<RunState[]>;
  countRuns(options: {
    status?: string | undefined;
    teamId?: string | undefined;
    projectId?: string | undefined;
  }): Promise<number>;
  replaceRunEvents(runId: string, events: string[]): Promise<void>;
  appendRunEvent(runId: string, event: string): Promise<void>;
  listRunEvents(runId: string): Promise<string[]>;
  saveCheckpoint(
    runId: string,
    state: Record<string, unknown>,
    metadata: Record<string, unknown>
  ): Promise<void>;
  upsertTemplate(template: TeamTemplate): Promise<void>;
  getTemplate(templateId: string): Promise<TeamTemplate | null>;
  listTemplates(): Promise<TeamTemplate[]>;
  upsertMcpServer(server: McpServerConfig): Promise<void>;
  getMcpServer(serverId: string): Promise<McpServerConfig | null>;
  saveArtifact(artifact: ArtifactRecord): Promise<void>;
  getArtifact(id: string): Promise<ArtifactRecord | null>;
  listArtifacts(runId: string): Promise<ArtifactMeta[]>;
  deleteArtifact(id: string): Promise<boolean>;
  // Teams
  listTeams(options: {
    status?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Team[]>;
  countTeams(options: { status?: string | undefined }): Promise<number>;
  getTeam(teamId: string): Promise<Team | null>;
}

class PostgresStore implements AppStore {
  private readonly repository: PostgresAppRepository;

  public constructor(repository: PostgresAppRepository) {
    this.repository = repository;
  }

  public async createDraft(draft: TeamDraft): Promise<void> {
    await this.repository.createDraft(draft);
  }

  public async getDraft(draftId: string): Promise<TeamDraft | null> {
    return this.repository.getDraft(draftId);
  }

  public async approveDraft(draftId: string): Promise<TeamDraft | null> {
    return this.repository.approveDraft(draftId);
  }

  public async upsertRun(run: RunState): Promise<void> {
    await this.repository.upsertRun(run);
  }

  public async getRun(runId: string): Promise<RunState | null> {
    return this.repository.getRun(runId);
  }

  public async replaceRunEvents(runId: string, events: string[]): Promise<void> {
    await this.repository.replaceRunEvents(runId, events);
  }

  public async appendRunEvent(runId: string, event: string): Promise<void> {
    await this.repository.appendRunEvent(runId, event);
  }

  public async listRunEvents(runId: string): Promise<string[]> {
    return this.repository.listRunEvents(runId);
  }

  public async saveCheckpoint(
    runId: string,
    state: Record<string, unknown>,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.repository.saveCheckpoint(runId, state, metadata);
  }

  public async upsertTemplate(template: TeamTemplate): Promise<void> {
    await this.repository.upsertTemplate(template);
  }

  public async getTemplate(templateId: string): Promise<TeamTemplate | null> {
    return this.repository.getTemplate(templateId);
  }

  public async listTemplates(): Promise<TeamTemplate[]> {
    return this.repository.listTemplates();
  }

  public async upsertMcpServer(server: McpServerConfig): Promise<void> {
    await this.repository.upsertMcpServer(server);
  }

  public async getMcpServer(serverId: string): Promise<McpServerConfig | null> {
    return this.repository.getMcpServer(serverId);
  }

  public async saveArtifact(artifact: ArtifactRecord): Promise<void> {
    await this.repository.saveArtifact(artifact);
  }

  public async getArtifact(id: string): Promise<ArtifactRecord | null> {
    return this.repository.getArtifact(id);
  }

  public async listArtifacts(runId: string): Promise<ArtifactMeta[]> {
    return this.repository.listArtifacts(runId);
  }

  public async deleteArtifact(id: string): Promise<boolean> {
    return this.repository.deleteArtifact(id);
  }

  public async listRuns(options: {
    status?: string | undefined;
    teamId?: string | undefined;
    projectId?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<RunState[]> {
    return this.repository.listRuns(options as { status?: string; teamId?: string; projectId?: string; limit?: number; offset?: number });
  }

  public async countRuns(options: {
    status?: string | undefined;
    teamId?: string | undefined;
    projectId?: string | undefined;
  }): Promise<number> {
    return this.repository.countRuns(options as { status?: string; teamId?: string; projectId?: string });
  }

  public async listTeams(options: {
    status?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<Team[]> {
    return this.repository.listTeams(options as { status?: string; limit?: number; offset?: number });
  }

  public async countTeams(options: { status?: string | undefined }): Promise<number> {
    return this.repository.countTeams(options as { status?: string });
  }

  public async getTeam(teamId: string): Promise<Team | null> {
    return this.repository.getTeam(teamId);
  }
}

export const createStore = async (defaultTemplates: TeamTemplate[]): Promise<AppStore> => {
  const repository = await PostgresAppRepository.create();
  for (const template of defaultTemplates) {
    await repository.upsertTemplate(template);
  }
  return new PostgresStore(repository);
};

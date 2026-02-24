import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { coreSchemaSql, PostgresAppRepository } from "../src/index.js";
import type { ArtifactRecord, PersistedTeamDraft } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  join(__dirname, "..", "migrations", "002_complete_schema.sql"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Schema content tests — no real database required
// ---------------------------------------------------------------------------

describe("db schema", () => {
  it("coreSchemaSql contains all required tables", () => {
    const requiredTables = [
      "users",
      "projects",
      "runs",
      "run_events",
      "run_checkpoints",
      "team_drafts",
      "templates",
      "skills_registry",
      "mcp_servers_registry",
      "audit_logs",
      "artifacts",
      "thread_messages",
      "memory_episodic",
      "memory_governance",
      "role_assignments",
      "model_decisions",
      "template_versions",
      "skill_activations",
      "mcp_tools_registry",
      "memory_semantic",
      "tool_calls_trace",
    ];

    for (const table of requiredTables) {
      expect(coreSchemaSql, `Expected table '${table}' in coreSchemaSql`).toContain(table);
    }
  });

  it("coreSchemaSql contains artifacts table", () => {
    expect(coreSchemaSql).toContain("CREATE TABLE IF NOT EXISTS artifacts");
    expect(coreSchemaSql).toContain("run_id");
    expect(coreSchemaSql).toContain("mime_type");
    expect(coreSchemaSql).toContain("size_bytes");
    expect(coreSchemaSql).toContain("BYTEA");
  });

  it("coreSchemaSql contains thread_messages table", () => {
    expect(coreSchemaSql).toContain("CREATE TABLE IF NOT EXISTS thread_messages");
    expect(coreSchemaSql).toContain("thread_id TEXT NOT NULL");
    expect(coreSchemaSql).toContain("role TEXT NOT NULL");
  });

  it("coreSchemaSql contains memory tables", () => {
    expect(coreSchemaSql).toContain("CREATE TABLE IF NOT EXISTS memory_episodic");
    expect(coreSchemaSql).toContain("CREATE TABLE IF NOT EXISTS memory_governance");
    expect(coreSchemaSql).toContain("CREATE TABLE IF NOT EXISTS memory_semantic");
    expect(coreSchemaSql).toContain("rule_body JSONB");
    expect(coreSchemaSql).toContain("rule_type");
    expect(coreSchemaSql).toContain("metadata JSONB");
  });

  it("coreSchemaSql contains role_assignments table", () => {
    expect(coreSchemaSql).toContain("CREATE TABLE IF NOT EXISTS role_assignments");
    expect(coreSchemaSql).toContain("agent_id");
    expect(coreSchemaSql).toContain("model TEXT NOT NULL");
    expect(coreSchemaSql).toContain("tools JSONB");
    expect(coreSchemaSql).toContain("skills JSONB");
  });

  it("coreSchemaSql contains model_decisions table", () => {
    expect(coreSchemaSql).toContain("CREATE TABLE IF NOT EXISTS model_decisions");
    expect(coreSchemaSql).toContain("selected_model");
    expect(coreSchemaSql).toContain("score FLOAT");
    expect(coreSchemaSql).toContain("candidates JSONB");
    expect(coreSchemaSql).toContain("fallback_chain JSONB");
  });

  it("coreSchemaSql contains template_versions table", () => {
    expect(coreSchemaSql).toContain("CREATE TABLE IF NOT EXISTS template_versions");
    expect(coreSchemaSql).toContain("template_id TEXT NOT NULL");
    expect(coreSchemaSql).toContain("body JSONB");
  });

  it("coreSchemaSql contains skill_activations table", () => {
    expect(coreSchemaSql).toContain("CREATE TABLE IF NOT EXISTS skill_activations");
    expect(coreSchemaSql).toContain("skill_id TEXT NOT NULL");
    expect(coreSchemaSql).toContain("reason TEXT NOT NULL");
  });

  it("coreSchemaSql contains mcp_tools_registry table", () => {
    expect(coreSchemaSql).toContain("CREATE TABLE IF NOT EXISTS mcp_tools_registry");
    expect(coreSchemaSql).toContain("server_id TEXT NOT NULL");
    expect(coreSchemaSql).toContain("input_schema JSONB");
    expect(coreSchemaSql).toContain("sensitive BOOLEAN");
  });

  it("coreSchemaSql includes pgvector extension reference", () => {
    // memory_semantic uses VECTOR(1536) which requires the pgvector extension.
    // migrate.ts issues CREATE EXTENSION IF NOT EXISTS vector before applying
    // coreSchemaSql; coreSchemaSql itself declares the embedding column with
    // VECTOR(1536).
    expect(coreSchemaSql).toContain("VECTOR(1536)");
    expect(coreSchemaSql).toContain("embedding");
  });
});

// ---------------------------------------------------------------------------
// Repository types tests — structural / compile-time guarantees
// ---------------------------------------------------------------------------

describe("repository types", () => {
  it("PostgresAppRepository is exported", () => {
    expect(PostgresAppRepository).toBeDefined();
    expect(typeof PostgresAppRepository).toBe("function");
  });

  it("PersistedTeamDraft type matches expected shape", () => {
    // Construct a value that satisfies the type — if the type changes
    // incompatibly this assignment will fail at the TypeScript level.
    const draft: PersistedTeamDraft = {
      id: "draft-1",
      request: { projectId: "proj-1", userId: "user-1" },
      templateId: "tmpl-1",
      approved: false,
      createdAt: new Date().toISOString(),
    };

    expect(draft.id).toBe("draft-1");
    expect(draft.templateId).toBe("tmpl-1");
    expect(typeof draft.approved).toBe("boolean");
    expect(typeof draft.createdAt).toBe("string");
  });

  it("ArtifactRecord type matches expected shape", () => {
    const artifact: ArtifactRecord = {
      id: "artifact-1",
      runId: "run-1",
      name: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      content: Buffer.from("data"),
      createdAt: new Date().toISOString(),
    };

    expect(artifact.id).toBe("artifact-1");
    expect(artifact.mimeType).toBe("application/pdf");
    expect(artifact.sizeBytes).toBe(1024);
    expect(Buffer.isBuffer(artifact.content)).toBe(true);
  });

  it("PostgresAppRepository exposes expected public methods", () => {
    const proto = PostgresAppRepository.prototype as Record<string, unknown>;
    const expectedMethods = [
      "upsertTemplate",
      "listTemplates",
      "getTemplate",
      "createDraft",
      "getDraft",
      "approveDraft",
      "upsertRun",
      "getRun",
      "appendRunEvent",
      "listRunEvents",
      "saveCheckpoint",
      "upsertMcpServer",
      "getMcpServer",
      "saveArtifact",
      "getArtifact",
      "listArtifacts",
      "deleteArtifact",
    ];

    for (const method of expectedMethods) {
      expect(
        typeof proto[method],
        `Expected method '${method}' on PostgresAppRepository`
      ).toBe("function");
    }
  });
});

// ---------------------------------------------------------------------------
// Migration 002 SQL file content tests
// ---------------------------------------------------------------------------

describe("migration 002 SQL file", () => {
  it("002 migration contains artifacts table", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS artifacts");
  });

  it("002 migration contains thread_messages table", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS thread_messages");
  });

  it("002 migration contains memory_episodic table", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS memory_episodic");
  });

  it("002 migration contains memory_governance table", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS memory_governance");
  });

  it("002 migration contains role_assignments table", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS role_assignments");
  });

  it("002 migration contains model_decisions table", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS model_decisions");
  });

  it("002 migration contains template_versions table", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS template_versions");
  });

  it("002 migration contains skill_activations table", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS skill_activations");
  });

  it("002 migration contains mcp_tools_registry table", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS mcp_tools_registry");
  });

  it("002 migration defines run_id indexes for fast lookup", () => {
    expect(migrationSql).toContain("idx_artifacts_run_id");
    expect(migrationSql).toContain("idx_role_assignments_run_id");
    expect(migrationSql).toContain("idx_model_decisions_run_id");
    expect(migrationSql).toContain("idx_skill_activations_run_id");
  });

  it("002 migration defines project_id indexes", () => {
    expect(migrationSql).toContain("idx_memory_episodic_project_id");
    expect(migrationSql).toContain("idx_memory_governance_project_id");
  });

  it("002 migration defines server_id index for mcp_tools_registry", () => {
    expect(migrationSql).toContain("idx_mcp_tools_registry_server_id");
  });

  it("002 migration defines template_id index for template_versions", () => {
    expect(migrationSql).toContain("idx_template_versions_template_id");
  });

  it("002 migration uses BYTEA for artifact content", () => {
    expect(migrationSql).toContain("BYTEA");
  });

  it("002 migration uses JSONB for structured data columns", () => {
    expect(migrationSql).toContain("JSONB");
  });

  it("002 migration uses TIMESTAMPTZ for all date columns", () => {
    expect(migrationSql).toContain("TIMESTAMPTZ");
  });

  it("002 migration uses BIGSERIAL for auto-increment IDs", () => {
    expect(migrationSql).toContain("BIGSERIAL");
  });

  it("002 migration uses FLOAT for model score column", () => {
    // The column is declared as "score  FLOAT" with alignment padding.
    expect(migrationSql).toContain("score");
    expect(migrationSql).toContain("FLOAT");
    // Verify score and FLOAT appear in the model_decisions block.
    expect(migrationSql).toMatch(/score\s+FLOAT/);
  });

  it("002 migration uses BOOLEAN for sensitive column", () => {
    // The column is declared as "sensitive  BOOLEAN" with alignment padding.
    expect(migrationSql).toContain("sensitive");
    expect(migrationSql).toContain("BOOLEAN");
    expect(migrationSql).toMatch(/sensitive\s+BOOLEAN/);
  });
});

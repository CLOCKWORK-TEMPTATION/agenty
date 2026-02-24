-- Migration 002: Complete schema — adds all tables from the production plan
-- that are not yet present in coreSchemaSql or 001_initial.sql

-- artifacts: binary outputs produced by a run (reports, files, images, etc.)
CREATE TABLE IF NOT EXISTS artifacts (
  id          BIGSERIAL    PRIMARY KEY,
  run_id      TEXT         NOT NULL,
  name        TEXT         NOT NULL,
  mime_type   TEXT         NOT NULL,
  size_bytes  BIGINT       NOT NULL DEFAULT 0,
  content     BYTEA,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_run_id ON artifacts (run_id);

-- thread_messages: multi-turn conversation messages linked to runs/threads
CREATE TABLE IF NOT EXISTS thread_messages (
  id          BIGSERIAL    PRIMARY KEY,
  thread_id   TEXT         NOT NULL,
  run_id      TEXT,
  role        TEXT         NOT NULL,
  content     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id ON thread_messages (thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_run_id    ON thread_messages (run_id);

-- memory_episodic: per-project episodic memories tied to specific runs
CREATE TABLE IF NOT EXISTS memory_episodic (
  id          BIGSERIAL    PRIMARY KEY,
  project_id  TEXT         NOT NULL,
  run_id      TEXT,
  content     TEXT         NOT NULL,
  metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_episodic_project_id ON memory_episodic (project_id);
CREATE INDEX IF NOT EXISTS idx_memory_episodic_run_id     ON memory_episodic (run_id);

-- memory_governance: project-level governance rules (compliance, policies)
CREATE TABLE IF NOT EXISTS memory_governance (
  id          BIGSERIAL    PRIMARY KEY,
  project_id  TEXT         NOT NULL,
  rule_type   TEXT         NOT NULL,
  rule_body   JSONB        NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_governance_project_id ON memory_governance (project_id);

-- role_assignments: which agent/model/tools/skills were assigned to each role in a run
CREATE TABLE IF NOT EXISTS role_assignments (
  id          BIGSERIAL    PRIMARY KEY,
  run_id      TEXT         NOT NULL,
  role_id     TEXT         NOT NULL,
  agent_id    TEXT         NOT NULL,
  model       TEXT         NOT NULL,
  tools       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  skills      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_assignments_run_id  ON role_assignments (run_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_role_id ON role_assignments (role_id);

-- model_decisions: quality-first model selection audit trail per role
CREATE TABLE IF NOT EXISTS model_decisions (
  id              BIGSERIAL    PRIMARY KEY,
  run_id          TEXT         NOT NULL,
  role_id         TEXT         NOT NULL,
  selected_model  TEXT         NOT NULL,
  score           FLOAT        NOT NULL,
  candidates      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  fallback_chain  JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_decisions_run_id  ON model_decisions (run_id);
CREATE INDEX IF NOT EXISTS idx_model_decisions_role_id ON model_decisions (role_id);

-- template_versions: versioned snapshots of team templates (immutable history)
CREATE TABLE IF NOT EXISTS template_versions (
  id           BIGSERIAL    PRIMARY KEY,
  template_id  TEXT         NOT NULL,
  version      TEXT         NOT NULL,
  body         JSONB        NOT NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, version)
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions (template_id);

-- skill_activations: record of which skills were activated for which roles in a run
CREATE TABLE IF NOT EXISTS skill_activations (
  id          BIGSERIAL    PRIMARY KEY,
  run_id      TEXT         NOT NULL,
  skill_id    TEXT         NOT NULL,
  role_id     TEXT         NOT NULL,
  reason      TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_activations_run_id   ON skill_activations (run_id);
CREATE INDEX IF NOT EXISTS idx_skill_activations_skill_id ON skill_activations (skill_id);

-- mcp_tools_registry: catalog of tools discovered from MCP servers
CREATE TABLE IF NOT EXISTS mcp_tools_registry (
  id            BIGSERIAL    PRIMARY KEY,
  server_id     TEXT         NOT NULL,
  name          TEXT         NOT NULL,
  description   TEXT         NOT NULL DEFAULT '',
  input_schema  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  sensitive     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (server_id, name)
);

CREATE INDEX IF NOT EXISTS idx_mcp_tools_registry_server_id ON mcp_tools_registry (server_id);

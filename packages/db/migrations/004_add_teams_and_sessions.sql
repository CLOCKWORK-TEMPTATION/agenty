-- Migration 004: Add teams and sessions tables
-- Creates dedicated tables for teams and sessions instead of using team_drafts as a proxy

-- teams: dedicated table for team management
CREATE TABLE IF NOT EXISTS teams (
  id          TEXT         PRIMARY KEY,
  name        TEXT         NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  status      TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'inactive', 'draft')),
  template_id TEXT         NOT NULL,
  project_id  TEXT         NOT NULL DEFAULT 'default',
  parent_team_id TEXT      REFERENCES teams(id) ON DELETE SET NULL,
  level       INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_teams_project_id ON teams (project_id);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams (status);
CREATE INDEX IF NOT EXISTS idx_teams_template_id ON teams (template_id);
CREATE INDEX IF NOT EXISTS idx_teams_parent_team_id ON teams (parent_team_id);

-- team_members: track team membership
CREATE TABLE IF NOT EXISTS team_members (
  id          BIGSERIAL    PRIMARY KEY,
  team_id     TEXT         NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id     TEXT         NOT NULL,
  role        TEXT         NOT NULL DEFAULT 'member',
  joined_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members (user_id);

-- sessions: user session management
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT         PRIMARY KEY,
  user_id     TEXT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id  TEXT         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status      TEXT         NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  team_id     TEXT         REFERENCES teams(id) ON DELETE SET NULL,
  context     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions (project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_team_id ON sessions (team_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions (started_at);

-- session_events: audit log for session activities
CREATE TABLE IF NOT EXISTS session_events (
  id          BIGSERIAL    PRIMARY KEY,
  session_id  TEXT         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  event_type  TEXT         NOT NULL,
  data        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events (session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_event_type ON session_events (event_type);
CREATE INDEX IF NOT EXISTS idx_session_events_created_at ON session_events (created_at);

-- Migration function to move existing team_drafts data to teams table
-- This is a one-time migration to preserve existing data
INSERT INTO teams (
  id,
  name,
  description,
  status,
  template_id,
  project_id,
  level,
  created_at,
  updated_at,
  metadata
)
SELECT 
  td.id,
  COALESCE(td.request->>'title', td.id) as name,
  COALESCE(td.request->>'description', '') as description,
  CASE 
    WHEN td.approved = true THEN 'active'
    ELSE 'draft'
  END as status,
  td.template_id,
  COALESCE(td.request->>'projectId', 'default') as project_id,
  0 as level,
  td.created_at,
  td.created_at as updated_at,
  COALESCE(td.request->'metadata', '{}')::jsonb as metadata
FROM team_drafts td
ON CONFLICT (id) DO NOTHING;

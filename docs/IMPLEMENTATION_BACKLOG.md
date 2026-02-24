# Implementation Backlog (Linked to Code)

## Epic 1 - Platform Foundation (`P0`) - Completed

1. Monorepo tooling and strict TypeScript

- Status: Completed
- Files: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.mjs`

2. Runtime and infrastructure bootstrap

- Status: Completed
- Files: `.env.example`, `docker-compose.yml`, `infra/litellm/config.yaml`, `infra/postgres/init.sql`, `infra/redis/redis.conf`

3. CI baseline

- Status: Completed
- Files: `.github/workflows/ci.yml`

## Epic 2 - Core Packages (`P0`) - Completed

1. Shared contracts and error model

- Status: Completed
- Files: `packages/types/src/index.ts`

2. Model routing (quality-first + diversity)

- Status: Completed
- Files: `packages/model-router/src/index.ts`, `packages/model-router/test/model-router.test.ts`

3. Tool broker (MCP-first + sensitive approval)

- Status: Completed
- Files: `packages/tool-broker/src/index.ts`, `packages/tool-broker/test/tool-broker.test.ts`

4. Skills engine (progressive disclosure)

- Status: Completed
- Files: `packages/skills-engine/src/index.ts`, `packages/skills-engine/test/skills-engine.test.ts`, `skills/core/*/SKILL.md`

5. Security and observability baseline

- Status: Completed
- Files: `packages/security/src/index.ts`, `packages/security/test/security.test.ts`, `packages/observability/src/index.ts`

6. Agent orchestration graph and verifier gate

- Status: Completed
- Files: `packages/agent-core/src/index.ts`, `packages/agent-core/test/agent-core.test.ts`

7. A2A gateway baseline

- Status: Completed
- Files: `packages/a2a-gateway/src/index.ts`, `packages/a2a-gateway/test/a2a-gateway.test.ts`

8. Database migration + seed

- Status: Completed
- Files: `packages/db/src/index.ts`, `packages/db/src/migrate.ts`, `packages/db/src/seed.ts`, `packages/db/migrations/001_initial.sql`

## Epic 3 - API (`P0`) - Completed

1. Fastify app with security + observability plugins

- Status: Completed
- Files: `apps/api/src/app.ts`, `apps/api/src/server.ts`

2. Team lifecycle endpoints

- Status: Completed
- Files: `apps/api/src/app.ts` (`/team/draft`, `/team/approve`, `/team/run`, `/team/runs/:runId/resume`)

3. Run monitoring and SSE

- Status: Completed
- Files: `apps/api/src/app.ts` (`/runs/:runId`, `/runs/:runId/events`, `/runs/:runId/tool-approve`)

4. Models/templates/skills/MCP/A2A/integrations APIs

- Status: Completed
- Files: `apps/api/src/app.ts` (all remaining `/api/v1/*` routes)

5. Integration tests

- Status: Completed
- Files: `apps/api/test/api.e2e.test.ts`

## Epic 4 - Web App (`P1`) - Completed

1. Next.js app router shell and responsive dashboard

- Status: Completed
- Files: `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/app/page.tsx`

2. Live API catalog rendering

- Status: Completed
- Files: `apps/web/app/page.tsx`

## Epic 5 - Operational Readiness (`P0`) - Completed

1. Operational runbook

- Status: Completed
- Files: `docs/OPERATIONS_RUNBOOK.md`

2. Template registry examples

- Status: Completed
- Files: `templates/coding-default.yaml`, `templates/research-default.yaml`

3. Plan compliance matrix

- Status: Completed
- Files: `docs/PLAN_ALIGNMENT.md`

## Pending (P2)

1. Real persistence for run lifecycle (replace in-memory API store with PostgreSQL repositories)

- Reason: current baseline is production-grade structure with in-memory runtime to keep startup simple.
- Target files: `apps/api/src/store.ts`, new repository layer in `packages/db`.

2. Full WebSocket streaming channel for run events (SSE already implemented)

- Target files: `apps/api/src/app.ts`, `apps/web` client realtime hooks.

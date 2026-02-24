# Multi-Model Agent Teams Platform

Production-ready multi-agent orchestration platform built with TypeScript, LangGraph, LiteLLM, and MCP. Automatically assembles agent teams, routes to optimal models per role (quality-first), dynamically activates tools and skills, with full governance, security, and enterprise integrations.

## Build & Test

- Install: `pnpm install`
- Build all: `pnpm run build`
- Build package: `pnpm --filter <package> run build`
- Type check: `pnpm run typecheck`
- Lint: `pnpm run lint`
- Lint fix: `pnpm run lint --fix`
- Format: `pnpm run format`
- Test all: `pnpm run test`
- Test single: `pnpm --filter <package> run test -- <path/to/file.test.ts>`
- Test watch: `pnpm --filter <package> run test -- --watch`
- E2E tests: `pnpm run test:e2e`
- Security tests: `pnpm run test:security`

## Run Locally

- Prerequisites: `docker compose up postgres redis litellm -d`
- DB migrate: `pnpm run db:migrate`
- DB seed: `pnpm run db:seed`
- API server: `pnpm --filter api run dev` (port 4000)
- Web app: `pnpm --filter web run dev` (port 3000)
- Full stack: `pnpm run dev`
- LiteLLM dashboard: `http://localhost:4001`
- LangSmith: configured via `LANGSMITH_API_KEY` env var

## Architecture Overview

This is a **pnpm monorepo** with two apps and ten packages following a layered architecture.

The **web app** is a Next.js frontend providing team draft preview, task dashboard, multi-turn conversations, workflow visualization, artifact management, and template marketplace. It communicates with the API via REST/SSE/WebSocket.

The **API server** is a Fastify BFF exposing 22 REST endpoints plus SSE event streams and WebSocket channels. It validates requests, enforces RBAC, and delegates orchestration to the agent-core package.

The **agent-core** package implements the LangGraph execution graph:
`START -> intake -> profile -> template_select -> team_design -> model_route -> tools_allocate -> skills_load -> approval_gate -> planner -> specialists_parallel -> tool_executor -> aggregate -> verifier -> human_feedback(optional) -> finalizer -> END`

The **model-router** selects models using a quality-first scoring formula: `score = quality(0.65) + tool_reliability(0.20) + capability_fit(0.10) + latency_reliability(0.05)`. Cost is never part of the score. Enforces minimum 2 different models per team. Each role has a fallback chain.

The **tool-broker** provides a unified tool layer: MCP tools first, then provider-native tools, then local sandbox tools. Uses Bigtool semantic selection when tool count is high. Sensitive tools (destructive DB ops, git push, external side effects) require human approval.

The **skills-engine** implements progressive disclosure: lightweight metadata always loaded, full SKILL.md loaded only on activation. Categories: Core, Shared, Coding, Research, Content, Data, Prebuilt.

The **a2a-gateway** exposes Agent Card endpoints for agent-to-agent federation via Google's A2A protocol.

The **observability** package integrates LangSmith natively plus OpenTelemetry for distributed tracing and audit events.

The **security** package handles RBAC, policy engine, encryption (KMS/Vault), DLP filters, rate limiting, and secrets management.

Infrastructure includes PostgreSQL+pgvector (main DB, vector search, graph checkpoints), Redis (prompt/semantic cache, BullMQ queues, distributed locks, pub/sub), LiteLLM gateway (routing pools, retries, guardrails), and BullMQ worker pools for async batch execution.

## Tech Stack

- Runtime: Node.js 20 LTS, TypeScript 5.5+ (strict mode)
- Monorepo: pnpm workspaces + Turborepo
- Frontend: Next.js 14+ (App Router), React 18+, Tailwind CSS, shadcn/ui
- Backend: Fastify 4+
- Agent Framework: LangGraph (TypeScript SDK)
- LLM Gateway: LiteLLM (self-hosted)
- Protocol: MCP (Model Context Protocol) for tools, A2A for federation
- Database: PostgreSQL 16 + pgvector extension
- Cache/Queue: Redis 7+ + BullMQ
- ORM/Query: Drizzle ORM (or Prisma — decide at init)
- Observability: LangSmith + OpenTelemetry
- Testing: Vitest + React Testing Library + Playwright (E2E)
- Containerization: Docker + Docker Compose (dev), Kubernetes + Helm (prod)
- CI/CD: GitHub Actions

## Code Conventions

- ES Modules only (`import/export`), no CommonJS
- Functional components with hooks, no class components
- Named exports preferred over default exports
- Separate type imports: `import type { TaskRequest } from '@repo/types'`
- No `any` — use `unknown` with type guards when type is uncertain
- Use `interface` for object shapes, `type` for unions/intersections
- Prefer `satisfies` over `as` for type assertions
- Naming: `camelCase` for variables/functions, `PascalCase` for components/types/interfaces, `SCREAMING_SNAKE` for constants
- File naming: `kebab-case.ts` for modules, `PascalCase.tsx` for React components
- Error handling: custom `AppError` class with `error_code`, `retryable`, `trace_id` — never throw raw strings
- All LangGraph nodes write only their authorized state keys
- All tool calls go through `tool_executor` node only — never bypass
- Verifier node always runs before Finalizer — no exceptions
- Revision loop max 2 iterations, then forced documented termination

## Monorepo Structure

```
root/
├── apps/
│   ├── web/                # Next.js frontend
│   └── api/                # Fastify BFF + REST/SSE/WebSocket
├── packages/
│   ├── agent-core/         # LangGraph graphs, orchestrators, nodes, HITL
│   ├── model-router/       # Quality-first routing + diversity + fallback
│   ├── tool-broker/        # MCP clients + provider-native adapters
│   ├── skills-engine/      # SkillRegistry + SkillActivator + SkillWatcher
│   ├── a2a-gateway/        # A2A endpoints + Agent Card + federation
│   ├── observability/      # LangSmith + OpenTelemetry + audit
│   ├── security/           # RBAC, policy, encryption, DLP, rate-limit
│   ├── types/              # Shared TypeScript types and interfaces
│   ├── db/                 # Drizzle schema, migrations, seed
│   └── config/             # Shared configs (ESLint, TSConfig, Tailwind)
├── infra/
│   ├── litellm/            # Gateway config, routing pools
│   ├── postgres/           # Init scripts, pgvector setup
│   ├── redis/              # Config
│   ├── workers/            # BullMQ pool configs
│   └── deploy/             # Docker, K8s, Helm, multi-cloud
├── skills/                 # Agent skill definitions (SKILL.md files)
├── templates/              # Team templates (YAML)
└── docker-compose.yml
```

## Database Schema (PostgreSQL)

Core tables: `users`, `teams`, `projects`, `sessions`, `runs`, `run_steps`, `run_events`, `run_checkpoints`, `team_drafts`, `role_assignments`, `model_decisions`, `templates`, `template_versions`, `template_marketplace`, `skills_registry`, `skill_versions`, `skill_activations`, `mcp_servers_registry`, `mcp_tools_registry`, `tool_calls_trace`, `artifacts`, `thread_messages`, `audit_logs`, `memory_episodic`, `memory_semantic` (pgvector), `memory_governance`.

## API Endpoints

22 public endpoints including:

- Team lifecycle: `POST /api/v1/team/draft`, `/approve`, `/run`, `/runs/:id/resume`
- Run monitoring: `GET /api/v1/runs/:id`, `/runs/:id/events` (SSE)
- Tool approval: `POST /api/v1/runs/:id/tool-approve`
- Models: `GET /api/v1/models/catalog`
- Templates: CRUD at `/api/v1/templates`
- Skills: `GET /api/v1/skills`, `POST /api/v1/skills/install`, `/reload`
- MCP: `GET /api/v1/mcp/catalog`, CRUD + test at `/api/v1/mcp/servers`
- A2A: `POST /api/v1/a2a/tasks`, `GET /api/v1/a2a/agents`
- Integrations: Slack events, GitHub webhooks

## Key Types

```typescript
// Core types to implement in packages/types/
(TaskRequest,
  TaskProfile,
  TeamTemplate,
  RoleBlueprint,
  RoleAssignment,
  ModelProfile,
  ModelDecision,
  ToolPolicy,
  SkillActivation,
  RunState,
  VerificationResult,
  RevisionDecision,
  ArtifactMeta,
  McpServerConfig,
  McpToolDescriptor,
  ToolExecutionTrace,
  A2ATaskRequest,
  A2ATaskResult,
  AgentCard,
  SecurityContext,
  RbacRole,
  PermissionMatrix,
  AuditEvent,
  ConversationThread,
  MessageEnvelope,
  ContextSnapshot,
  ApiError); // unified with error_code, retryable, trace_id
```

## Git Workflow

- Branch naming: `feat/description`, `fix/description`, `chore/description`
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`)
- PR title: same format as conventional commits
- Always rebase on main before merging
- Squash merge for feature branches
- Primary language for code: English (variables, comments, commits)
- Primary language for UI labels and documentation: Arabic with English support

## Boundaries

### Always Do

- Run type check after any code change: `pnpm run typecheck`
- Run tests for affected packages before committing
- Follow the LangGraph execution graph order — never skip nodes
- Route all tool executions through `tool_executor` node
- Run `verifier` before `finalizer` — always
- Enforce minimum 2 different models per team via model-router
- Use quality-first scoring — cost must never influence model selection
- Write migrations for any database schema change
- Add audit logging for security-sensitive operations
- Use environment variables for all secrets and configuration
- Validate all external inputs at API boundaries

### Ask First

- Adding new npm dependencies to any package
- Changing the LangGraph execution graph topology
- Modifying database schema or adding migrations
- Changing LiteLLM routing configuration
- Adding new MCP server integrations
- Modifying RBAC roles or permission matrices
- Changing Docker/K8s deployment configuration
- Deleting files, directories, or database tables
- Modifying CI/CD pipelines
- Adding new API endpoints

### Never Do

- Commit `.env` files, API keys, or secrets
- Use `any` type — use `unknown` with type guards
- Use `@ts-ignore` — use `@ts-expect-error` with explanation if absolutely needed
- Push directly to main branch
- Remove or skip failing tests instead of fixing them
- Add cost tracking or cost-based model selection (explicitly disabled by design)
- Bypass the `tool_executor` node for tool calls
- Skip the `verifier` node before `finalizer`
- Allow more than 2 revision loops without forced termination
- Store sensitive data unencrypted in the database
- Expose internal error details in API responses
- Modify generated files (Drizzle client, OpenAPI codegen)

## External Services & Integrations

- **LLM Providers**: via LiteLLM gateway (OpenAI, Anthropic, Google, Cohere, Mistral, etc.)
- **Search**: Tavily (primary), Exa/Firecrawl (fallback)
- **Code Execution**: E2B sandboxed environments + local isolated runners
- **MCP Servers**: GitHub, PostgreSQL, Filesystem, Playwright, Slack, Notion, Supabase
- **Observability**: LangSmith (native), OpenTelemetry (distributed tracing)
- **Collaboration**: Slack, Microsoft Teams
- **Dev Workflow**: GitHub, GitLab
- **Knowledge**: Notion, Confluence
- **PM**: Jira, Trello
- **Automation**: Zapier, Make
- **Cloud**: AWS, GCP, Azure deployment profiles

## Environment Variables

Required: `DATABASE_URL`, `REDIS_URL`, `LITELLM_API_BASE`, `LITELLM_MASTER_KEY`, `LANGSMITH_API_KEY`
Per-provider: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` (via LiteLLM)
Optional: `TAVILY_API_KEY`, `E2B_API_KEY`, `SLACK_BOT_TOKEN`, `GITHUB_TOKEN`
See `.env.example` for all variables with descriptions.

## Security

- RBAC with multi-role support and project/team separation
- Secrets and sensitive data encrypted via KMS/Vault
- Rate limiting + throttling + abuse controls on all API endpoints
- DLP filters before model and tool invocations
- Circuit breaker + exponential backoff retry + fallback plans
- Checkpoint persistence + resume + backup for disaster recovery
- Tamper-proof audit logging for all state-changing operations
- Input/output guardrails to prevent prompt injection
- `approval_gate` works in Approval and Auto modes with interrupt for sensitive tools

## Gotchas

- LangGraph checkpoint serialization requires all state values to be JSON-serializable — no class instances or functions in state
- LiteLLM routing pools must be configured before first API call — check `infra/litellm/config.yaml`
- pgvector extension must be created in PostgreSQL before running migrations: `CREATE EXTENSION IF NOT EXISTS vector`
- MCP servers using stdio transport must be spawned as child processes — handle lifecycle carefully
- BullMQ workers need separate process/container from the API server
- Next.js client-side env vars require `NEXT_PUBLIC_` prefix
- Server Components are default in App Router — add `'use client'` only when needed
- Redis connection must be established before BullMQ queue initialization
- Skill progressive disclosure: only load full SKILL.md on activation, not at startup
- The `approval_gate` node uses LangGraph `interrupt` — must handle resume correctly
- Template YAML validation happens at import time, not at runtime

## Implementation Phases

### Phase 1: Production Core

PostgreSQL+pgvector, Redis, LiteLLM, LangGraph parallel orchestration, checkpoints, MCP core, 21 core skills, RBAC, encryption, rate limiting, retries/circuit breaker, LangSmith, API core, Team Draft/Approval/Run.

### Phase 2: Scale & Productization

Semantic caching, worker pools, batch processing, dashboard, multi-turn, template customization, full docs API, audit logging, DLP, Slack/GitHub integrations, workflow visualization, artifact manager.

### Phase 3: Ecosystem Complete

A2A gateway, template marketplace, BYO MCP, hierarchical orchestration, Notion/Jira/Zapier integrations, Kubernetes/Helm, multi-cloud profiles, advanced UX (comparison, drag/drop, animations).

## PR Checklist

- [ ] Title follows conventional commit format
- [ ] Types are strict — no `any`, no `@ts-ignore`
- [ ] Tests added/updated for changed code
- [ ] Type check passes: `pnpm run typecheck`
- [ ] Lint passes: `pnpm run lint`
- [ ] No `console.log` statements in production code
- [ ] API changes update OpenAPI spec
- [ ] Database changes include migration
- [ ] Security-sensitive changes include audit logging
- [ ] No secrets or `.env` values committed

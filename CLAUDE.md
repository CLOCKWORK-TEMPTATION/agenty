# Multi-Model Agent Teams Platform

Production-ready multi-agent orchestration platform: TypeScript + LangGraph + LiteLLM + MCP.

## Quick Commands

- Install: `pnpm install`
- Build: `pnpm run build`
- Dev: `pnpm run dev` (starts API on 4000 + Web on 3000)
- Infra: `docker compose up postgres redis litellm -d`
- Migrate: `pnpm run db:migrate`
- Test: `pnpm run test`
- Test single: `pnpm --filter <package> run test -- <file.test.ts>`
- Typecheck: `pnpm run typecheck`
- Lint: `pnpm run lint`
- Lint fix: `pnpm run lint --fix`

## Project Context

This is a **pnpm monorepo** with `apps/` (web + api) and `packages/` (agent-core, model-router, tool-broker, skills-engine, a2a-gateway, observability, security, types, db, config). See AGENTS.md for full architecture details.

**Key design decisions:**

- Quality-first model selection: `score = quality(0.65) + tool_reliability(0.20) + capability_fit(0.10) + latency_reliability(0.05)` — cost is NEVER a factor
- No cost tracking anywhere in the product — this is intentional
- MCP tools take priority over provider-native tools
- Minimum 2 different models per agent team enforced
- LangGraph execution graph is fixed — verifier always before finalizer, max 2 revision loops

**LangGraph graph:**
`START -> intake -> profile -> template_select -> team_design -> model_route -> tools_allocate -> skills_load -> approval_gate -> planner -> specialists_parallel -> tool_executor -> aggregate -> verifier -> human_feedback(optional) -> finalizer -> END`

## Code Style

- TypeScript strict mode, ES Modules only
- `interface` for objects, `type` for unions/intersections
- `import type` for type-only imports
- Named exports, `kebab-case.ts` files, `PascalCase.tsx` components
- Custom `AppError` with `error_code`, `retryable`, `trace_id`
- No `any`, no `@ts-ignore`, no `console.log` in production

## Boundaries

**Always:** run typecheck after changes, write tests, follow graph order, route tools through `tool_executor`, run verifier before finalizer, validate external inputs

**Ask first:** new dependencies, graph topology changes, DB schema changes, LiteLLM config, new MCP servers, RBAC changes, deployment config, deleting files

**Never:** commit secrets/env, use `any`, push to main, skip failing tests, add cost tracking, bypass tool_executor, skip verifier, allow >2 revision loops, store unencrypted secrets

## Key Technical Notes

- LangGraph state must be JSON-serializable — no class instances
- pgvector extension required before migrations: `CREATE EXTENSION IF NOT EXISTS vector`
- MCP stdio servers need child process lifecycle management
- BullMQ workers run in separate process from API
- Next.js: `NEXT_PUBLIC_` prefix for client env vars, Server Components by default
- Skill loading: metadata always, full SKILL.md only on activation
- `approval_gate` uses LangGraph `interrupt` — handle resume correctly

## Language

- Code (variables, comments, commits): English
- UI labels and user-facing docs: Arabic primary, English supported

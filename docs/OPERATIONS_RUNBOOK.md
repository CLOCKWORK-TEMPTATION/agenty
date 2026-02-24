# Operations Runbook

## Local Startup

1. `docker compose up postgres redis litellm -d`
2. `pnpm install`
3. `pnpm run db:migrate`
4. `pnpm run db:seed`
5. `pnpm --filter @repo/api run dev`
6. `pnpm --filter @repo/web run dev`

## Health Checks

- API health: `GET /health`
- Model catalog: `GET /api/v1/models/catalog`
- Skills catalog: `GET /api/v1/skills`

## Security Controls

- RBAC checks through `packages/security/src/index.ts`
- Global Fastify Helmet and rate limiting plugin enabled
- DLP redaction before task run orchestration
- Sensitive tools require approval through `tool-approve` flow

## Observability

- Pino logger enabled in API runtime
- Audit trail events captured for sensitive operations
- Trace ID emitted in all successful API responses

## Incident Response

1. Stop traffic to API if authentication bypass is suspected.
2. Dump current `runEvents` and audit trail snapshot.
3. Restore from checkpoints once persistent checkpoint storage is enabled.
4. Rotate integration tokens in `.env` and secret manager.

## DR and Recovery

- PostgreSQL data persisted in docker volume `postgres_data`
- Redis uses AOF append-only mode
- Backup job should snapshot database volume + export templates and skill registry

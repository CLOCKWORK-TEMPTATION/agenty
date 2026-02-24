# Integration Tests

This directory contains integration tests for the Multi-Model Agent Teams Platform.

## Overview

Integration tests verify that different components of the system work correctly together with real services (PostgreSQL, Redis, LiteLLM).

## Test Structure

```
test/
├── integration/
│   ├── tool-broker/
│   │   └── mcp-e2e.test.ts           # MCP server integration
│   ├── db/
│   │   ├── postgres.test.ts          # PostgreSQL operations
│   │   ├── pgvector.test.ts          # Vector operations
│   │   ├── migrations.test.ts        # Database migrations
│   │   ├── transactions.test.ts      # Transaction handling
│   │   ├── checkpoints.test.ts       # LangGraph checkpoints
│   │   └── redis.test.ts             # Redis operations
│   ├── security/
│   │   └── rbac-e2e.test.ts          # RBAC with database
│   ├── model-router/
│   │   └── litellm-e2e.test.ts       # LiteLLM integration
│   └── api/
│       └── team-draft-flow.test.ts   # Complete workflows
└── integration-setup.ts              # Test environment setup
```

## Prerequisites

Before running integration tests, ensure the following services are running:

1. **PostgreSQL** (with pgvector extension)
2. **Redis**
3. **LiteLLM Proxy** (optional, tests will warn if unavailable)

## Running Tests

### 1. Start Required Services

```bash
docker compose up postgres redis litellm -d
```

Wait for services to be healthy:
```bash
docker compose ps
```

### 2. Run Integration Tests

```bash
# Run all integration tests
pnpm run test:integration

# Run in watch mode
pnpm run test:integration:watch

# Run specific test file
pnpm run test:integration packages/db/test/integration/postgres.test.ts
```

### 3. Stop Services

```bash
docker compose down
```

## Environment Variables

Integration tests use environment variables from `.env.test`:

- `POSTGRES_HOST` - PostgreSQL host (default: localhost)
- `POSTGRES_PORT` - PostgreSQL port (default: 5432)
- `POSTGRES_DB` - Test database name (default: agents_test)
- `POSTGRES_USER` - PostgreSQL user (default: postgres)
- `POSTGRES_PASSWORD` - PostgreSQL password (default: postgres)
- `REDIS_URL` - Redis connection URL
- `LITELLM_API_BASE` - LiteLLM proxy URL
- `LITELLM_MASTER_KEY` - LiteLLM API key

## Test Categories

### 1. MCP Integration Tests
Tests MCP protocol implementation:
- Handshake and capability exchange
- Tool discovery
- Tool execution with stdio servers
- Error recovery
- Server restart handling
- Multiple server management

### 2. Database Integration Tests

#### PostgreSQL Tests
- Connection management
- CRUD operations
- Advanced features (JSON, arrays, full-text search)
- Triggers and constraints
- Performance benchmarks

#### pgvector Tests
- Extension setup
- Vector operations (L2, cosine, inner product)
- Similarity search
- Index creation (IVFFlat, HNSW)
- High-dimensional vectors

#### Migration Tests
- Migration tracking
- Up/down execution
- Rollback on failure
- Schema versioning

#### Transaction Tests
- ACID properties
- Savepoints
- Deadlock detection
- Complex transactions

#### Checkpoint Tests
- LangGraph checkpoint persistence
- Checkpoint retrieval
- Checkpoint chains
- Resume from interrupts

### 3. Redis Integration Tests
- Prompt caching
- Semantic caching
- Distributed locks
- Pub/Sub messaging
- BullMQ queue simulation

### 4. Security Integration Tests
- RBAC with database
- User role management
- Permission checking
- Access control enforcement

### 5. LiteLLM Integration Tests
- Proxy connectivity
- Model routing
- Fallback chains
- Streaming responses

### 6. Pipeline Integration Tests
- Complete team draft workflow
- Approval gate interrupts
- Checkpoint resume
- Tool approval flow

## Best Practices

### Writing Integration Tests

1. **Use Real Services**: Integration tests should use real PostgreSQL, Redis, etc.
2. **Clean State**: Each test should clean up after itself
3. **Timeouts**: Set appropriate timeouts (30s default)
4. **Error Scenarios**: Test both success and failure cases
5. **Performance**: Include performance assertions where relevant

### Example Test

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client, Pool } from 'pg';

const TEST_TIMEOUT = 30000;

describe('My Integration Test', () => {
  let pool: Pool;
  let client: Client;

  beforeAll(async () => {
    pool = new Pool(getTestConfig());
    client = await pool.connect();
    // Setup test data
  }, { timeout: TEST_TIMEOUT });

  afterAll(async () => {
    // Cleanup
    if (client) client.release();
    if (pool) await pool.end();
  });

  it('should test something', async () => {
    const result = await client.query('SELECT 1');
    expect(result.rows[0]).toBeDefined();
  }, { timeout: TEST_TIMEOUT });
});
```

## Troubleshooting

### Services Not Ready
If tests fail with connection errors, ensure services are running:
```bash
docker compose ps
docker compose logs postgres
docker compose logs redis
```

### Database Already Exists
If you get "database already exists" errors:
```bash
docker compose down -v
docker compose up postgres redis -d
```

### Port Conflicts
Ensure ports 5432, 6379, and 4001 are available:
```bash
lsof -i :5432
lsof -i :6379
lsof -i :4001
```

### Slow Tests
Integration tests are slower than unit tests due to real I/O. This is expected.
Consider running them in CI or before commits, not on every save.

## CI/CD Integration

Integration tests should run in CI pipeline:

```yaml
# GitHub Actions example
- name: Start services
  run: docker compose up postgres redis litellm -d

- name: Wait for services
  run: |
    timeout 60 bash -c 'until docker compose exec postgres pg_isready; do sleep 1; done'
    timeout 60 bash -c 'until docker compose exec redis redis-cli ping; do sleep 1; done'

- name: Run integration tests
  run: pnpm run test:integration

- name: Stop services
  if: always()
  run: docker compose down -v
```

## Performance Benchmarks

Integration tests include performance assertions:
- Bulk inserts should complete in < 5s
- Vector searches should complete in < 1s
- Cache operations should complete in < 100ms
- Transaction throughput should handle 100 ops/s

## Contributing

When adding new integration tests:

1. Follow existing test structure
2. Use appropriate timeouts
3. Clean up resources
4. Document test purpose
5. Include both success and failure cases
6. Add performance assertions where relevant

## License

Same as main project.

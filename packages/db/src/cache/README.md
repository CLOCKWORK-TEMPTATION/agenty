# Semantic Cache

A production-ready semantic caching system for LLM responses using pgvector and Redis.

## Features

- **Semantic Similarity Search**: Uses pgvector to find similar prompts based on embedding similarity
- **Hot Cache with Redis**: Frequently accessed entries cached in Redis for ultra-fast retrieval
- **Configurable Policies**: Customize similarity thresholds, TTL, cache size, and more
- **Automatic Cleanup**: Expired entries automatically removed on schedule
- **Comprehensive Metrics**: Track hit rates, latency, cache size, and more
- **Model-specific Caching**: Cache entries per model with separate invalidation
- **Type-safe**: Full TypeScript support with strict typing

## Architecture

```
┌─────────────────┐
│  LiteLLM Client │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ SemanticCacheInterceptor│
└────────┬────────────────┘
         │
         ├─────────► [Cache Hit] ──► Return cached response
         │
         ▼
    [Cache Miss]
         │
         ├─────────► Call LLM API
         │
         ▼
    Store response in cache
         │
         ├─────────► Redis (Hot Cache)
         └─────────► pgvector (Persistent Cache)
```

## Quick Start

### 1. Enable pgvector Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Run Migration

```bash
pnpm run db:migrate
```

This creates the `semantic_cache` table with vector indexes.

### 3. Configure Environment

```env
SEMANTIC_CACHE_ENABLED=true
SEMANTIC_CACHE_SIMILARITY_THRESHOLD=0.95
SEMANTIC_CACHE_TTL_SECONDS=3600
SEMANTIC_CACHE_MAX_SIZE=10000
EMBEDDING_SERVICE_URL=https://api.openai.com/v1/embeddings
EMBEDDING_MODEL=text-embedding-ada-002
```

### 4. Initialize Cache

```typescript
import { getPool } from "@repo/db";
import Redis from "ioredis";
import {
  SemanticCache,
  RedisCache,
  CacheManager,
  EmbeddingService,
  createCachePolicy
} from "@repo/db/cache";
import { SemanticCacheInterceptor } from "@repo/model-router";

// Create embedding service
const embeddingService = new EmbeddingService({
  serviceUrl: process.env.EMBEDDING_SERVICE_URL!,
  apiKey: process.env.OPENAI_API_KEY!,
  model: "text-embedding-ada-002"
});

// Create cache policy
const policy = createCachePolicy({
  similarityThreshold: 0.95,
  ttlSeconds: 3600,
  maxSize: 10000
});

// Create Redis cache
const redis = new Redis(process.env.REDIS_URL!);
const redisCache = new RedisCache({
  redis,
  maxSize: 1000
});

// Create semantic cache
const pool = getPool();
const semanticCache = new SemanticCache(
  pool,
  embeddingService,
  policy,
  redis,
  redisCache
);

// Create cache manager
const cacheManager = new CacheManager(
  semanticCache,
  policy,
  redisCache
);

// Start auto cleanup
cacheManager.startAutoCleanup();

// Create cache interceptor
const cacheInterceptor = new SemanticCacheInterceptor({
  cache: semanticCache,
  enableLogging: true
});
```

### 5. Use with LiteLLM Client

```typescript
import { LiteLLMClient } from "@repo/model-router";

const client = new LiteLLMClient(
  {
    baseUrl: process.env.LITELLM_API_BASE,
    apiKey: process.env.LITELLM_MASTER_KEY
  },
  cacheInterceptor // Pass interceptor here
);

// Make requests - cache is automatically checked
const response = await client.chatCompletion({
  model: "gpt-4",
  messages: [
    { role: "user", content: "What is the capital of France?" }
  ]
});
```

## API Usage

### Store Cache Entry

```typescript
await semanticCache.set({
  promptText: "What is the capital of France?",
  responseText: "Paris is the capital of France.",
  responseMetadata: {
    model: "gpt-4",
    finishReason: "stop",
    usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
  },
  model: "gpt-4",
  ttlSeconds: 3600 // Optional, uses policy default if not provided
});
```

### Lookup Cache Entry

```typescript
const result = await semanticCache.lookup(
  "What is France's capital city?", // Similar but not identical
  "gpt-4"
);

if (result.hit) {
  console.log("Cache hit!");
  console.log("Response:", result.entry.responseText);
  console.log("Similarity:", result.similarity);
  console.log("Source:", result.source); // "redis" or "pgvector"
}
```

### Invalidate Cache

```typescript
// Invalidate by model
const count = await semanticCache.invalidateByModel("gpt-4");

// Invalidate all
const totalCount = await semanticCache.invalidateAll();

// Cleanup expired
const expiredCount = await semanticCache.cleanupExpired();
```

### Get Statistics

```typescript
const stats = await cacheManager.getStatistics();

console.log("Overall hit rate:", stats.overall.hitRate);
console.log("Total entries:", stats.pgvector.totalEntries);
console.log("Avg latency:", stats.overall.avgLatencyMs);
```

### Health Check

```typescript
const health = await cacheManager.checkHealth();

if (!health.healthy) {
  console.error("Cache issues:", health.issues);
}
```

## Cache Policy Configuration

```typescript
import { createCachePolicy } from "@repo/db/cache";

const policy = createCachePolicy({
  // Minimum similarity for cache hit (0-1)
  similarityThreshold: 0.95,

  // TTL in seconds
  ttlSeconds: 3600,

  // Maximum cache entries
  maxSize: 10000,

  // Enable Redis hot cache
  enableHotCache: true,

  // Hot cache size
  hotCacheSize: 1000,

  // Enable automatic cleanup
  enableAutoCleanup: true,

  // Cleanup interval (ms)
  cleanupIntervalMs: 300000,

  // Exclude specific models
  excludedModels: ["gpt-3.5-turbo"],

  // Min/max prompt length
  minPromptLength: 10,
  maxPromptLength: 10000
});
```

## Admin Dashboard

Access the cache admin dashboard at `/admin/cache`:

- View real-time statistics
- Monitor cache health
- Invalidate cache entries
- Trigger manual cleanup
- Warm up Redis cache
- View top cached prompts

## API Endpoints

### GET /api/v1/cache/stats
Get comprehensive cache statistics.

### POST /api/v1/cache/invalidate
Invalidate cache entries.

**Body:**
```json
{
  "model": "gpt-4",  // Invalidate specific model
  "all": true        // Or invalidate all
}
```

### POST /api/v1/cache/cleanup
Manually trigger cleanup of expired entries.

### POST /api/v1/cache/warm
Warm up Redis cache from pgvector.

### GET /api/v1/cache/health
Check cache health status.

### GET /api/v1/cache/top-prompts?limit=10
Get top cached prompts.

### GET /api/v1/cache/hits/:modelId
Get cache hits for a specific model.

## Performance Considerations

### Similarity Threshold

- **0.99-1.0**: Very strict - only nearly identical prompts match
- **0.95-0.98**: Recommended - semantically similar prompts match
- **0.90-0.94**: Loose - broader matches, higher hit rate but less precise
- **< 0.90**: Too loose - may return irrelevant cached responses

### Cache Size

- **pgvector**: Larger cache = more storage but better hit rate
- **Redis**: Limited by memory - keep hot cache size reasonable (1000-5000)

### Cleanup Interval

- **Frequent (1-5 min)**: Lower memory usage, more DB load
- **Moderate (5-15 min)**: Balanced approach (recommended)
- **Infrequent (>15 min)**: Less DB load, higher memory usage

## Monitoring

### Key Metrics

- **Hit Rate**: Percentage of requests served from cache
- **Avg Latency**: Time to lookup + retrieve from cache
- **Cache Size**: Total entries and memory usage
- **Eviction Rate**: How often entries are removed
- **Model Distribution**: Which models are cached most

### Alerts

Consider alerting on:
- Hit rate drops below threshold (e.g., < 10%)
- Cache size exceeds limit
- High number of expired entries
- Frequent cache errors

## Troubleshooting

### Low Hit Rate

- Decrease similarity threshold (0.95 → 0.90)
- Increase TTL to keep entries longer
- Check if prompts are too varied
- Verify embedding service is working

### High Memory Usage

- Decrease cache max size
- Reduce hot cache size
- Increase cleanup frequency
- Lower TTL to expire entries faster

### Slow Lookups

- Ensure pgvector indexes are created
- Check Redis connection
- Monitor embedding service latency
- Consider increasing hot cache size

### Cache Not Working

- Verify pgvector extension is installed
- Check database migrations ran successfully
- Ensure Redis is running and accessible
- Verify embedding service credentials
- Check SEMANTIC_CACHE_ENABLED=true

## Best Practices

1. **Start Conservative**: Begin with high similarity threshold (0.95) and adjust based on hit rate
2. **Monitor Metrics**: Track hit rate and latency to optimize configuration
3. **Use Model-Specific TTLs**: Different models may benefit from different cache durations
4. **Exclude Sensitive Prompts**: Don't cache prompts with PII or sensitive data
5. **Warm Up Cache**: Pre-populate cache with common queries
6. **Regular Cleanup**: Enable auto-cleanup to prevent stale entries
7. **Test Thoroughly**: Verify cache behavior in staging before production

## License

MIT

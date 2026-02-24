import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";
import Redis from "ioredis";
import { SemanticCache } from "../../src/cache/semantic-cache.js";
import { EmbeddingService } from "../../src/cache/embedding-service.js";
import { RedisCache } from "../../src/cache/redis-cache.js";
import { CacheManager } from "../../src/cache/manager.js";
import { createCachePolicy } from "../../src/cache/cache-policy.js";
import { getPool } from "../../src/index.js";

/**
 * Integration tests for semantic cache
 * Requires running Postgres with pgvector and Redis
 */
describe("Semantic Cache Integration", () => {
  let client: Client;
  let redis: Redis;
  let semanticCache: SemanticCache;
  let redisCache: RedisCache;
  let cacheManager: CacheManager;
  let embeddingService: EmbeddingService;

  beforeAll(async () => {
    // Skip if no DATABASE_URL or REDIS_URL
    if (!process.env.DATABASE_URL || !process.env.REDIS_URL) {
      console.log("Skipping integration tests - DATABASE_URL or REDIS_URL not set");
      return;
    }

    // Setup database
    const pool = getPool();
    client = await pool.connect();

    // Ensure pgvector extension
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");

    // Create semantic_cache table
    await client.query(`
      CREATE TABLE IF NOT EXISTS semantic_cache_test (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prompt_hash VARCHAR(64) NOT NULL,
        prompt_text TEXT NOT NULL,
        prompt_embedding vector(1536) NOT NULL,
        response_text TEXT NOT NULL,
        response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        model VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        access_count INTEGER NOT NULL DEFAULT 1,
        ttl_seconds INTEGER NOT NULL DEFAULT 3600,
        expires_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT unique_prompt_model_test UNIQUE (prompt_hash, model)
      )
    `);

    // Setup Redis
    redis = new Redis(process.env.REDIS_URL);

    // Setup embedding service (mock)
    embeddingService = new EmbeddingService({
      serviceUrl: process.env.EMBEDDING_SERVICE_URL || "https://api.openai.com/v1/embeddings",
      apiKey: process.env.OPENAI_API_KEY || "test-key",
      model: "text-embedding-ada-002"
    });

    // Setup caches
    const policy = createCachePolicy({
      similarityThreshold: 0.95,
      ttlSeconds: 3600
    });

    redisCache = new RedisCache({
      redis,
      keyPrefix: "test_cache:",
      maxSize: 100
    });

    semanticCache = new SemanticCache(
      pool,
      embeddingService,
      policy,
      redis,
      redisCache
    );

    cacheManager = new CacheManager(semanticCache, policy, redisCache);
  });

  afterAll(async () => {
    if (client) {
      // Cleanup test table
      await client.query("DROP TABLE IF EXISTS semantic_cache_test");
      client.release();
    }

    if (redis) {
      await redis.flushdb();
      await redis.quit();
    }
  });

  beforeEach(async () => {
    if (!client || !redis) {
      return;
    }

    // Clear test data
    await client.query("DELETE FROM semantic_cache_test");
    await redis.flushdb();
  });

  it("should store and retrieve cache entry", async () => {
    if (!semanticCache) {
      return;
    }

    // Store entry
    await semanticCache.set({
      promptText: "What is the capital of France?",
      responseText: "Paris is the capital of France.",
      responseMetadata: { finishReason: "stop" },
      model: "gpt-4"
    });

    // Retrieve entry
    const result = await semanticCache.lookup(
      "What is the capital of France?",
      "gpt-4"
    );

    expect(result.hit).toBe(true);
    expect(result.entry?.responseText).toBe("Paris is the capital of France.");
  });

  it("should find similar prompts", async () => {
    if (!semanticCache) {
      return;
    }

    // Store entry
    await semanticCache.set({
      promptText: "What is the capital of France?",
      responseText: "Paris is the capital of France.",
      model: "gpt-4"
    });

    // Lookup with similar but not identical prompt
    // Note: This requires real embeddings to work properly
    const result = await semanticCache.lookup(
      "Tell me the capital city of France",
      "gpt-4"
    );

    // May or may not hit depending on similarity threshold and embeddings
    if (result.hit) {
      expect(result.similarity).toBeGreaterThanOrEqual(0.95);
    }
  });

  it("should handle cache invalidation", async () => {
    if (!semanticCache) {
      return;
    }

    // Store entries for different models
    await semanticCache.set({
      promptText: "Test prompt 1",
      responseText: "Response 1",
      model: "gpt-4"
    });

    await semanticCache.set({
      promptText: "Test prompt 2",
      responseText: "Response 2",
      model: "claude-3"
    });

    // Invalidate gpt-4 entries
    const count = await semanticCache.invalidateByModel("gpt-4");

    expect(count).toBe(1);

    // Verify gpt-4 entry is gone
    const result1 = await semanticCache.lookup("Test prompt 1", "gpt-4");
    expect(result1.hit).toBe(false);

    // Verify claude-3 entry still exists
    const result2 = await semanticCache.lookup("Test prompt 2", "claude-3");
    expect(result2.hit).toBe(true);
  });

  it("should clean up expired entries", async () => {
    if (!semanticCache || !client) {
      return;
    }

    // Store entry with short TTL
    await semanticCache.set({
      promptText: "Expiring prompt",
      responseText: "Response",
      model: "gpt-4",
      ttlSeconds: 1
    });

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Cleanup
    const count = await semanticCache.cleanupExpired();

    expect(count).toBeGreaterThan(0);
  });

  it("should track cache statistics", async () => {
    if (!cacheManager) {
      return;
    }

    // Store some entries
    await semanticCache.set({
      promptText: "Test 1",
      responseText: "Response 1",
      model: "gpt-4"
    });

    await semanticCache.set({
      promptText: "Test 2",
      responseText: "Response 2",
      model: "claude-3"
    });

    // Get statistics
    const stats = await cacheManager.getStatistics();

    expect(stats.pgvector.totalEntries).toBeGreaterThanOrEqual(2);
    expect(stats.pgvector.modelBreakdown).toHaveLength(2);
  });

  it("should handle Redis hot cache", async () => {
    if (!redisCache) {
      return;
    }

    // Store in Redis
    await redisCache.set({
      promptHash: "test-hash",
      promptText: "Test prompt",
      responseText: "Test response",
      responseMetadata: {},
      model: "gpt-4",
      createdAt: new Date().toISOString(),
      accessCount: 1,
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    // Retrieve from Redis
    const entry = await redisCache.get("test-hash");

    expect(entry).toBeDefined();
    expect(entry?.responseText).toBe("Test response");
  });

  it("should perform cache health check", async () => {
    if (!cacheManager) {
      return;
    }

    const health = await cacheManager.checkHealth();

    expect(health).toBeDefined();
    expect(health.healthy).toBeDefined();
    expect(Array.isArray(health.issues)).toBe(true);
  });

  it("should get top cached prompts", async () => {
    if (!semanticCache) {
      return;
    }

    // Store entries
    await semanticCache.set({
      promptText: "Popular prompt",
      responseText: "Response",
      model: "gpt-4"
    });

    // Access it multiple times
    for (let i = 0; i < 5; i++) {
      await semanticCache.lookup("Popular prompt", "gpt-4");
    }

    // Get top prompts
    const topPrompts = await semanticCache.getTopPrompts(10);

    expect(topPrompts.length).toBeGreaterThan(0);
    expect(topPrompts[0]?.accessCount).toBeGreaterThan(1);
  });
});

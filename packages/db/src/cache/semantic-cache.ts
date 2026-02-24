import type { Pool } from "pg";
import { createHash } from "crypto";
import type { CachePolicy } from "./cache-policy.js";
import {
  shouldCachePrompt,
  calculateExpiresAt,
  isExpired
} from "./cache-policy.js";
import type { EmbeddingService } from "./embedding-service.js";
import type { RedisCache, RedisCacheEntry } from "./redis-cache.js";

/**
 * Semantic cache entry from database
 */
export interface SemanticCacheEntry {
  id: string;
  promptHash: string;
  promptText: string;
  promptEmbedding: number[];
  responseText: string;
  responseMetadata: Record<string, unknown>;
  model: string;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  ttlSeconds: number;
  expiresAt: Date;
}

/**
 * Cache lookup result
 */
export interface CacheLookupResult {
  hit: boolean;
  entry?: SemanticCacheEntry;
  similarity?: number;
  source?: "redis" | "pgvector";
}

/**
 * Cache set options
 */
export interface CacheSetOptions {
  promptText: string;
  responseText: string;
  responseMetadata?: Record<string, unknown>;
  model: string;
  ttlSeconds?: number;
}

/**
 * Semantic Cache
 *
 * Provides semantic caching using pgvector for similarity search
 * and Redis for hot cache. Automatically handles cache hits,
 * misses, and eviction.
 */
export class SemanticCache {
  private readonly pool: Pool;
  private readonly embeddingService: EmbeddingService;
  private readonly redisCache: RedisCache | undefined;
  private readonly policy: CachePolicy;

  public constructor(
    pool: Pool,
    embeddingService: EmbeddingService,
    policy: CachePolicy,
    redisCache?: RedisCache
  ) {
    this.pool = pool;
    this.embeddingService = embeddingService;
    this.policy = policy;
    this.redisCache = redisCache;
  }

  /**
   * Look up a cache entry by prompt similarity
   */
  public async lookup(
    promptText: string,
    model: string
  ): Promise<CacheLookupResult> {
    // Check if prompt should be cached
    if (!shouldCachePrompt(promptText, model, this.policy)) {
      return { hit: false };
    }

    const promptHash = this.hashPrompt(promptText);

    // Try Redis hot cache first
    if (this.redisCache) {
      const redisEntry = await this.redisCache.get(promptHash);

      if (redisEntry && redisEntry.model === model) {
        // Check expiration
        if (!isExpired(new Date(redisEntry.expiresAt))) {
          return {
            hit: true,
            entry: this.convertRedisEntryToDbEntry(redisEntry),
            similarity: 1.0,
            source: "redis"
          };
        } else {
          // Delete expired entry
          await this.redisCache.delete(promptHash);
        }
      }
    }

    // Generate embedding for similarity search
    const { embedding } = await this.embeddingService.embed(promptText);

    // Search pgvector for similar prompts
    const result = await this.pool.query<{
      id: string;
      prompt_hash: string;
      prompt_text: string;
      response_text: string;
      response_metadata: Record<string, unknown>;
      model: string;
      created_at: Date;
      accessed_at: Date;
      access_count: number;
      ttl_seconds: number;
      expires_at: Date;
      similarity: number;
    }>(
      `
      SELECT
        id,
        prompt_hash,
        prompt_text,
        response_text,
        response_metadata,
        model,
        created_at,
        accessed_at,
        access_count,
        ttl_seconds,
        expires_at,
        1 - (prompt_embedding <=> $1::vector) AS similarity
      FROM semantic_cache
      WHERE model = $2
        AND expires_at > NOW()
        AND 1 - (prompt_embedding <=> $1::vector) >= $3
      ORDER BY similarity DESC
      LIMIT 1
      `,
      [JSON.stringify(embedding), model, this.policy.similarityThreshold]
    );

    if (result.rows.length === 0) {
      return { hit: false };
    }

    const row = result.rows[0]!;

    // Update access metadata
    await this.updateAccessMetadata(row.id);

    const entry: SemanticCacheEntry = {
      id: row.id,
      promptHash: row.prompt_hash,
      promptText: row.prompt_text,
      promptEmbedding: embedding,
      responseText: row.response_text,
      responseMetadata: row.response_metadata,
      model: row.model,
      createdAt: row.created_at,
      accessedAt: new Date(),
      accessCount: row.access_count + 1,
      ttlSeconds: row.ttl_seconds,
      expiresAt: row.expires_at
    };

    // Update Redis hot cache
    if (this.redisCache) {
      await this.redisCache.set({
        promptHash: entry.promptHash,
        promptText: entry.promptText,
        responseText: entry.responseText,
        responseMetadata: entry.responseMetadata,
        model: entry.model,
        createdAt: entry.createdAt.toISOString(),
        accessCount: entry.accessCount,
        expiresAt: entry.expiresAt.toISOString()
      });
    }

    return {
      hit: true,
      entry,
      similarity: row.similarity,
      source: "pgvector"
    };
  }

  /**
   * Store a cache entry
   */
  public async set(options: CacheSetOptions): Promise<void> {
    const {
      promptText,
      responseText,
      responseMetadata = {},
      model,
      ttlSeconds = this.policy.ttlSeconds
    } = options;

    // Check if prompt should be cached
    if (!shouldCachePrompt(promptText, model, this.policy)) {
      return;
    }

    const promptHash = this.hashPrompt(promptText);
    const { embedding } = await this.embeddingService.embed(promptText);
    const expiresAt = calculateExpiresAt(ttlSeconds);

    // Insert into pgvector
    await this.pool.query(
      `
      INSERT INTO semantic_cache (
        prompt_hash,
        prompt_text,
        prompt_embedding,
        response_text,
        response_metadata,
        model,
        ttl_seconds,
        expires_at
      ) VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8)
      ON CONFLICT (prompt_hash, model)
      DO UPDATE SET
        response_text = EXCLUDED.response_text,
        response_metadata = EXCLUDED.response_metadata,
        accessed_at = NOW(),
        access_count = semantic_cache.access_count + 1,
        expires_at = EXCLUDED.expires_at
      `,
      [
        promptHash,
        promptText,
        JSON.stringify(embedding),
        responseText,
        JSON.stringify(responseMetadata),
        model,
        ttlSeconds,
        expiresAt
      ]
    );

    // Update Redis hot cache
    if (this.redisCache) {
      await this.redisCache.set({
        promptHash,
        promptText,
        responseText,
        responseMetadata,
        model,
        createdAt: new Date().toISOString(),
        accessCount: 1,
        expiresAt: expiresAt.toISOString()
      });
    }
  }

  /**
   * Invalidate cache entries by model
   */
  public async invalidateByModel(model: string): Promise<number> {
    const result = await this.pool.query<{ count: number }>(
      `
      WITH deleted AS (
        DELETE FROM semantic_cache
        WHERE model = $1
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
      `,
      [model]
    );

    // Clear Redis cache
    if (this.redisCache) {
      await this.redisCache.clear();
    }

    return result.rows[0]?.count ?? 0;
  }

  /**
   * Invalidate cache entries by prompt hash
   */
  public async invalidateByPromptHash(promptHash: string): Promise<number> {
    const result = await this.pool.query<{ count: number }>(
      `
      WITH deleted AS (
        DELETE FROM semantic_cache
        WHERE prompt_hash = $1
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
      `,
      [promptHash]
    );

    // Clear from Redis
    if (this.redisCache) {
      await this.redisCache.delete(promptHash);
    }

    return result.rows[0]?.count ?? 0;
  }

  /**
   * Invalidate all cache entries
   */
  public async invalidateAll(): Promise<number> {
    const result = await this.pool.query<{ count: number }>(
      `
      WITH deleted AS (
        DELETE FROM semantic_cache
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
      `
    );

    // Clear Redis cache
    if (this.redisCache) {
      await this.redisCache.clear();
    }

    return result.rows[0]?.count ?? 0;
  }

  /**
   * Clean up expired entries
   */
  public async cleanupExpired(): Promise<number> {
    const result = await this.pool.query<{ count: number }>(
      `
      WITH deleted AS (
        DELETE FROM semantic_cache
        WHERE expires_at <= NOW()
        RETURNING id
      )
      SELECT COUNT(*) as count FROM deleted
      `
    );

    return result.rows[0]?.count ?? 0;
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    totalEntries: number;
    expiredEntries: number;
    hitRate: number;
    avgAccessCount: number;
    modelBreakdown: Array<{ model: string; count: number }>;
  }> {
    const statsResult = await this.pool.query<{
      total_entries: number;
      expired_entries: number;
      avg_access_count: number;
    }>(
      `
      SELECT
        COUNT(*) as total_entries,
        COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries,
        COALESCE(AVG(access_count), 0) as avg_access_count
      FROM semantic_cache
      `
    );

    const modelResult = await this.pool.query<{
      model: string;
      count: number;
    }>(
      `
      SELECT model, COUNT(*) as count
      FROM semantic_cache
      GROUP BY model
      ORDER BY count DESC
      `
    );

    const stats = statsResult.rows[0];
    const totalEntries = Number(stats?.total_entries ?? 0);
    const avgAccessCount = Number(stats?.avg_access_count ?? 0);

    // Approximate hit rate based on access count
    const hitRate = totalEntries > 0 ? Math.min(avgAccessCount / 10, 1) : 0;

    return {
      totalEntries,
      expiredEntries: Number(stats?.expired_entries ?? 0),
      hitRate,
      avgAccessCount,
      modelBreakdown: modelResult.rows.map(row => ({
        model: row.model,
        count: Number(row.count)
      }))
    };
  }

  /**
   * Get top cached prompts
   */
  public async getTopPrompts(limit: number = 10): Promise<
    Array<{
      promptText: string;
      model: string;
      accessCount: number;
      createdAt: Date;
    }>
  > {
    const result = await this.pool.query<{
      prompt_text: string;
      model: string;
      access_count: number;
      created_at: Date;
    }>(
      `
      SELECT prompt_text, model, access_count, created_at
      FROM semantic_cache
      WHERE expires_at > NOW()
      ORDER BY access_count DESC
      LIMIT $1
      `,
      [limit]
    );

    return result.rows.map(row => ({
      promptText: row.prompt_text,
      model: row.model,
      accessCount: row.access_count,
      createdAt: row.created_at
    }));
  }

  /**
   * Hash a prompt for consistent cache keys
   */
  private hashPrompt(prompt: string): string {
    return createHash("sha256").update(prompt).digest("hex");
  }

  /**
   * Update access metadata for a cache entry
   */
  private async updateAccessMetadata(id: string): Promise<void> {
    await this.pool.query(
      `
      UPDATE semantic_cache
      SET accessed_at = NOW(),
          access_count = access_count + 1
      WHERE id = $1
      `,
      [id]
    );
  }

  /**
   * Convert Redis cache entry to database entry format
   */
  private convertRedisEntryToDbEntry(
    redisEntry: RedisCacheEntry
  ): SemanticCacheEntry {
    return {
      id: "", // Not available in Redis
      promptHash: redisEntry.promptHash,
      promptText: redisEntry.promptText,
      promptEmbedding: [], // Not available in Redis
      responseText: redisEntry.responseText,
      responseMetadata: redisEntry.responseMetadata,
      model: redisEntry.model,
      createdAt: new Date(redisEntry.createdAt),
      accessedAt: new Date(),
      accessCount: redisEntry.accessCount,
      ttlSeconds: this.policy.ttlSeconds,
      expiresAt: new Date(redisEntry.expiresAt)
    };
  }
}

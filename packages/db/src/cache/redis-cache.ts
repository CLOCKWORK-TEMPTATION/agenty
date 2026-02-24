import type { Redis } from "ioredis";

/**
 * Redis cache entry
 */
export interface RedisCacheEntry {
  promptHash: string;
  promptText: string;
  responseText: string;
  responseMetadata: Record<string, unknown>;
  model: string;
  createdAt: string;
  accessCount: number;
  expiresAt: string;
}

/**
 * Redis Cache Configuration
 */
export interface RedisCacheConfig {
  /**
   * Redis client instance
   */
  redis: Redis;

  /**
   * Key prefix for cache entries
   * Default: "semantic_cache:"
   */
  keyPrefix?: string;

  /**
   * Maximum number of entries in hot cache
   * Default: 1000
   */
  maxSize?: number;

  /**
   * TTL for hot cache entries in seconds
   * Default: 3600
   */
  ttlSeconds?: number;
}

/**
 * Redis Hot Cache
 *
 * Provides fast in-memory caching using Redis for frequently accessed
 * semantic cache entries. Uses LRU eviction policy.
 */
export class RedisCache {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private readonly maxSize: number;
  private readonly ttlSeconds: number;

  public constructor(config: RedisCacheConfig) {
    this.redis = config.redis;
    this.keyPrefix = config.keyPrefix ?? "semantic_cache:";
    this.maxSize = config.maxSize ?? 1000;
    this.ttlSeconds = config.ttlSeconds ?? 3600;
  }

  /**
   * Get a cache entry by prompt hash
   */
  public async get(promptHash: string): Promise<RedisCacheEntry | null> {
    const key = this.getKey(promptHash);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    try {
      const entry = JSON.parse(data) as RedisCacheEntry;

      // Update access count
      entry.accessCount += 1;
      await this.redis.setex(key, this.ttlSeconds, JSON.stringify(entry));

      return entry;
    } catch {
      return null;
    }
  }

  /**
   * Set a cache entry
   */
  public async set(entry: RedisCacheEntry): Promise<void> {
    const key = this.getKey(entry.promptHash);
    await this.redis.setex(key, this.ttlSeconds, JSON.stringify(entry));

    // Add to sorted set for LRU tracking
    const now = Date.now();
    await this.redis.zadd("semantic_cache:access_times", now, entry.promptHash);

    // Evict oldest entries if over max size
    await this.evictIfNeeded();
  }

  /**
   * Delete a cache entry
   */
  public async delete(promptHash: string): Promise<void> {
    const key = this.getKey(promptHash);
    await this.redis.del(key);
    await this.redis.zrem("semantic_cache:access_times", promptHash);
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    const pattern = `${this.keyPrefix}*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    await this.redis.del("semantic_cache:access_times");
  }

  /**
   * Get cache size
   */
  public async size(): Promise<number> {
    return await this.redis.zcard("semantic_cache:access_times");
  }

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<{
    size: number;
    maxSize: number;
    hitRate: number;
    keys: string[];
  }> {
    const size = await this.size();
    const keys = await this.redis.zrange("semantic_cache:access_times", 0, -1);

    // Calculate hit rate from access counts
    let totalHits = 0;
    let totalEntries = 0;

    for (const promptHash of keys) {
      const entry = await this.get(promptHash);
      if (entry) {
        totalHits += entry.accessCount;
        totalEntries += 1;
      }
    }

    const hitRate = totalEntries > 0 ? totalHits / totalEntries : 0;

    return {
      size,
      maxSize: this.maxSize,
      hitRate,
      keys
    };
  }

  /**
   * Warm up cache from pgvector
   */
  public async warmUp(
    entries: Array<{
      promptHash: string;
      promptText: string;
      responseText: string;
      responseMetadata: Record<string, unknown>;
      model: string;
      createdAt: Date;
      accessCount: number;
      expiresAt: Date;
    }>
  ): Promise<void> {
    for (const entry of entries) {
      await this.set({
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
  }

  /**
   * Sync with pgvector periodically
   */
  public async sync(
    fetchTopEntries: () => Promise<
      Array<{
        promptHash: string;
        promptText: string;
        responseText: string;
        responseMetadata: Record<string, unknown>;
        model: string;
        createdAt: Date;
        accessCount: number;
        expiresAt: Date;
      }>
    >
  ): Promise<void> {
    const entries = await fetchTopEntries();
    await this.warmUp(entries);
  }

  /**
   * Get Redis key for a prompt hash
   */
  private getKey(promptHash: string): string {
    return `${this.keyPrefix}${promptHash}`;
  }

  /**
   * Evict oldest entries if cache size exceeds max
   */
  private async evictIfNeeded(): Promise<void> {
    const size = await this.size();

    if (size > this.maxSize) {
      const toEvict = size - this.maxSize;

      // Get oldest entries
      const oldestHashes = await this.redis.zrange(
        "semantic_cache:access_times",
        0,
        toEvict - 1
      );

      // Delete them
      for (const hash of oldestHashes) {
        await this.delete(hash);
      }
    }
  }
}

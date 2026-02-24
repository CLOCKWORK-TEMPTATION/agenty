import type { SemanticCache } from "./semantic-cache.js";
import type { RedisCache } from "./redis-cache.js";
import type { CachePolicy } from "./cache-policy.js";

/**
 * Cache health status
 */
export interface CacheHealth {
  healthy: boolean;
  issues: string[];
  lastCleanup: Date | null;
  nextCleanup: Date | null;
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  pgvector: {
    totalEntries: number;
    expiredEntries: number;
    hitRate: number;
    avgAccessCount: number;
    modelBreakdown: Array<{ model: string; count: number }>;
  };
  redis: {
    size: number;
    maxSize: number;
    hitRate: number;
  } | null;
  overall: {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    avgLatencyMs: number;
  };
}

/**
 * Cache Manager
 *
 * Manages cache lifecycle including:
 * - Automatic cleanup of expired entries
 * - Cache statistics collection
 * - Health checks
 * - Warm-up operations
 */
export class CacheManager {
  private readonly semanticCache: SemanticCache;
  private readonly redisCache: RedisCache | undefined;
  private readonly policy: CachePolicy;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private lastCleanup: Date | null = null;
  private totalHits = 0;
  private totalMisses = 0;
  private totalLatency = 0;
  private totalRequests = 0;

  public constructor(
    semanticCache: SemanticCache,
    policy: CachePolicy,
    redisCache?: RedisCache
  ) {
    this.semanticCache = semanticCache;
    this.redisCache = redisCache;
    this.policy = policy;
  }

  /**
   * Start automatic cleanup
   */
  public startAutoCleanup(): void {
    if (!this.policy.enableAutoCleanup) {
      return;
    }

    if (this.cleanupInterval) {
      return; // Already started
    }

    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, this.policy.cleanupIntervalMs);

    // Run initial cleanup
    void this.cleanup();
  }

  /**
   * Stop automatic cleanup
   */
  public stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Manually trigger cleanup
   */
  public async cleanup(): Promise<{
    deletedCount: number;
    cleanupTime: number;
  }> {
    const startTime = Date.now();

    const deletedCount = await this.semanticCache.cleanupExpired();

    this.lastCleanup = new Date();
    const cleanupTime = Date.now() - startTime;

    return {
      deletedCount,
      cleanupTime
    };
  }

  /**
   * Get cache statistics
   */
  public async getStatistics(): Promise<CacheStatistics> {
    const pgvectorStats = await this.semanticCache.getStats();

    let redisStats = null;
    if (this.redisCache) {
      redisStats = await this.redisCache.getStats();
    }

    const avgLatencyMs =
      this.totalRequests > 0 ? this.totalLatency / this.totalRequests : 0;

    const overallHitRate =
      this.totalHits + this.totalMisses > 0
        ? this.totalHits / (this.totalHits + this.totalMisses)
        : 0;

    return {
      pgvector: pgvectorStats,
      redis: redisStats,
      overall: {
        hitRate: overallHitRate,
        totalHits: this.totalHits,
        totalMisses: this.totalMisses,
        avgLatencyMs
      }
    };
  }

  /**
   * Record cache hit
   */
  public recordHit(latencyMs: number): void {
    this.totalHits += 1;
    this.totalLatency += latencyMs;
    this.totalRequests += 1;
  }

  /**
   * Record cache miss
   */
  public recordMiss(latencyMs: number): void {
    this.totalMisses += 1;
    this.totalLatency += latencyMs;
    this.totalRequests += 1;
  }

  /**
   * Reset statistics
   */
  public resetStatistics(): void {
    this.totalHits = 0;
    this.totalMisses = 0;
    this.totalLatency = 0;
    this.totalRequests = 0;
  }

  /**
   * Check cache health
   */
  public async checkHealth(): Promise<CacheHealth> {
    const issues: string[] = [];
    let healthy = true;

    try {
      // Check pgvector
      const stats = await this.semanticCache.getStats();

      // Check for too many expired entries
      if (stats.expiredEntries > stats.totalEntries * 0.1) {
        issues.push(
          `High number of expired entries: ${stats.expiredEntries}/${stats.totalEntries}`
        );
        healthy = false;
      }

      // Check for low hit rate
      if (stats.hitRate < 0.1 && stats.totalEntries > 100) {
        issues.push(`Low cache hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
      }

      // Check Redis
      if (this.redisCache) {
        const redisStats = await this.redisCache.getStats();

        if (redisStats.size >= redisStats.maxSize) {
          issues.push(
            `Redis cache at capacity: ${redisStats.size}/${redisStats.maxSize}`
          );
        }
      }

      // Check cleanup schedule
      const nextCleanup = this.lastCleanup
        ? new Date(this.lastCleanup.getTime() + this.policy.cleanupIntervalMs)
        : null;

      if (
        this.policy.enableAutoCleanup &&
        !this.cleanupInterval &&
        this.lastCleanup === null
      ) {
        issues.push("Auto cleanup is enabled but not running");
        healthy = false;
      }

      return {
        healthy,
        issues,
        lastCleanup: this.lastCleanup,
        nextCleanup
      };
    } catch (error) {
      return {
        healthy: false,
        issues: [
          `Health check failed: ${error instanceof Error ? error.message : String(error)}`
        ],
        lastCleanup: this.lastCleanup,
        nextCleanup: null
      };
    }
  }

  /**
   * Invalidate cache entries by model
   */
  public async invalidateByModel(model: string): Promise<number> {
    return await this.semanticCache.invalidateByModel(model);
  }

  /**
   * Invalidate all cache entries
   */
  public async invalidateAll(): Promise<number> {
    this.resetStatistics();
    return await this.semanticCache.invalidateAll();
  }

  /**
   * Warm up cache with top entries
   */
  public async warmUp(): Promise<void> {
    if (!this.redisCache) {
      return;
    }

    // Warmup implementation would fetch top entries from pgvector
    // and populate Redis cache. This is a placeholder for now
    // as it requires additional database queries.
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
    return await this.semanticCache.getTopPrompts(limit);
  }

  /**
   * Perform bulk operations
   */
  public async bulkInvalidate(promptHashes: string[]): Promise<number> {
    let totalDeleted = 0;

    for (const hash of promptHashes) {
      const deleted = await this.semanticCache.invalidateByPromptHash(hash);
      totalDeleted += deleted;
    }

    return totalDeleted;
  }

  /**
   * Destroy the cache manager
   */
  public destroy(): void {
    this.stopAutoCleanup();
  }
}

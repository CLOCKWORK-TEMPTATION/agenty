/**
 * Cache Policy Configuration
 *
 * Defines caching behavior, similarity thresholds, TTL policies,
 * and invalidation rules for semantic cache.
 */

export interface CachePolicy {
  /**
   * Minimum similarity threshold for cache hits (0-1)
   * Default: 0.95
   */
  similarityThreshold: number;

  /**
   * Time-to-live in seconds for cache entries
   * Default: 3600 (1 hour)
   */
  ttlSeconds: number;

  /**
   * Maximum number of cache entries to store
   * Default: 10000
   */
  maxSize: number;

  /**
   * Whether to enable hot cache in Redis
   * Default: true
   */
  enableHotCache: boolean;

  /**
   * Number of most accessed entries to keep in hot cache
   * Default: 1000
   */
  hotCacheSize: number;

  /**
   * Whether to enable automatic cleanup of expired entries
   * Default: true
   */
  enableAutoCleanup: boolean;

  /**
   * Cleanup interval in milliseconds
   * Default: 300000 (5 minutes)
   */
  cleanupIntervalMs: number;

  /**
   * Models to exclude from caching (optional)
   */
  excludedModels?: string[];

  /**
   * Minimum prompt length to cache (optional)
   * Default: 10
   */
  minPromptLength?: number;

  /**
   * Maximum prompt length to cache (optional)
   * Default: 10000
   */
  maxPromptLength?: number;
}

export interface CachePolicyOptions {
  similarityThreshold?: number;
  ttlSeconds?: number;
  maxSize?: number;
  enableHotCache?: boolean;
  hotCacheSize?: number;
  enableAutoCleanup?: boolean;
  cleanupIntervalMs?: number;
  excludedModels?: string[];
  minPromptLength?: number;
  maxPromptLength?: number;
}

/**
 * Default cache policy configuration
 */
export const DEFAULT_CACHE_POLICY: CachePolicy = {
  similarityThreshold: 0.95,
  ttlSeconds: 3600,
  maxSize: 10000,
  enableHotCache: true,
  hotCacheSize: 1000,
  enableAutoCleanup: true,
  cleanupIntervalMs: 300000,
  minPromptLength: 10,
  maxPromptLength: 10000
};

/**
 * Create a cache policy with custom options
 */
export function createCachePolicy(options?: CachePolicyOptions): CachePolicy {
  return {
    ...DEFAULT_CACHE_POLICY,
    ...options
  };
}

/**
 * Validate cache policy configuration
 */
export function validateCachePolicy(policy: CachePolicy): void {
  if (policy.similarityThreshold < 0 || policy.similarityThreshold > 1) {
    throw new Error("similarityThreshold must be between 0 and 1");
  }

  if (policy.ttlSeconds <= 0) {
    throw new Error("ttlSeconds must be positive");
  }

  if (policy.maxSize <= 0) {
    throw new Error("maxSize must be positive");
  }

  if (policy.hotCacheSize <= 0) {
    throw new Error("hotCacheSize must be positive");
  }

  if (policy.cleanupIntervalMs <= 0) {
    throw new Error("cleanupIntervalMs must be positive");
  }

  if (policy.minPromptLength !== undefined && policy.minPromptLength < 0) {
    throw new Error("minPromptLength must be non-negative");
  }

  if (
    policy.maxPromptLength !== undefined &&
    policy.minPromptLength !== undefined &&
    policy.maxPromptLength < policy.minPromptLength
  ) {
    throw new Error("maxPromptLength must be greater than minPromptLength");
  }
}

/**
 * Check if a prompt should be cached based on policy
 */
export function shouldCachePrompt(
  prompt: string,
  model: string,
  policy: CachePolicy
): boolean {
  // Check model exclusion
  if (policy.excludedModels?.includes(model)) {
    return false;
  }

  // Check prompt length
  const promptLength = prompt.length;
  if (policy.minPromptLength !== undefined && promptLength < policy.minPromptLength) {
    return false;
  }

  if (policy.maxPromptLength !== undefined && promptLength > policy.maxPromptLength) {
    return false;
  }

  return true;
}

/**
 * Calculate expiration timestamp based on TTL
 */
export function calculateExpiresAt(ttlSeconds: number): Date {
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + ttlSeconds);
  return expiresAt;
}

/**
 * Check if a cache entry is expired
 */
export function isExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

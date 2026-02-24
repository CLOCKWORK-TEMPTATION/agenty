/**
 * Semantic Cache Module
 *
 * Exports all cache-related functionality including:
 * - SemanticCache for similarity-based caching
 * - RedisCache for hot cache
 * - CacheManager for lifecycle management
 * - CachePolicy for configuration
 * - EmbeddingService for vector generation
 * - CacheMetrics for monitoring
 */

export type { CachePolicy, CachePolicyOptions } from "./cache-policy.js";
export {
  DEFAULT_CACHE_POLICY,
  createCachePolicy,
  validateCachePolicy,
  shouldCachePrompt,
  calculateExpiresAt,
  isExpired
} from "./cache-policy.js";

export type {
  EmbeddingServiceConfig,
  EmbeddingResult,
  BatchEmbeddingResult
} from "./embedding-service.js";
export { EmbeddingService } from "./embedding-service.js";

export type { RedisCacheEntry, RedisCacheConfig } from "./redis-cache.js";
export { RedisCache } from "./redis-cache.js";

export type {
  SemanticCacheEntry,
  CacheLookupResult,
  CacheSetOptions
} from "./semantic-cache.js";
export { SemanticCache } from "./semantic-cache.js";

export type {
  CacheHealth,
  CacheStatistics
} from "./manager.js";
export { CacheManager } from "./manager.js";

export type {
  CacheMetrics,
  CacheMetricsTimeSeries
} from "./metrics.js";
export {
  CacheMetricsCollector,
  getGlobalMetricsCollector,
  resetGlobalMetricsCollector
} from "./metrics.js";

/**
 * Cache Metrics
 *
 * Tracks and reports cache performance metrics for monitoring
 * and observability.
 */

export interface CacheMetrics {
  hitCount: number;
  missCount: number;
  totalLookups: number;
  hitRate: number;
  avgLookupTimeMs: number;
  totalCacheSize: number;
  evictionCount: number;
  errorCount: number;
  lastUpdated: Date;
}

export interface CacheMetricsTimeSeries {
  timestamp: Date;
  hitCount: number;
  missCount: number;
  hitRate: number;
  avgLookupTimeMs: number;
  cacheSize: number;
}

/**
 * Cache Metrics Collector
 */
export class CacheMetricsCollector {
  private hitCount = 0;
  private missCount = 0;
  private totalLookupTime = 0;
  private lookupCount = 0;
  private evictionCount = 0;
  private errorCount = 0;
  private lastUpdated = new Date();
  private timeSeries: CacheMetricsTimeSeries[] = [];
  private readonly maxTimeSeriesLength: number;

  public constructor(maxTimeSeriesLength: number = 1000) {
    this.maxTimeSeriesLength = maxTimeSeriesLength;
  }

  /**
   * Record a cache hit
   */
  public recordHit(lookupTimeMs: number): void {
    this.hitCount += 1;
    this.totalLookupTime += lookupTimeMs;
    this.lookupCount += 1;
    this.lastUpdated = new Date();
  }

  /**
   * Record a cache miss
   */
  public recordMiss(lookupTimeMs: number): void {
    this.missCount += 1;
    this.totalLookupTime += lookupTimeMs;
    this.lookupCount += 1;
    this.lastUpdated = new Date();
  }

  /**
   * Record a cache eviction
   */
  public recordEviction(): void {
    this.evictionCount += 1;
    this.lastUpdated = new Date();
  }

  /**
   * Record a cache error
   */
  public recordError(): void {
    this.errorCount += 1;
    this.lastUpdated = new Date();
  }

  /**
   * Get current metrics
   */
  public getMetrics(cacheSize: number): CacheMetrics {
    const totalLookups = this.hitCount + this.missCount;
    const hitRate = totalLookups > 0 ? this.hitCount / totalLookups : 0;
    const avgLookupTimeMs =
      this.lookupCount > 0 ? this.totalLookupTime / this.lookupCount : 0;

    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      totalLookups,
      hitRate,
      avgLookupTimeMs,
      totalCacheSize: cacheSize,
      evictionCount: this.evictionCount,
      errorCount: this.errorCount,
      lastUpdated: this.lastUpdated
    };
  }

  /**
   * Snapshot current metrics to time series
   */
  public snapshotMetrics(cacheSize: number): void {
    const totalLookups = this.hitCount + this.missCount;
    const hitRate = totalLookups > 0 ? this.hitCount / totalLookups : 0;
    const avgLookupTimeMs =
      this.lookupCount > 0 ? this.totalLookupTime / this.lookupCount : 0;

    this.timeSeries.push({
      timestamp: new Date(),
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate,
      avgLookupTimeMs,
      cacheSize
    });

    // Trim time series if too long
    if (this.timeSeries.length > this.maxTimeSeriesLength) {
      this.timeSeries = this.timeSeries.slice(-this.maxTimeSeriesLength);
    }
  }

  /**
   * Get time series data
   */
  public getTimeSeries(
    startTime?: Date,
    endTime?: Date
  ): CacheMetricsTimeSeries[] {
    let filtered = this.timeSeries;

    if (startTime) {
      filtered = filtered.filter(point => point.timestamp >= startTime);
    }

    if (endTime) {
      filtered = filtered.filter(point => point.timestamp <= endTime);
    }

    return filtered;
  }

  /**
   * Reset metrics
   */
  public reset(): void {
    this.hitCount = 0;
    this.missCount = 0;
    this.totalLookupTime = 0;
    this.lookupCount = 0;
    this.evictionCount = 0;
    this.errorCount = 0;
    this.lastUpdated = new Date();
  }

  /**
   * Clear time series data
   */
  public clearTimeSeries(): void {
    this.timeSeries = [];
  }

  /**
   * Export metrics as JSON
   */
  public toJSON(): {
    metrics: CacheMetrics;
    timeSeries: CacheMetricsTimeSeries[];
  } {
    return {
      metrics: this.getMetrics(0),
      timeSeries: this.timeSeries
    };
  }
}

/**
 * Global cache metrics instance
 */
let globalMetricsCollector: CacheMetricsCollector | null = null;

/**
 * Get or create global metrics collector
 */
export function getGlobalMetricsCollector(): CacheMetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new CacheMetricsCollector();
  }
  return globalMetricsCollector;
}

/**
 * Reset global metrics collector
 */
export function resetGlobalMetricsCollector(): void {
  globalMetricsCollector = null;
}

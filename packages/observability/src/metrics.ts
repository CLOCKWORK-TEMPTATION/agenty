import { metrics, ValueType } from '@opentelemetry/api';
import type { Counter, Histogram, ObservableGauge, Meter } from '@opentelemetry/api';

export interface MetricsConfig {
  serviceName: string;
  serviceVersion: string;
}

/**
 * Metrics collector for the platform
 */
class MetricsCollector {
  private meter: Meter | null = null;

  // Run metrics
  private runDurationHistogram: Histogram | null = null;
  private runStatusCounter: Counter | null = null;

  // Model metrics
  private modelRequestsCounter: Counter | null = null;
  private modelLatencyHistogram: Histogram | null = null;
  private modelErrorsCounter: Counter | null = null;

  // Tool metrics
  private toolExecutionsCounter: Counter | null = null;
  private toolLatencyHistogram: Histogram | null = null;
  private toolErrorsCounter: Counter | null = null;

  // Cache metrics
  private cacheHitRateGauge: ObservableGauge | null = null;
  private cacheOperationsCounter: Counter | null = null;

  // Queue metrics
  private queueDepthGauge: ObservableGauge | null = null;
  private workerUtilizationGauge: ObservableGauge | null = null;
  private jobProcessingCounter: Counter | null = null;

  // HTTP metrics
  private httpRequestsCounter: Counter | null = null;
  private httpDurationHistogram: Histogram | null = null;
  private httpRequestSizeHistogram: Histogram | null = null;
  private httpResponseSizeHistogram: Histogram | null = null;

  // Database metrics
  private dbQueryCounter: Counter | null = null;
  private dbQueryDurationHistogram: Histogram | null = null;
  private dbConnectionPoolGauge: ObservableGauge | null = null;

  // Cache stats for gauge
  private cacheStats = {
    hits: 0,
    misses: 0,
  };

  // Queue stats for gauges
  private queueStats = {
    depth: 0,
    activeWorkers: 0,
    totalWorkers: 0,
  };

  // DB stats for gauges
  private dbStats = {
    activeConnections: 0,
    idleConnections: 0,
    totalConnections: 0,
  };

  /**
   * Initialize metrics collector
   */
  initialize(config: MetricsConfig): void {
    this.meter = metrics.getMeter(config.serviceName, config.serviceVersion);

    // Initialize run metrics
    this.runDurationHistogram = this.meter.createHistogram('run_duration_seconds', {
      description: 'Duration of agent runs in seconds',
      unit: 's',
      valueType: ValueType.DOUBLE,
    });

    this.runStatusCounter = this.meter.createCounter('run_status_total', {
      description: 'Total count of runs by status',
      unit: '1',
      valueType: ValueType.INT,
    });

    // Initialize model metrics
    this.modelRequestsCounter = this.meter.createCounter('model_requests_total', {
      description: 'Total count of model requests',
      unit: '1',
      valueType: ValueType.INT,
    });

    this.modelLatencyHistogram = this.meter.createHistogram('model_latency_seconds', {
      description: 'Latency of model requests in seconds',
      unit: 's',
      valueType: ValueType.DOUBLE,
    });

    this.modelErrorsCounter = this.meter.createCounter('model_errors_total', {
      description: 'Total count of model errors',
      unit: '1',
      valueType: ValueType.INT,
    });

    // Initialize tool metrics
    this.toolExecutionsCounter = this.meter.createCounter('tool_executions_total', {
      description: 'Total count of tool executions',
      unit: '1',
      valueType: ValueType.INT,
    });

    this.toolLatencyHistogram = this.meter.createHistogram('tool_latency_seconds', {
      description: 'Latency of tool executions in seconds',
      unit: 's',
      valueType: ValueType.DOUBLE,
    });

    this.toolErrorsCounter = this.meter.createCounter('tool_errors_total', {
      description: 'Total count of tool errors',
      unit: '1',
      valueType: ValueType.INT,
    });

    // Initialize cache metrics
    this.cacheHitRateGauge = this.meter.createObservableGauge('cache_hit_rate', {
      description: 'Cache hit rate (hits / total requests)',
      unit: '1',
      valueType: ValueType.DOUBLE,
    });

    this.cacheHitRateGauge.addCallback((result) => {
      const total = this.cacheStats.hits + this.cacheStats.misses;
      const hitRate = total > 0 ? this.cacheStats.hits / total : 0;
      result.observe(hitRate);
    });

    this.cacheOperationsCounter = this.meter.createCounter('cache_operations_total', {
      description: 'Total count of cache operations',
      unit: '1',
      valueType: ValueType.INT,
    });

    // Initialize queue metrics
    this.queueDepthGauge = this.meter.createObservableGauge('queue_depth', {
      description: 'Number of jobs waiting in queue',
      unit: '1',
      valueType: ValueType.INT,
    });

    this.queueDepthGauge.addCallback((result) => {
      result.observe(this.queueStats.depth);
    });

    this.workerUtilizationGauge = this.meter.createObservableGauge('worker_utilization', {
      description: 'Worker utilization (active / total)',
      unit: '1',
      valueType: ValueType.DOUBLE,
    });

    this.workerUtilizationGauge.addCallback((result) => {
      const utilization =
        this.queueStats.totalWorkers > 0
          ? this.queueStats.activeWorkers / this.queueStats.totalWorkers
          : 0;
      result.observe(utilization);
    });

    this.jobProcessingCounter = this.meter.createCounter('job_processing_total', {
      description: 'Total count of processed jobs',
      unit: '1',
      valueType: ValueType.INT,
    });

    // Initialize HTTP metrics
    this.httpRequestsCounter = this.meter.createCounter('http_requests_total', {
      description: 'Total count of HTTP requests',
      unit: '1',
      valueType: ValueType.INT,
    });

    this.httpDurationHistogram = this.meter.createHistogram('http_request_duration_seconds', {
      description: 'Duration of HTTP requests in seconds',
      unit: 's',
      valueType: ValueType.DOUBLE,
    });

    this.httpRequestSizeHistogram = this.meter.createHistogram('http_request_size_bytes', {
      description: 'Size of HTTP requests in bytes',
      unit: 'By',
      valueType: ValueType.INT,
    });

    this.httpResponseSizeHistogram = this.meter.createHistogram('http_response_size_bytes', {
      description: 'Size of HTTP responses in bytes',
      unit: 'By',
      valueType: ValueType.INT,
    });

    // Initialize database metrics
    this.dbQueryCounter = this.meter.createCounter('db_query_total', {
      description: 'Total count of database queries',
      unit: '1',
      valueType: ValueType.INT,
    });

    this.dbQueryDurationHistogram = this.meter.createHistogram('db_query_duration_seconds', {
      description: 'Duration of database queries in seconds',
      unit: 's',
      valueType: ValueType.DOUBLE,
    });

    this.dbConnectionPoolGauge = this.meter.createObservableGauge('db_connection_pool', {
      description: 'Database connection pool status',
      unit: '1',
      valueType: ValueType.INT,
    });

    this.dbConnectionPoolGauge.addCallback((result) => {
      result.observe(this.dbStats.activeConnections, { state: 'active' });
      result.observe(this.dbStats.idleConnections, { state: 'idle' });
      result.observe(this.dbStats.totalConnections, { state: 'total' });
    });

    console.log('Metrics collector initialized successfully');
  }

  // Run metrics
  recordRunDuration(durationSeconds: number, attributes: Record<string, string>): void {
    this.runDurationHistogram?.record(durationSeconds, attributes);
  }

  recordRunStatus(status: string, attributes: Record<string, string>): void {
    this.runStatusCounter?.add(1, { status, ...attributes });
  }

  // Model metrics
  recordModelRequest(model: string, provider: string): void {
    this.modelRequestsCounter?.add(1, { model, provider });
  }

  recordModelLatency(latencySeconds: number, model: string, provider: string): void {
    this.modelLatencyHistogram?.record(latencySeconds, { model, provider });
  }

  recordModelError(model: string, provider: string, errorType: string): void {
    this.modelErrorsCounter?.add(1, { model, provider, error_type: errorType });
  }

  // Tool metrics
  recordToolExecution(toolName: string, status: string): void {
    this.toolExecutionsCounter?.add(1, { tool: toolName, status });
  }

  recordToolLatency(latencySeconds: number, toolName: string): void {
    this.toolLatencyHistogram?.record(latencySeconds, { tool: toolName });
  }

  recordToolError(toolName: string, errorType: string): void {
    this.toolErrorsCounter?.add(1, { tool: toolName, error_type: errorType });
  }

  // Cache metrics
  recordCacheHit(): void {
    this.cacheStats.hits++;
    this.cacheOperationsCounter?.add(1, { operation: 'hit' });
  }

  recordCacheMiss(): void {
    this.cacheStats.misses++;
    this.cacheOperationsCounter?.add(1, { operation: 'miss' });
  }

  recordCacheOperation(operation: string): void {
    this.cacheOperationsCounter?.add(1, { operation });
  }

  // Queue metrics
  updateQueueDepth(depth: number): void {
    this.queueStats.depth = depth;
  }

  updateWorkerUtilization(active: number, total: number): void {
    this.queueStats.activeWorkers = active;
    this.queueStats.totalWorkers = total;
  }

  recordJobProcessed(status: string, queueName: string): void {
    this.jobProcessingCounter?.add(1, { status, queue: queueName });
  }

  // HTTP metrics
  recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    durationSeconds: number
  ): void {
    this.httpRequestsCounter?.add(1, { method, path, status: statusCode.toString() });
    this.httpDurationHistogram?.record(durationSeconds, {
      method,
      path,
      status: statusCode.toString(),
    });
  }

  recordHttpRequestSize(sizeBytes: number, method: string, path: string): void {
    this.httpRequestSizeHistogram?.record(sizeBytes, { method, path });
  }

  recordHttpResponseSize(sizeBytes: number, method: string, path: string): void {
    this.httpResponseSizeHistogram?.record(sizeBytes, { method, path });
  }

  // Database metrics
  recordDbQuery(operation: string, table: string, durationSeconds: number): void {
    this.dbQueryCounter?.add(1, { operation, table });
    this.dbQueryDurationHistogram?.record(durationSeconds, { operation, table });
  }

  updateDbConnectionPool(active: number, idle: number, total: number): void {
    this.dbStats.activeConnections = active;
    this.dbStats.idleConnections = idle;
    this.dbStats.totalConnections = total;
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

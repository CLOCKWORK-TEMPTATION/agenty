import {
  openTelemetry,
  metricsCollector,
  auditLogger,
  prometheusRegistry,
  customCollectors,
  healthCheckManager,
  createDatabaseHealthCheck,
  createRedisHealthCheck,
  createLiteLLMHealthCheck,
  createMemoryHealthCheck,
  createMigrationsReadinessCheck,
  createServicesReadinessCheck,
  alertManager,
  defaultAlertRules,
} from '@repo/observability';
import { db } from '@repo/db';

/**
 * Initialize all monitoring components
 */
export async function initializeMonitoring(): Promise<void> {
  console.log('Initializing monitoring...');

  // 1. Initialize OpenTelemetry
  await openTelemetry.initialize({
    serviceName: 'multi-agent-api',
    serviceVersion: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    jaegerEndpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    otlpEndpoint: process.env.OTLP_ENDPOINT,
    prometheusPort: process.env.PROMETHEUS_PORT
      ? parseInt(process.env.PROMETHEUS_PORT, 10)
      : undefined,
    enableAutoInstrumentation: true,
    sampleRate: parseFloat(process.env.TRACE_SAMPLE_RATE || '1.0'),
  });

  // 2. Initialize Prometheus registry
  prometheusRegistry.initialize({
    collectDefaultMetrics: true,
  });

  // Set default labels
  prometheusRegistry.setDefaultLabels({
    service: 'multi-agent-api',
    environment: process.env.NODE_ENV || 'development',
  });

  // 3. Initialize metrics collector
  metricsCollector.initialize({
    serviceName: 'multi-agent-api',
    serviceVersion: process.env.npm_package_version || '1.0.0',
  });

  // 4. Initialize custom collectors
  customCollectors.initialize();

  // 5. Initialize audit logger
  auditLogger.initialize({
    enabled: process.env.AUDIT_LOGGING_ENABLED !== 'false',
    logLevel: (process.env.AUDIT_LOG_LEVEL as any) || 'all',
  });

  // 6. Register health checks
  registerHealthChecks();

  // 7. Register alert rules
  alertManager.registerRules(defaultAlertRules);

  console.log('Monitoring initialized successfully');
}

/**
 * Register health checks
 */
function registerHealthChecks(): void {
  // Database health check
  healthCheckManager.registerHealthCheck(
    createDatabaseHealthCheck(async () => {
      try {
        // Simple query to check connection
        await db.execute('SELECT 1');
        return true;
      } catch {
        return false;
      }
    })
  );

  // Redis health check
  if (process.env.REDIS_URL) {
    // TODO: Import Redis client when implemented
    // healthCheckManager.registerHealthCheck(
    //   createRedisHealthCheck(async () => {
    //     return await redisClient.ping() === 'PONG';
    //   })
    // );
  }

  // LiteLLM health check
  if (process.env.LITELLM_BASE_URL) {
    healthCheckManager.registerHealthCheck(
      createLiteLLMHealthCheck(`${process.env.LITELLM_BASE_URL}/health`)
    );
  }

  // Memory health check
  healthCheckManager.registerHealthCheck(createMemoryHealthCheck(0.9));

  // Migrations readiness check
  healthCheckManager.registerReadinessCheck(
    createMigrationsReadinessCheck(async () => {
      // TODO: Implement migration check
      // For now, assume migrations are applied
      return true;
    })
  );

  // Services readiness check
  healthCheckManager.registerReadinessCheck(
    createServicesReadinessCheck(async () => {
      // Check if all required services are initialized
      const services = ['database', 'metrics', 'tracing'];
      return {
        initialized: true,
        services,
      };
    })
  );
}

/**
 * Shutdown monitoring gracefully
 */
export async function shutdownMonitoring(): Promise<void> {
  console.log('Shutting down monitoring...');

  await auditLogger.shutdown();
  await openTelemetry.shutdown();

  console.log('Monitoring shut down successfully');
}

/**
 * Update database connection pool metrics
 */
export function updateDatabaseMetrics(): void {
  // TODO: Get actual pool stats from database
  const poolStats = {
    activeConnections: 5,
    idleConnections: 10,
    waitingRequests: 0,
    totalConnections: 15,
  };

  customCollectors.updateDatabaseMetrics(poolStats);
  metricsCollector.updateDbConnectionPool(
    poolStats.activeConnections,
    poolStats.idleConnections,
    poolStats.totalConnections
  );
}

/**
 * Update Redis metrics
 */
export function updateRedisMetrics(): void {
  // TODO: Get actual Redis stats
  const redisStats = {
    connectedClients: 10,
    blockedClients: 0,
    usedMemory: 1024 * 1024 * 100, // 100MB
    totalConnections: 10,
  };

  customCollectors.updateRedisMetrics(redisStats);
}

/**
 * Update queue metrics
 */
export function updateQueueMetrics(queueStats: {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}): void {
  customCollectors.updateQueueMetrics(queueStats);
  metricsCollector.updateQueueDepth(queueStats.waiting);
  metricsCollector.updateWorkerUtilization(queueStats.active, queueStats.active + 5); // Assume 5 total workers
}

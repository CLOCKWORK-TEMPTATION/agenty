import type { FastifyInstance } from 'fastify';
import {
  prometheusRegistry,
  healthEndpoint,
  readinessEndpoint,
  livenessEndpoint,
  individualCheckEndpoint,
  sloMonitor,
  alertManager,
} from '@repo/observability';

/**
 * Register monitoring routes (Fastify)
 * 
 * Metrics and health endpoints:
 * - GET /metrics - Prometheus metrics
 * - GET /metrics/json - Metrics in JSON format
 * - GET /health - Health check
 * - GET /ready - Readiness check
 * - GET /alive - Liveness check
 * - GET /health/:checkName - Individual health check
 * - GET /slo - SLO status
 * - GET /alerts - Active alerts
 * - GET /alerts/history - Alert history
 */
export async function registerMonitoringRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Metrics endpoint for Prometheus
   * GET /metrics
   */
  app.get('/metrics', async (_request, reply) => {
    try {
      const metrics = await prometheusRegistry.getMetrics();
      reply.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      return reply.send(metrics);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to collect metrics',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Metrics in JSON format (for debugging)
   * GET /metrics/json
   */
  app.get('/metrics/json', async (_request, reply) => {
    try {
      const metrics = await prometheusRegistry.getMetricsJSON();
      return reply.send(metrics);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to collect metrics',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Health check endpoint
   * GET /health
   */
  app.get('/health', healthEndpoint);

  /**
   * Readiness check endpoint
   * GET /ready
   */
  app.get('/ready', readinessEndpoint);

  /**
   * Liveness check endpoint
   * GET /alive
   */
  app.get('/alive', livenessEndpoint);

  /**
   * Individual health check
   * GET /health/:checkName
   */
  app.get('/health/:checkName', individualCheckEndpoint);

  /**
   * SLO status endpoint
   * GET /slo
   */
  app.get('/slo', async (_request, reply) => {
    try {
      const report = sloMonitor.generateReport();
      return reply.send(report);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to generate SLO report',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Active alerts endpoint
   * GET /alerts
   */
  app.get('/alerts', async (_request, reply) => {
    try {
      const alerts = alertManager.getActiveAlerts();
      return reply.send({
        active_count: alerts.length,
        alerts,
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get alerts',
        message: (error as Error).message,
      });
    }
  });

  /**
   * Alert history endpoint
   * GET /alerts/history
   */
  app.get('/alerts/history', async (request, reply) => {
    try {
      const query = request.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 100;
      const history = alertManager.getAlertHistory(limit);
      return reply.send({
        count: history.length,
        alerts: history,
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get alert history',
        message: (error as Error).message,
      });
    }
  });
}

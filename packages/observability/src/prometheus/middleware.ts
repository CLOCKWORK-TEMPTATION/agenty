import { Counter, Histogram, register } from 'prom-client';
import type { FastifyInstance } from 'fastify';

/**
 * HTTP metrics for Fastify
 */
class HttpMetrics {
  private requestsTotal: Counter<string>;
  private requestDuration: Histogram<string>;
  private requestSize: Histogram<string>;
  private responseSize: Histogram<string>;

  constructor() {
    this.requestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [register],
    });

    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'path', 'status'],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10],
      registers: [register],
    });

    this.requestSize = new Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'path'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [register],
    });

    this.responseSize = new Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'path', 'status'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [register],
    });
  }

  /**
   * Register Fastify hooks for HTTP metrics
   */
  registerHooks(app: FastifyInstance): void {
    app.addHook('onRequest', async (request, _reply) => {
      // Store start time on the request
      (request as any).metricsStartTime = Date.now();
    });

    app.addHook('onSend', async (request, reply, payload) => {
      const startTime = (request as any).metricsStartTime;
      if (!startTime) return payload;

      const duration = (Date.now() - startTime) / 1000;
      const path = this.normalizePath(request.url);
      const method = request.method;
      const statusCode = reply.statusCode.toString();

      // Get request size
      const contentLength = request.headers['content-length'];
      const requestSize = contentLength ? parseInt(contentLength, 10) : 0;

      // Get response size
      const responseSize = typeof payload === 'string' ? Buffer.byteLength(payload) : 0;

      const labels = { method, path, status: statusCode };

      this.requestsTotal.inc(labels);
      this.requestDuration.observe(labels, duration);

      if (requestSize > 0) {
        this.requestSize.observe({ method, path }, requestSize);
      }

      if (responseSize > 0) {
        this.responseSize.observe(labels, responseSize);
      }

      return payload;
    });
  }

  /**
   * Normalize path to avoid high cardinality
   */
  private normalizePath(path: string): string {
    // Replace UUIDs with placeholder
    let normalized = path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id'
    );

    // Replace other IDs (numeric)
    normalized = normalized.replace(/\/\d+/g, '/:id');

    // Truncate very long paths
    if (normalized.length > 100) {
      normalized = normalized.substring(0, 100) + '...';
    }

    return normalized;
  }
}

// Singleton instance
export const httpMetrics = new HttpMetrics();

/**
 * Register Fastify hooks for prometheus metrics
 */
export function registerPrometheusHooks(app: FastifyInstance): void {
  httpMetrics.registerHooks(app);
}

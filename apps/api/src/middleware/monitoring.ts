import type { Request, Response, NextFunction } from 'express';
import {
  openTelemetry,
  metricsCollector,
  prometheusMiddleware,
} from '@repo/observability';

/**
 * Combined monitoring middleware
 * Combines Prometheus metrics and OpenTelemetry tracing
 */
export function monitoringMiddleware() {
  // Get Prometheus middleware
  const promMiddleware = prometheusMiddleware();

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const path = normalizePath(req.path);

    // Start OpenTelemetry span
    return openTelemetry.startActiveSpanAsync(
      `HTTP ${req.method} ${path}`,
      async (span) => {
        // Add span attributes
        span.setAttribute('http.method', req.method);
        span.setAttribute('http.url', req.url);
        span.setAttribute('http.path', path);
        span.setAttribute('http.user_agent', req.get('user-agent') || '');

        // Extract user info if available
        if (req.headers.authorization) {
          span.setAttribute('http.auth', 'present');
        }

        // Call Prometheus middleware
        promMiddleware(req, res, () => {
          // Hook into response finish
          const originalSend = res.send;
          res.send = function (body?: unknown): Response {
            // Calculate duration
            const duration = (Date.now() - startTime) / 1000;

            // Add response attributes to span
            span.setAttribute('http.status_code', res.statusCode);
            span.setAttribute('http.response_time', duration);

            // Record metrics
            metricsCollector.recordHttpRequest(
              req.method,
              path,
              res.statusCode,
              duration
            );

            // Mark span as error if status code >= 500
            if (res.statusCode >= 500) {
              openTelemetry.recordException(new Error(`HTTP ${res.statusCode}`));
            }

            return originalSend.call(this, body);
          };

          next();
        });
      }
    );
  };
}

/**
 * Normalize path to avoid cardinality explosion
 */
function normalizePath(path: string): string {
  // Replace UUIDs with :id
  let normalized = path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );

  // Replace numeric IDs
  normalized = normalized.replace(/\/\d+/g, '/:id');

  // Truncate very long paths
  if (normalized.length > 100) {
    normalized = normalized.substring(0, 100) + '...';
  }

  return normalized;
}

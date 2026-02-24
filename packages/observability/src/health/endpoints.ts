import type { FastifyRequest, FastifyReply } from 'fastify';
import { healthCheckManager } from './checks.js';

/**
 * Health check endpoint handler (Fastify)
 * Returns 200 if healthy, 503 if unhealthy
 */
export async function healthEndpoint(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const health = await healthCheckManager.checkHealth();

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    return reply.status(statusCode).send(health);
  } catch (error) {
    return reply.status(503).send({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime_seconds: 0,
      checks: {
        error: {
          status: 'unhealthy',
          message: (error as Error).message,
        },
      },
    });
  }
}

/**
 * Readiness check endpoint handler (Fastify)
 * Returns 200 if ready, 503 if not ready
 */
export async function readinessEndpoint(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const readiness = await healthCheckManager.checkReadiness();

    const statusCode = readiness.ready ? 200 : 503;

    return reply.status(statusCode).send(readiness);
  } catch (error) {
    return reply.status(503).send({
      ready: false,
      timestamp: new Date().toISOString(),
      checks: {
        error: {
          status: 'unhealthy',
          message: (error as Error).message,
        },
      },
    });
  }
}

/**
 * Liveness check endpoint handler (Fastify)
 * Simple endpoint that returns 200 if the process is alive
 */
export async function livenessEndpoint(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await reply.status(200).send({
    alive: true,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Individual health check endpoint handler (Fastify)
 */
export async function individualCheckEndpoint(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const checkName = (request.params as { checkName: string }).checkName;

  if (!checkName) {
    return reply.status(400).send({
      error: 'Check name is required',
    });
  }

  try {
    const result = await healthCheckManager.checkIndividual(checkName);

    if (!result) {
      return reply.status(404).send({
        error: `Health check '${checkName}' not found`,
      });
    }

    const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

    return reply.status(statusCode).send({
      check: checkName,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    return reply.status(503).send({
      check: checkName,
      timestamp: new Date().toISOString(),
      result: {
        status: 'unhealthy',
        message: (error as Error).message,
      },
    });
  }
}

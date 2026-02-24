import type { FastifyInstance } from 'fastify';
import { registerQueueRoutes } from './queues.js';
import { registerIntegrationRoutes } from './integrations.js';
import { registerMonitoringRoutes } from './monitoring.js';
import { registerCacheRoutes } from './cache.js';
import type { CacheManager } from '@repo/db/cache';

export interface RoutesDependencies {
  cacheManager?: CacheManager;
}

/**
 * Register all API routes
 */
export async function registerRoutes(app: FastifyInstance, deps: RoutesDependencies = {}): Promise<void> {
  // Register queue routes
  await registerQueueRoutes(app);
  
  // Register integration routes (Slack, GitHub, Audit logs)
  await registerIntegrationRoutes(app);
  
  // Register monitoring routes (metrics, health, alerts)
  await registerMonitoringRoutes(app);
  
  // Register cache routes if cacheManager is provided
  if (deps.cacheManager) {
    await registerCacheRoutes(app, { cacheManager: deps.cacheManager });
  }
}

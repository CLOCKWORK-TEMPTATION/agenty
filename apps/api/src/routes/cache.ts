import type { FastifyInstance } from "fastify";
import type { CacheManager } from "@repo/db/cache";

/**
 * Cache API Routes (Fastify)
 *
 * Provides admin endpoints for cache management:
 * - GET /api/v1/cache/stats - Get cache statistics
 * - POST /api/v1/cache/invalidate - Invalidate cache entries
 * - POST /api/v1/cache/warm - Warm up cache
 * - GET /api/v1/cache/hits/:modelId - Get cache hits for model
 * - POST /api/v1/cache/cleanup - Manually trigger cleanup
 * - GET /api/v1/cache/health - Check cache health
 * - GET /api/v1/cache/top-prompts - Get top cached prompts
 */

export interface CacheRoutesDependencies {
  cacheManager: CacheManager;
}

export async function registerCacheRoutes(
  app: FastifyInstance,
  deps: CacheRoutesDependencies
): Promise<void> {
  const { cacheManager } = deps;

  /**
   * GET /api/v1/cache/stats
   * Get cache statistics
   */
  app.get("/api/v1/cache/stats", async (_request, reply) => {
    const stats = await cacheManager.getStatistics();
    return reply.send({
      success: true,
      data: stats
    });
  });

  /**
   * POST /api/v1/cache/invalidate
   * Invalidate cache entries
   *
   * Body:
   * - model?: string - Invalidate by model
   * - all?: boolean - Invalidate all entries
   */
  app.post("/api/v1/cache/invalidate", async (request, reply) => {
    const body = request.body as { model?: string; all?: boolean };
    const { model, all } = body;

    let deletedCount = 0;

    if (all) {
      deletedCount = await cacheManager.invalidateAll();
    } else if (model) {
      deletedCount = await cacheManager.invalidateByModel(model);
    } else {
      return reply.status(400).send({
        success: false,
        error: "Must specify either 'model' or 'all' parameter"
      });
    }

    return reply.send({
      success: true,
      data: {
        deletedCount,
        message: `Invalidated ${deletedCount} cache entries`
      }
    });
  });

  /**
   * POST /api/v1/cache/warm
   * Warm up cache from pgvector to Redis
   */
  app.post("/api/v1/cache/warm", async (_request, reply) => {
    await cacheManager.warmUp();

    return reply.send({
      success: true,
      data: {
        message: "Cache warmed up successfully"
      }
    });
  });

  /**
   * GET /api/v1/cache/hits/:modelId
   * Get cache hits for a specific model
   */
  app.get("/api/v1/cache/hits/:modelId", async (request, reply) => {
    const { modelId } = request.params as { modelId: string };

    const stats = await cacheManager.getStatistics();

    // Filter hits for the specific model
    const modelBreakdown = stats.pgvector.modelBreakdown.find(
      m => m.model === modelId
    );

    if (!modelBreakdown) {
      return reply.send({
        success: true,
        data: {
          model: modelId,
          count: 0,
          hitRate: 0
        }
      });
    }

    return reply.send({
      success: true,
      data: {
        model: modelId,
        count: modelBreakdown.count,
        hitRate: stats.overall.hitRate
      }
    });
  });

  /**
   * POST /api/v1/cache/cleanup
   * Manually trigger cache cleanup
   */
  app.post("/api/v1/cache/cleanup", async (_request, reply) => {
    const result = await cacheManager.cleanup();

    return reply.send({
      success: true,
      data: {
        deletedCount: result.deletedCount,
        cleanupTime: result.cleanupTime,
        message: `Cleaned up ${result.deletedCount} expired entries in ${result.cleanupTime}ms`
      }
    });
  });

  /**
   * GET /api/v1/cache/health
   * Check cache health
   */
  app.get("/api/v1/cache/health", async (_request, reply) => {
    const health = await cacheManager.checkHealth();

    return reply.send({
      success: true,
      data: health
    });
  });

  /**
   * GET /api/v1/cache/top-prompts
   * Get top cached prompts
   *
   * Query params:
   * - limit?: number - Number of prompts to return (default: 10, max: 100)
   */
  app.get("/api/v1/cache/top-prompts", async (request, reply) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(
      parseInt(query.limit ?? "10") || 10,
      100
    );

    const topPrompts = await cacheManager.getTopPrompts(limit);

    return reply.send({
      success: true,
      data: {
        prompts: topPrompts,
        count: topPrompts.length
      }
    });
  });
}

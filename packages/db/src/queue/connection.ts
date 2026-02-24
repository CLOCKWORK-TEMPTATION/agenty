import type { RedisOptions } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * Redis connection configuration for BullMQ queues
 * Supports both single instance and cluster configurations
 */

export interface RedisConnectionConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  tls?: {
    rejectUnauthorized: boolean;
  };
}

/**
 * Parse Redis connection URL and return configuration
 */
export function parseRedisUrl(url: string): RedisConnectionConfig {
  const parsed = new URL(url);
  const config: RedisConnectionConfig = {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) : 0,
    maxRetriesPerRequest: null as unknown as number, // Required for BullMQ
    enableReadyCheck: false,
  };

  if (parsed.password) {
    config.password = parsed.password;
  }

  return config;
}

/**
 * Get Redis connection options for BullMQ
 */
export function getRedisConnection(): RedisOptions {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const config = parseRedisUrl(redisUrl);

  return {
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    enableReadyCheck: config.enableReadyCheck,
  };
}

/**
 * Create a new Redis client for BullMQ
 */
export function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const config = parseRedisUrl(redisUrl);

  return new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
}

/**
 * Test Redis connection
 */
export async function testRedisConnection(): Promise<boolean> {
  const client = createRedisClient();

  try {
    await client.ping();
    await client.quit();
    return true;
  } catch (error) {
    console.error('Redis connection failed:', error);
    return false;
  }
}

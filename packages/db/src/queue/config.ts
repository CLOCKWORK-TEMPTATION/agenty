import type { QueueOptions, WorkerOptions, JobsOptions } from 'bullmq';
import { getRedisConnection } from './connection.js';

/**
 * Queue names constants
 */
export const QUEUE_NAMES = {
  TEAM_EXECUTION: 'team-execution',
  TOOL_EXECUTION: 'tool-execution',
  BATCH_PROCESSING: 'batch-processing',
  NOTIFICATION: 'notification',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * Default queue configuration
 */
export const DEFAULT_QUEUE_OPTIONS: QueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
    backoff: {
      type: 'exponential',
      delay: 2000, // 2 seconds initial delay
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      count: 5000, // Keep last 5000 failed jobs
    },
  },
};

/**
 * Default worker configuration
 */
export const DEFAULT_WORKER_OPTIONS: Omit<WorkerOptions, 'connection'> = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  lockDuration: 30000, // 30 seconds
  maxStalledCount: 2,
  stalledInterval: 5000, // 5 seconds
};

/**
 * Get worker options with Redis connection
 */
export function getWorkerOptions(
  overrides?: Partial<WorkerOptions>,
): WorkerOptions {
  return {
    ...DEFAULT_WORKER_OPTIONS,
    connection: getRedisConnection(),
    ...overrides,
  };
}

/**
 * Job timeout configurations by queue type
 */
export const JOB_TIMEOUTS: Record<QueueName, number> = {
  [QUEUE_NAMES.TEAM_EXECUTION]: parseInt(
    process.env.TEAM_EXECUTION_TIMEOUT || '300000',
    10,
  ), // 5 minutes
  [QUEUE_NAMES.TOOL_EXECUTION]: parseInt(
    process.env.TOOL_EXECUTION_TIMEOUT || '60000',
    10,
  ), // 1 minute
  [QUEUE_NAMES.BATCH_PROCESSING]: parseInt(
    process.env.BATCH_PROCESSING_TIMEOUT || '600000',
    10,
  ), // 10 minutes
  [QUEUE_NAMES.NOTIFICATION]: parseInt(
    process.env.NOTIFICATION_TIMEOUT || '30000',
    10,
  ), // 30 seconds
};

/**
 * Get job options for a specific queue
 */
export function getJobOptions(
  _queueName: QueueName,
  overrides?: Partial<JobsOptions>,
): JobsOptions {
  const options: JobsOptions = {
    attempts: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 5000,
    },
  };

  // Add overrides
  if (overrides) {
    Object.assign(options, overrides);
  }

  return options;
}

/**
 * Priority levels for jobs
 */
export enum JobPriority {
  LOW = 10,
  NORMAL = 5,
  HIGH = 1,
  CRITICAL = 0,
}

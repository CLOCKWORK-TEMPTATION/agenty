import { Queue } from 'bullmq';
import {
  DEFAULT_QUEUE_OPTIONS,
  QUEUE_NAMES,
  getJobOptions,
  JobPriority,
} from '../config.js';
import type {
  TeamExecutionJobData,
  TeamExecutionJobResult,
} from '../types.js';

/**
 * Team execution queue for async task execution
 * Handles agent team orchestration jobs with priority support
 */
export class TeamExecutionQueue {
  private queue: Queue<TeamExecutionJobData, TeamExecutionJobResult>;

  constructor() {
    this.queue = new Queue<TeamExecutionJobData, TeamExecutionJobResult>(
      QUEUE_NAMES.TEAM_EXECUTION,
      DEFAULT_QUEUE_OPTIONS,
    );
  }

  /**
   * Add a team execution job to the queue
   */
  async addJob(
    data: TeamExecutionJobData,
    options?: {
      priority?: JobPriority;
      delay?: number;
      jobId?: string;
    },
  ) {
    const jobOptions = getJobOptions(QUEUE_NAMES.TEAM_EXECUTION, {
      priority: options?.priority ?? JobPriority.NORMAL,
      ...(options?.delay !== undefined && { delay: options.delay }),
      jobId: options?.jobId ?? data.run_id,
    });

    const job = await this.queue.add(
      `team-execution-${data.run_id}`,
      data,
      jobOptions,
    );

    return {
      job_id: job.id,
      run_id: data.run_id,
      queue_name: QUEUE_NAMES.TEAM_EXECUTION,
    };
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string) {
    return this.queue.getJob(jobId);
  }

  /**
   * Get job by run ID
   */
  async getJobByRunId(runId: string) {
    return this.queue.getJob(runId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      return true;
    }
    return false;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.retry();
      return true;
    }
    return false;
  }

  /**
   * Get queue metrics
   */
  async getMetrics() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      queue_name: QUEUE_NAMES.TEAM_EXECUTION,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Get waiting jobs
   */
  async getWaitingJobs(start = 0, end = 10) {
    return this.queue.getWaiting(start, end);
  }

  /**
   * Get active jobs
   */
  async getActiveJobs(start = 0, end = 10) {
    return this.queue.getActive(start, end);
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(start = 0, end = 10) {
    return this.queue.getCompleted(start, end);
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(start = 0, end = 10) {
    return this.queue.getFailed(start, end);
  }

  /**
   * Clean old jobs
   */
  async cleanJobs(grace: number = 24 * 3600 * 1000) {
    await this.queue.clean(grace, 1000, 'completed');
    await this.queue.clean(7 * 24 * 3600 * 1000, 1000, 'failed');
  }

  /**
   * Pause queue
   */
  async pause() {
    await this.queue.pause();
  }

  /**
   * Resume queue
   */
  async resume() {
    await this.queue.resume();
  }

  /**
   * Close queue connection
   */
  async close() {
    await this.queue.close();
  }

  /**
   * Get the underlying BullMQ queue instance
   */
  getQueue() {
    return this.queue;
  }
}

// Export singleton instance
let teamExecutionQueue: TeamExecutionQueue | null = null;

export function getTeamExecutionQueue(): TeamExecutionQueue {
  if (!teamExecutionQueue) {
    teamExecutionQueue = new TeamExecutionQueue();
  }
  return teamExecutionQueue;
}

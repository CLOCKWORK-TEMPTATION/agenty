import { Queue } from 'bullmq';
import { DEFAULT_QUEUE_OPTIONS, QUEUE_NAMES, getJobOptions } from '../config.js';
import type { ToolExecutionJobData, ToolExecutionJobResult } from '../types.js';

/**
 * Tool execution queue for parallel tool execution
 * Supports high concurrency for tool operations
 */
export class ToolExecutionQueue {
  private queue: Queue<ToolExecutionJobData, ToolExecutionJobResult>;

  constructor() {
    this.queue = new Queue<ToolExecutionJobData, ToolExecutionJobResult>(
      QUEUE_NAMES.TOOL_EXECUTION,
      DEFAULT_QUEUE_OPTIONS,
    );
  }

  /**
   * Add a tool execution job to the queue
   */
  async addJob(
    data: ToolExecutionJobData,
    options?: {
      priority?: number;
      delay?: number;
      jobId?: string;
    },
  ) {
    const jobOptions = getJobOptions(QUEUE_NAMES.TOOL_EXECUTION, {
      priority: options?.priority ?? 5,
      ...(options?.delay !== undefined && { delay: options.delay }),
      ...(options?.jobId && { jobId: options.jobId }),
    });

    const job = await this.queue.add(
      `tool-${data.tool_name}-${data.trace_id}`,
      data,
      jobOptions,
    );

    return {
      job_id: job.id,
      tool_name: data.tool_name,
      queue_name: QUEUE_NAMES.TOOL_EXECUTION,
    };
  }

  /**
   * Add multiple tool execution jobs in bulk
   */
  async addBulkJobs(
    jobs: Array<{
      data: ToolExecutionJobData;
      options?: {
        priority?: number;
        delay?: number;
        jobId?: string;
      };
    }>,
  ) {
    const bulkJobs = jobs.map((job) => ({
      name: `tool-${job.data.tool_name}-${job.data.trace_id}`,
      data: job.data,
      opts: getJobOptions(QUEUE_NAMES.TOOL_EXECUTION, {
        priority: job.options?.priority ?? 5,
        ...(job.options?.delay !== undefined && { delay: job.options.delay }),
        ...(job.options?.jobId && { jobId: job.options.jobId }),
      }),
    }));

    const addedJobs = await this.queue.addBulk(bulkJobs);

    return (addedJobs || []).map((job, index) => ({
      job_id: job?.id || '',
      tool_name: jobs[index]?.data.tool_name || '',
      queue_name: QUEUE_NAMES.TOOL_EXECUTION,
    }));
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string) {
    return this.queue.getJob(jobId);
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
      queue_name: QUEUE_NAMES.TOOL_EXECUTION,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Get active jobs grouped by tool
   */
  async getActiveJobsByTool() {
    const activeJobs = await this.queue.getActive();
    const grouped = new Map<string, number>();

    for (const job of activeJobs) {
      const toolName = job.data.tool_name;
      grouped.set(toolName, (grouped.get(toolName) || 0) + 1);
    }

    return Object.fromEntries(grouped);
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
let toolExecutionQueue: ToolExecutionQueue | null = null;

export function getToolExecutionQueue(): ToolExecutionQueue {
  if (!toolExecutionQueue) {
    toolExecutionQueue = new ToolExecutionQueue();
  }
  return toolExecutionQueue;
}

import { Queue } from 'bullmq';
import {
  DEFAULT_QUEUE_OPTIONS,
  QUEUE_NAMES,
  getJobOptions,
} from '../config.js';
import type {
  BatchProcessingJobData,
  BatchProcessingJobResult,
} from '../types.js';

/**
 * Batch processing queue for large dataset operations
 * Supports chunking and progress tracking
 */
export class BatchProcessingQueue {
  private queue: Queue<BatchProcessingJobData, BatchProcessingJobResult>;

  constructor() {
    this.queue = new Queue<BatchProcessingJobData, BatchProcessingJobResult>(
      QUEUE_NAMES.BATCH_PROCESSING,
      DEFAULT_QUEUE_OPTIONS,
    );
  }

  /**
   * Add a batch processing job to the queue
   */
  async addJob(
    data: BatchProcessingJobData,
    options?: {
      priority?: number;
      delay?: number;
      jobId?: string;
    },
  ) {
    const jobOptions = getJobOptions(QUEUE_NAMES.BATCH_PROCESSING, {
      priority: options?.priority ?? 5,
      ...(options?.delay !== undefined && { delay: options.delay }),
      jobId: options?.jobId ?? data.batch_id,
    });

    const job = await this.queue.add(
      `batch-${data.operation}-${data.batch_id}`,
      data,
      jobOptions,
    );

    return {
      job_id: job.id,
      batch_id: data.batch_id,
      queue_name: QUEUE_NAMES.BATCH_PROCESSING,
      total_items: data.items.length,
    };
  }

  /**
   * Add multiple batch jobs with automatic chunking
   */
  async addBatchWithChunking(
    data: BatchProcessingJobData,
    chunkSize: number = 100,
  ) {
    const chunks: BatchProcessingJobData[] = [];

    for (let i = 0; i < data.items.length; i += chunkSize) {
      const chunkItems = data.items.slice(i, i + chunkSize);
      chunks.push({
        ...data,
        batch_id: `${data.batch_id}-chunk-${Math.floor(i / chunkSize)}`,
        items: chunkItems,
        chunk_size: chunkSize,
      });
    }

    const results = await Promise.all(
      chunks.map((chunk) => this.addJob(chunk)),
    );

    return {
      batch_id: data.batch_id,
      total_chunks: chunks.length,
      total_items: data.items.length,
      chunk_jobs: results,
    };
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string) {
    return this.queue.getJob(jobId);
  }

  /**
   * Get job by batch ID
   */
  async getJobByBatchId(batchId: string) {
    return this.queue.getJob(batchId);
  }

  /**
   * Get all jobs for a batch (including chunks)
   */
  async getJobsByBatchId(batchId: string) {
    const allJobs = await this.queue.getJobs();
    return allJobs.filter((job: { data: BatchProcessingJobData }) => job.data.batch_id.startsWith(batchId));
  }

  /**
   * Get batch progress across all chunks
   */
  async getBatchProgress(batchId: string) {
    const jobs = await this.getJobsByBatchId(batchId);
    let totalItems = 0;
    let processedItems = 0;
    let failedItems = 0;

    for (const job of jobs) {
      totalItems += job.data.items.length;
      if (job.returnvalue as BatchProcessingJobResult) {
        const result = job.returnvalue as BatchProcessingJobResult;
        processedItems += result.processed_items;
        failedItems += result.failed_items;
      }
    }

    return {
      batch_id: batchId,
      total_items: totalItems,
      processed_items: processedItems,
      failed_items: failedItems,
      percentage: totalItems > 0 ? (processedItems / totalItems) * 100 : 0,
      chunks: jobs.length,
    };
  }

  /**
   * Cancel all jobs for a batch
   */
  async cancelBatch(batchId: string) {
    const jobs = await this.getJobsByBatchId(batchId);
    await Promise.all(jobs.map((job) => job.remove()));
    return jobs.length;
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
      queue_name: QUEUE_NAMES.BATCH_PROCESSING,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
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
let batchProcessingQueue: BatchProcessingQueue | null = null;

export function getBatchProcessingQueue(): BatchProcessingQueue {
  if (!batchProcessingQueue) {
    batchProcessingQueue = new BatchProcessingQueue();
  }
  return batchProcessingQueue;
}

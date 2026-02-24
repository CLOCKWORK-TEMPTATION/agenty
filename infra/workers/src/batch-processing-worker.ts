import { Worker } from 'bullmq';
import {
  QUEUE_NAMES,
  getWorkerOptions,
  type BatchProcessingJobData,
  type BatchProcessingJobResult,
  type TypedJob,
} from '@repo/db/queue';

/**
 * Batch processing worker
 * Processes large datasets with chunking and progress tracking
 */
export class BatchProcessingWorker {
  private worker: Worker<BatchProcessingJobData, BatchProcessingJobResult>;

  constructor() {
    this.worker = new Worker<BatchProcessingJobData, BatchProcessingJobResult>(
      QUEUE_NAMES.BATCH_PROCESSING,
      this.processJob.bind(this),
      getWorkerOptions({
        concurrency: parseInt(
          process.env.BATCH_PROCESSING_CONCURRENCY || '5',
          10,
        ),
      }),
    );

    this.setupEventListeners();
  }

  /**
   * Process a batch processing job
   */
  private async processJob(
    job: TypedJob<'batch-processing'>,
  ): Promise<BatchProcessingJobResult> {
    const { batch_id, items, operation } = job.data;
    const results: BatchProcessingJobResult['results'] = [];

    let processedItems = 0;
    let failedItems = 0;

    try {
      // Process items in the batch
      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        try {
          // Update progress
          const progress = Math.round(((i + 1) / items.length) * 100);
          await job.updateProgress({
            percentage: progress,
            current_step: `Processing item ${i + 1}/${items.length}`,
            message: `Operation: ${operation}`,
          });

          // Process individual item based on operation
          const result = await this.processItem(item, operation);
          results.push({
            id: item.id,
            success: true,
            result,
          });

          processedItems++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          results.push({
            id: item.id,
            success: false,
            error: errorMessage,
          });

          failedItems++;
        }
      }

      return {
        batch_id,
        total_items: items.length,
        processed_items: processedItems,
        failed_items: failedItems,
        results,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(
        `[BatchProcessingWorker] Batch ${batch_id} failed:`,
        errorMessage,
      );

      return {
        batch_id,
        total_items: items.length,
        processed_items: processedItems,
        failed_items: items.length - processedItems,
        results,
      };
    }
  }

  /**
   * Process individual item based on operation type
   */
  private async processItem(
    item: { id: string; data: Record<string, unknown> },
    operation: 'aggregate' | 'transform' | 'validate' | 'export',
  ): Promise<unknown> {
    // Placeholder implementation
    // TODO: Implement actual batch operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    switch (operation) {
      case 'aggregate':
        return { aggregated: true, data: item.data };
      case 'transform':
        return { transformed: true, data: item.data };
      case 'validate':
        return { valid: true, data: item.data };
      case 'export':
        return { exported: true, data: item.data };
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Setup event listeners for the worker
   */
  private setupEventListeners() {
    this.worker.on('completed', (job, result) => {
      console.log(
        `[BatchProcessingWorker] Batch ${result.batch_id} completed: ${result.processed_items}/${result.total_items} items processed, ${result.failed_items} failed`,
      );
    });

    this.worker.on('failed', (job, error) => {
      console.error(
        `[BatchProcessingWorker] Job ${job?.id} failed:`,
        error.message,
      );
    });

    this.worker.on('error', (error) => {
      console.error('[BatchProcessingWorker] Worker error:', error);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`[BatchProcessingWorker] Job ${jobId} stalled`);
    });

    this.worker.on('progress', (job, progress) => {
      if (typeof progress === 'object' && 'percentage' in progress) {
        console.log(
          `[BatchProcessingWorker] Job ${job.id} progress: ${progress.percentage}%`,
        );
      }
    });
  }

  /**
   * Start the worker
   */
  async start() {
    console.log('[BatchProcessingWorker] Worker started');
  }

  /**
   * Stop the worker gracefully
   */
  async stop() {
    console.log('[BatchProcessingWorker] Stopping worker...');
    await this.worker.close();
    console.log('[BatchProcessingWorker] Worker stopped');
  }

  /**
   * Get the underlying BullMQ worker instance
   */
  getWorker() {
    return this.worker;
  }
}

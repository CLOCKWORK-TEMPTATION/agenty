import { Worker } from 'bullmq';
import {
  QUEUE_NAMES,
  getWorkerOptions,
  type ToolExecutionJobData,
  type ToolExecutionJobResult,
  type TypedJob,
} from '@repo/db/queue';

/**
 * Tool execution worker
 * Processes tool execution jobs with high concurrency
 */
export class ToolExecutionWorker {
  private worker: Worker<ToolExecutionJobData, ToolExecutionJobResult>;

  constructor() {
    this.worker = new Worker<ToolExecutionJobData, ToolExecutionJobResult>(
      QUEUE_NAMES.TOOL_EXECUTION,
      this.processJob.bind(this),
      getWorkerOptions({
        concurrency: parseInt(
          process.env.TOOL_EXECUTION_CONCURRENCY || '10',
          10,
        ),
      }),
    );

    this.setupEventListeners();
  }

  /**
   * Process a tool execution job
   */
  private async processJob(
    job: TypedJob<'tool-execution'>,
  ): Promise<ToolExecutionJobResult> {
    const startTime = Date.now();
    const { tool_name, parameters, context } = job.data;

    try {
      // TODO: Import and use ToolBroker when available
      // For now, we'll use a placeholder implementation
      // const toolBroker = new ToolBroker();
      // const result = await toolBroker.executeTool({
      //   tool_name,
      //   parameters,
      //   context,
      // });

      // Placeholder implementation
      console.log(`[ToolExecutionWorker] Executing tool: ${tool_name}`);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate work

      const executionTime = Date.now() - startTime;

      const result: ToolExecutionJobResult = {
        tool_name,
        success: true,
        result: {
          message: `Tool ${tool_name} executed successfully`,
          // This will be replaced with actual tool output
        },
        execution_time_ms: executionTime,
      };

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        tool_name,
        success: false,
        error: errorMessage,
        execution_time_ms: executionTime,
      };
    }
  }

  /**
   * Setup event listeners for the worker
   */
  private setupEventListeners() {
    this.worker.on('completed', (job, result) => {
      console.log(
        `[ToolExecutionWorker] Tool ${result.tool_name} completed in ${result.execution_time_ms}ms`,
      );
    });

    this.worker.on('failed', (job, error) => {
      console.error(
        `[ToolExecutionWorker] Job ${job?.id} failed:`,
        error.message,
      );
    });

    this.worker.on('error', (error) => {
      console.error('[ToolExecutionWorker] Worker error:', error);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`[ToolExecutionWorker] Job ${jobId} stalled`);
    });
  }

  /**
   * Start the worker
   */
  async start() {
    console.log('[ToolExecutionWorker] Worker started');
  }

  /**
   * Stop the worker gracefully
   */
  async stop() {
    console.log('[ToolExecutionWorker] Stopping worker...');
    await this.worker.close();
    console.log('[ToolExecutionWorker] Worker stopped');
  }

  /**
   * Get the underlying BullMQ worker instance
   */
  getWorker() {
    return this.worker;
  }
}

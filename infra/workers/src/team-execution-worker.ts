import { Worker } from 'bullmq';
import {
  QUEUE_NAMES,
  getWorkerOptions,
  type TeamExecutionJobData,
  type TeamExecutionJobResult,
  type TypedJob,
} from '@repo/db/queue';
import { getNotificationQueue } from '@repo/db/queue';

/**
 * Team execution worker
 * Processes agent team orchestration jobs
 */
export class TeamExecutionWorker {
  private worker: Worker<TeamExecutionJobData, TeamExecutionJobResult>;

  constructor() {
    this.worker = new Worker<TeamExecutionJobData, TeamExecutionJobResult>(
      QUEUE_NAMES.TEAM_EXECUTION,
      this.processJob.bind(this),
      getWorkerOptions({
        concurrency: parseInt(
          process.env.TEAM_EXECUTION_CONCURRENCY || '3',
          10,
        ),
      }),
    );

    this.setupEventListeners();
  }

  /**
   * Process a team execution job
   */
  private async processJob(
    job: TypedJob<'team-execution'>,
  ): Promise<TeamExecutionJobResult> {
    const startTime = Date.now();
    const { run_id, user_id, request, template_id } = job.data;

    try {
      // Update progress
      await job.updateProgress({
        percentage: 10,
        current_step: 'initialization',
        message: 'Starting team execution',
      });

      // TODO: Import and use AgentOrchestrator when available
      // For now, we'll use a placeholder implementation
      // const orchestrator = new AgentOrchestrator();
      // const result = await orchestrator.run({
      //   run_id,
      //   user_request: request.user_request,
      //   context: request.context,
      //   template_id,
      //   preferences: request.preferences,
      // });

      // Placeholder implementation
      await job.updateProgress({
        percentage: 50,
        current_step: 'execution',
        message: 'Processing agent team workflow',
      });

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await job.updateProgress({
        percentage: 90,
        current_step: 'finalization',
        message: 'Finalizing results',
      });

      const executionTime = Date.now() - startTime;

      const result: TeamExecutionJobResult = {
        run_id,
        status: 'completed',
        output: {
          message: 'Team execution completed successfully',
          // This will be replaced with actual output from orchestrator
        },
        execution_time_ms: executionTime,
        steps_completed: 10,
        models_used: ['gpt-4', 'claude-3-opus'],
      };

      // Send completion notification
      const notificationQueue = getNotificationQueue();
      await notificationQueue.sendRunCompleteNotification(
        user_id,
        run_id,
        { status: 'completed', output: result.output },
      );

      await job.updateProgress({
        percentage: 100,
        current_step: 'completed',
        message: 'Team execution completed',
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Send failure notification
      const notificationQueue = getNotificationQueue();
      await notificationQueue.sendRunFailedNotification(
        user_id,
        run_id,
        errorMessage,
      );

      return {
        run_id,
        status: 'failed',
        error: errorMessage,
        execution_time_ms: executionTime,
        steps_completed: 0,
        models_used: [],
      };
    }
  }

  /**
   * Setup event listeners for the worker
   */
  private setupEventListeners() {
    this.worker.on('completed', (job, result) => {
      console.log(
        `[TeamExecutionWorker] Job ${job.id} completed in ${result.execution_time_ms}ms`,
      );
    });

    this.worker.on('failed', (job, error) => {
      console.error(
        `[TeamExecutionWorker] Job ${job?.id} failed:`,
        error.message,
      );
    });

    this.worker.on('error', (error) => {
      console.error('[TeamExecutionWorker] Worker error:', error);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`[TeamExecutionWorker] Job ${jobId} stalled`);
    });

    this.worker.on('progress', (job, progress) => {
      if (typeof progress === 'object' && 'percentage' in progress) {
        console.log(
          `[TeamExecutionWorker] Job ${job.id} progress: ${progress.percentage}% - ${progress.message}`,
        );
      }
    });
  }

  /**
   * Start the worker
   */
  async start() {
    console.log('[TeamExecutionWorker] Worker started');
  }

  /**
   * Stop the worker gracefully
   */
  async stop() {
    console.log('[TeamExecutionWorker] Stopping worker...');
    await this.worker.close();
    console.log('[TeamExecutionWorker] Worker stopped');
  }

  /**
   * Get the underlying BullMQ worker instance
   */
  getWorker() {
    return this.worker;
  }
}

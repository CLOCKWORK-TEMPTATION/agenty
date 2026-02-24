import { TeamExecutionWorker } from './team-execution-worker.js';
import { ToolExecutionWorker } from './tool-execution-worker.js';
import { BatchProcessingWorker } from './batch-processing-worker.js';
import { NotificationWorker } from './notification-worker.js';
import { WorkerMonitor } from './monitor.js';

/**
 * Worker manager
 * Manages lifecycle of all workers and provides health checking
 */
export class WorkerManager {
  private teamExecutionWorker?: TeamExecutionWorker;
  private toolExecutionWorker?: ToolExecutionWorker;
  private batchProcessingWorker?: BatchProcessingWorker;
  private notificationWorker?: NotificationWorker;
  private monitor?: WorkerMonitor;

  private isRunning = false;
  private shutdownHandlers: Array<() => void> = [];

  /**
   * Start all workers
   */
  async start() {
    if (this.isRunning) {
      console.warn('[WorkerManager] Workers are already running');
      return;
    }

    console.log('[WorkerManager] Starting workers...');

    try {
      // Initialize workers
      this.teamExecutionWorker = new TeamExecutionWorker();
      this.toolExecutionWorker = new ToolExecutionWorker();
      this.batchProcessingWorker = new BatchProcessingWorker();
      this.notificationWorker = new NotificationWorker();

      // Start all workers
      await Promise.all([
        this.teamExecutionWorker.start(),
        this.toolExecutionWorker.start(),
        this.batchProcessingWorker.start(),
        this.notificationWorker.start(),
      ]);

      // Initialize monitor
      this.monitor = new WorkerMonitor({
        teamExecutionWorker: this.teamExecutionWorker,
        toolExecutionWorker: this.toolExecutionWorker,
        batchProcessingWorker: this.batchProcessingWorker,
        notificationWorker: this.notificationWorker,
      });

      this.isRunning = true;

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      console.log('[WorkerManager] All workers started successfully');
    } catch (error) {
      console.error('[WorkerManager] Failed to start workers:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop all workers gracefully
   */
  async stop() {
    if (!this.isRunning) {
      console.warn('[WorkerManager] Workers are not running');
      return;
    }

    console.log('[WorkerManager] Stopping workers gracefully...');

    try {
      // Stop accepting new jobs
      const stopPromises: Promise<void>[] = [];

      if (this.teamExecutionWorker) {
        stopPromises.push(this.teamExecutionWorker.stop());
      }
      if (this.toolExecutionWorker) {
        stopPromises.push(this.toolExecutionWorker.stop());
      }
      if (this.batchProcessingWorker) {
        stopPromises.push(this.batchProcessingWorker.stop());
      }
      if (this.notificationWorker) {
        stopPromises.push(this.notificationWorker.stop());
      }

      // Wait for all workers to stop
      await Promise.all(stopPromises);

      // Stop monitor
      if (this.monitor) {
        await this.monitor.stop();
      }

      this.isRunning = false;

      console.log('[WorkerManager] All workers stopped successfully');
    } catch (error) {
      console.error('[WorkerManager] Error stopping workers:', error);
      throw error;
    }
  }

  /**
   * Get health status of all workers
   */
  async getHealthStatus() {
    if (!this.monitor) {
      return {
        healthy: false,
        message: 'Workers not initialized',
      };
    }

    return this.monitor.getHealthStatus();
  }

  /**
   * Get metrics for all workers
   */
  async getMetrics() {
    if (!this.monitor) {
      throw new Error('Workers not initialized');
    }

    return this.monitor.getMetrics();
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'] as const;

    for (const signal of signals) {
      const handler = () => {
        console.log(`[WorkerManager] Received ${signal}, shutting down...`);
        this.stop()
          .then(() => {
            console.log('[WorkerManager] Graceful shutdown completed');
            process.exit(0);
          })
          .catch((error) => {
            console.error('[WorkerManager] Shutdown error:', error);
            process.exit(1);
          });
      };

      process.on(signal, handler);
      this.shutdownHandlers.push(() => process.off(signal, handler));
    }

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('[WorkerManager] Uncaught exception:', error);
      this.stop()
        .then(() => process.exit(1))
        .catch(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      console.error('[WorkerManager] Unhandled rejection:', reason);
      this.stop()
        .then(() => process.exit(1))
        .catch(() => process.exit(1));
    });
  }

  /**
   * Cleanup shutdown handlers
   */
  private cleanupShutdownHandlers() {
    for (const cleanup of this.shutdownHandlers) {
      cleanup();
    }
    this.shutdownHandlers = [];
  }

  /**
   * Check if workers are running
   */
  isWorkerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Restart all workers
   */
  async restart() {
    console.log('[WorkerManager] Restarting workers...');
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.start();
    console.log('[WorkerManager] Workers restarted successfully');
  }
}

// Export singleton instance
let workerManager: WorkerManager | null = null;

export function getWorkerManager(): WorkerManager {
  if (!workerManager) {
    workerManager = new WorkerManager();
  }
  return workerManager;
}

import type { TeamExecutionWorker } from './team-execution-worker.js';
import type { ToolExecutionWorker } from './tool-execution-worker.js';
import type { BatchProcessingWorker } from './batch-processing-worker.js';
import type { NotificationWorker } from './notification-worker.js';
import {
  getTeamExecutionQueue,
  getToolExecutionQueue,
  getBatchProcessingQueue,
  getNotificationQueue,
} from '@repo/db/queue';

/**
 * Worker monitor
 * Collects metrics and health status from all workers
 */
export class WorkerMonitor {
  private workers: {
    teamExecutionWorker: TeamExecutionWorker;
    toolExecutionWorker: ToolExecutionWorker;
    batchProcessingWorker: BatchProcessingWorker;
    notificationWorker: NotificationWorker;
  };

  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(workers: {
    teamExecutionWorker: TeamExecutionWorker;
    toolExecutionWorker: ToolExecutionWorker;
    batchProcessingWorker: BatchProcessingWorker;
    notificationWorker: NotificationWorker;
  }) {
    this.workers = workers;
    this.startMonitoring();
  }

  /**
   * Start monitoring workers
   */
  private startMonitoring() {
    // Collect metrics every 30 seconds
    this.metricsInterval = setInterval(
      () => {
        this.collectAndLogMetrics();
      },
      30 * 1000,
    );

    // Health check every 10 seconds
    this.healthCheckInterval = setInterval(
      () => {
        this.performHealthCheck();
      },
      10 * 1000,
    );

    console.log('[WorkerMonitor] Monitoring started');
  }

  /**
   * Stop monitoring
   */
  async stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    console.log('[WorkerMonitor] Monitoring stopped');
  }

  /**
   * Get health status of all workers
   */
  async getHealthStatus() {
    try {
      const [
        teamExecutionMetrics,
        toolExecutionMetrics,
        batchProcessingMetrics,
        notificationMetrics,
      ] = await Promise.all([
        getTeamExecutionQueue().getMetrics(),
        getToolExecutionQueue().getMetrics(),
        getBatchProcessingQueue().getMetrics(),
        getNotificationQueue().getMetrics(),
      ]);

      const memoryUsage = process.memoryUsage();

      return {
        healthy: true,
        timestamp: new Date().toISOString(),
        workers: {
          team_execution: {
            healthy: true,
            active_jobs: teamExecutionMetrics.active,
          },
          tool_execution: {
            healthy: true,
            active_jobs: toolExecutionMetrics.active,
          },
          batch_processing: {
            healthy: true,
            active_jobs: batchProcessingMetrics.active,
          },
          notification: {
            healthy: true,
            active_jobs: notificationMetrics.active,
          },
        },
        memory: {
          rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
          heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
      };
    } catch (error) {
      console.error('[WorkerMonitor] Health check failed:', error);
      return {
        healthy: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get comprehensive metrics for all queues
   */
  async getMetrics() {
    try {
      const [
        teamExecutionMetrics,
        toolExecutionMetrics,
        batchProcessingMetrics,
        notificationMetrics,
      ] = await Promise.all([
        getTeamExecutionQueue().getMetrics(),
        getToolExecutionQueue().getMetrics(),
        getBatchProcessingQueue().getMetrics(),
        getNotificationQueue().getMetrics(),
      ]);

      const memoryUsage = process.memoryUsage();

      return {
        timestamp: new Date().toISOString(),
        queues: {
          team_execution: teamExecutionMetrics,
          tool_execution: toolExecutionMetrics,
          batch_processing: batchProcessingMetrics,
          notification: notificationMetrics,
        },
        totals: {
          waiting:
            teamExecutionMetrics.waiting +
            toolExecutionMetrics.waiting +
            batchProcessingMetrics.waiting +
            notificationMetrics.waiting,
          active:
            teamExecutionMetrics.active +
            toolExecutionMetrics.active +
            batchProcessingMetrics.active +
            notificationMetrics.active,
          completed:
            teamExecutionMetrics.completed +
            toolExecutionMetrics.completed +
            batchProcessingMetrics.completed +
            notificationMetrics.completed,
          failed:
            teamExecutionMetrics.failed +
            toolExecutionMetrics.failed +
            batchProcessingMetrics.failed +
            notificationMetrics.failed,
        },
        memory: {
          rss_mb: Math.round(memoryUsage.rss / 1024 / 1024),
          heap_used_mb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heap_total_mb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external_mb: Math.round(memoryUsage.external / 1024 / 1024),
        },
        uptime_seconds: Math.round(process.uptime()),
      };
    } catch (error) {
      console.error('[WorkerMonitor] Failed to collect metrics:', error);
      throw error;
    }
  }

  /**
   * Collect and log metrics
   */
  private async collectAndLogMetrics() {
    try {
      const metrics = await this.getMetrics();
      console.log('[WorkerMonitor] Metrics:', {
        active_jobs: metrics.totals.active,
        waiting_jobs: metrics.totals.waiting,
        completed_jobs: metrics.totals.completed,
        failed_jobs: metrics.totals.failed,
        memory_mb: metrics.memory.heap_used_mb,
      });
    } catch (error) {
      console.error('[WorkerMonitor] Failed to collect metrics:', error);
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck() {
    try {
      const health = await this.getHealthStatus();
      if (!health.healthy) {
        console.error('[WorkerMonitor] Health check failed:', health);
      }
    } catch (error) {
      console.error('[WorkerMonitor] Health check error:', error);
    }
  }

  /**
   * Get detailed job statistics
   */
  async getJobStatistics() {
    const metrics = await this.getMetrics();

    return {
      timestamp: metrics.timestamp,
      statistics: {
        total_jobs_processed:
          metrics.totals.completed + metrics.totals.failed,
        success_rate:
          metrics.totals.completed + metrics.totals.failed > 0
            ? (metrics.totals.completed /
                (metrics.totals.completed + metrics.totals.failed)) *
              100
            : 0,
        failure_rate:
          metrics.totals.completed + metrics.totals.failed > 0
            ? (metrics.totals.failed /
                (metrics.totals.completed + metrics.totals.failed)) *
              100
            : 0,
        queue_depth: metrics.totals.waiting + metrics.totals.active,
      },
      by_queue: {
        team_execution: this.calculateQueueStats(
          metrics.queues.team_execution,
        ),
        tool_execution: this.calculateQueueStats(
          metrics.queues.tool_execution,
        ),
        batch_processing: this.calculateQueueStats(
          metrics.queues.batch_processing,
        ),
        notification: this.calculateQueueStats(metrics.queues.notification),
      },
    };
  }

  /**
   * Calculate statistics for a single queue
   */
  private calculateQueueStats(queueMetrics: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    total: number;
  }) {
    const totalProcessed = queueMetrics.completed + queueMetrics.failed;
    return {
      total_processed: totalProcessed,
      success_rate:
        totalProcessed > 0
          ? (queueMetrics.completed / totalProcessed) * 100
          : 0,
      queue_depth: queueMetrics.waiting + queueMetrics.active,
      delayed_jobs: queueMetrics.delayed,
    };
  }
}

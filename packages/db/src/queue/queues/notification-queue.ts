import { Queue } from 'bullmq';
import {
  DEFAULT_QUEUE_OPTIONS,
  QUEUE_NAMES,
  getJobOptions,
  JobPriority,
} from '../config.js';
import type { NotificationJobData, NotificationJobResult } from '../types.js';

/**
 * Notification queue for multi-channel notifications
 * Supports email, Slack, webhooks, and in-app notifications
 */
export class NotificationQueue {
  private queue: Queue<NotificationJobData, NotificationJobResult>;

  constructor() {
    this.queue = new Queue<NotificationJobData, NotificationJobResult>(
      QUEUE_NAMES.NOTIFICATION,
      DEFAULT_QUEUE_OPTIONS,
    );
  }

  /**
   * Add a notification job to the queue
   */
  async addJob(
    data: NotificationJobData,
    options?: {
      priority?: JobPriority;
      delay?: number;
      jobId?: string;
    },
  ) {
    // Map notification priority to job priority
    const priority = this.mapNotificationPriority(data.payload.priority);

    const jobOptions = getJobOptions(QUEUE_NAMES.NOTIFICATION, {
      priority: options?.priority ?? priority,
      ...(options?.delay !== undefined && { delay: options.delay }),
      jobId: options?.jobId ?? data.notification_id,
    });

    const job = await this.queue.add(
      `notification-${data.type}-${data.notification_id}`,
      data,
      jobOptions,
    );

    return {
      job_id: job.id,
      notification_id: data.notification_id,
      queue_name: QUEUE_NAMES.NOTIFICATION,
    };
  }

  /**
   * Send run completion notification
   */
  async sendRunCompleteNotification(
    userId: string,
    runId: string,
    result: { status: string; output?: unknown },
    channels: Array<'email' | 'slack' | 'webhook' | 'in_app'> = ['in_app'],
  ) {
    const data: NotificationJobData = {
      trace_id: runId,
      user_id: userId,
      created_at: new Date().toISOString(),
      notification_id: `run-complete-${runId}`,
      type: 'run_complete',
      channels,
      payload: {
        title: 'Team Execution Completed',
        message: `Your team execution (${runId}) has completed with status: ${result.status}`,
        data: result,
        priority: 'normal',
      },
      recipients: {
        user_ids: [userId],
      },
    };

    return this.addJob(data, { priority: JobPriority.NORMAL });
  }

  /**
   * Send run failure notification
   */
  async sendRunFailedNotification(
    userId: string,
    runId: string,
    error: string,
    channels: Array<'email' | 'slack' | 'webhook' | 'in_app'> = [
      'in_app',
      'email',
    ],
  ) {
    const data: NotificationJobData = {
      trace_id: runId,
      user_id: userId,
      created_at: new Date().toISOString(),
      notification_id: `run-failed-${runId}`,
      type: 'run_failed',
      channels,
      payload: {
        title: 'Team Execution Failed',
        message: `Your team execution (${runId}) has failed: ${error}`,
        data: { run_id: runId, error },
        priority: 'high',
      },
      recipients: {
        user_ids: [userId],
      },
    };

    return this.addJob(data, { priority: JobPriority.HIGH });
  }

  /**
   * Send approval required notification
   */
  async sendApprovalRequiredNotification(
    userId: string,
    runId: string,
    context: Record<string, unknown>,
    channels: Array<'email' | 'slack' | 'webhook' | 'in_app'> = [
      'in_app',
      'email',
    ],
  ) {
    const data: NotificationJobData = {
      trace_id: runId,
      user_id: userId,
      created_at: new Date().toISOString(),
      notification_id: `approval-${runId}`,
      type: 'approval_required',
      channels,
      payload: {
        title: 'Approval Required',
        message: `Your team execution (${runId}) requires approval to proceed`,
        data: { run_id: runId, context },
        priority: 'high',
      },
      recipients: {
        user_ids: [userId],
      },
    };

    return this.addJob(data, { priority: JobPriority.HIGH });
  }

  /**
   * Map notification priority to job priority
   */
  private mapNotificationPriority(
    priority?: 'low' | 'normal' | 'high' | 'urgent',
  ): JobPriority {
    switch (priority) {
      case 'urgent':
        return JobPriority.CRITICAL;
      case 'high':
        return JobPriority.HIGH;
      case 'low':
        return JobPriority.LOW;
      default:
        return JobPriority.NORMAL;
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string) {
    return this.queue.getJob(jobId);
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
      queue_name: QUEUE_NAMES.NOTIFICATION,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Get notification stats by type
   */
  async getStatsByType() {
    const [completed, failed] = await Promise.all([
      this.queue.getCompleted(),
      this.queue.getFailed(),
    ]);

    const stats = new Map<
      string,
      { sent: number; failed: number; channels: Record<string, number> }
    >();

    for (const job of [...completed, ...failed]) {
      const type = job.data.type;
      if (!stats.has(type)) {
        stats.set(type, { sent: 0, failed: 0, channels: {} });
      }

      const stat = stats.get(type)!;
      if (job.finishedOn && !job.failedReason) {
        stat.sent++;
      } else {
        stat.failed++;
      }

      for (const channel of job.data.channels) {
        stat.channels[channel] = (stat.channels[channel] || 0) + 1;
      }
    }

    return Object.fromEntries(stats);
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
let notificationQueue: NotificationQueue | null = null;

export function getNotificationQueue(): NotificationQueue {
  if (!notificationQueue) {
    notificationQueue = new NotificationQueue();
  }
  return notificationQueue;
}

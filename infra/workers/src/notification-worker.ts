import { Worker } from 'bullmq';
import {
  QUEUE_NAMES,
  getWorkerOptions,
  type NotificationJobData,
  type NotificationJobResult,
  type TypedJob,
  type NotificationChannel,
} from '@repo/db/queue';

/**
 * Notification worker
 * Sends notifications across multiple channels (email, Slack, webhook, in-app)
 */
export class NotificationWorker {
  private worker: Worker<NotificationJobData, NotificationJobResult>;

  constructor() {
    this.worker = new Worker<NotificationJobData, NotificationJobResult>(
      QUEUE_NAMES.NOTIFICATION,
      this.processJob.bind(this),
      getWorkerOptions({
        concurrency: parseInt(
          process.env.NOTIFICATION_CONCURRENCY || '10',
          10,
        ),
      }),
    );

    this.setupEventListeners();
  }

  /**
   * Process a notification job
   */
  private async processJob(
    job: TypedJob<'notification'>,
  ): Promise<NotificationJobResult> {
    const { notification_id, type, channels, payload, recipients } = job.data;

    const channelsAttempted: NotificationChannel[] = [];
    const channelsSucceeded: NotificationChannel[] = [];
    const channelsFailed: NotificationChannel[] = [];
    const errors: Partial<Record<NotificationChannel, string>> = {};

    // Process each channel
    for (const channel of channels) {
      channelsAttempted.push(channel);

      try {
        await this.sendNotification(channel, {
          type,
          payload,
          recipients,
        });
        channelsSucceeded.push(channel);
      } catch (error) {
        channelsFailed.push(channel);
        errors[channel] =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `[NotificationWorker] Failed to send via ${channel}:`,
          error,
        );
      }
    }

    return {
      notification_id,
      channels_attempted: channelsAttempted,
      channels_succeeded: channelsSucceeded,
      channels_failed: channelsFailed,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    };
  }

  /**
   * Send notification via specific channel
   */
  private async sendNotification(
    channel: NotificationChannel,
    data: {
      type: string;
      payload: NotificationJobData['payload'];
      recipients: NotificationJobData['recipients'];
    },
  ): Promise<void> {
    const { type, payload, recipients } = data;

    switch (channel) {
      case 'email':
        await this.sendEmail(type, payload, recipients.emails || []);
        break;

      case 'slack':
        await this.sendSlack(
          type,
          payload,
          recipients.slack_channels || [],
        );
        break;

      case 'webhook':
        await this.sendWebhook(
          type,
          payload,
          recipients.webhook_urls || [],
        );
        break;

      case 'in_app':
        await this.sendInApp(type, payload, recipients.user_ids || []);
        break;

      default:
        throw new Error(`Unsupported notification channel: ${channel}`);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(
    type: string,
    payload: NotificationJobData['payload'],
    emails: string[],
  ): Promise<void> {
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    console.log(`[NotificationWorker] Sending email to ${emails.join(', ')}`);
    console.log(`  Type: ${type}`);
    console.log(`  Subject: ${payload.title}`);
    console.log(`  Message: ${payload.message}`);

    // Simulate email sending
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(
    type: string,
    payload: NotificationJobData['payload'],
    channels: string[],
  ): Promise<void> {
    // TODO: Integrate with Slack API
    console.log(
      `[NotificationWorker] Sending Slack message to ${channels.join(', ')}`,
    );
    console.log(`  Type: ${type}`);
    console.log(`  Title: ${payload.title}`);
    console.log(`  Message: ${payload.message}`);

    // Simulate Slack sending
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(
    type: string,
    payload: NotificationJobData['payload'],
    urls: string[],
  ): Promise<void> {
    // TODO: Send HTTP POST to webhook URLs
    console.log(
      `[NotificationWorker] Sending webhook to ${urls.join(', ')}`,
    );
    console.log(`  Type: ${type}`);
    console.log(`  Payload:`, payload);

    // Simulate webhook sending
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Example implementation:
    // await Promise.all(
    //   urls.map((url) =>
    //     fetch(url, {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify({ type, payload }),
    //     }),
    //   ),
    // );
  }

  /**
   * Send in-app notification
   */
  private async sendInApp(
    type: string,
    payload: NotificationJobData['payload'],
    userIds: string[],
  ): Promise<void> {
    // TODO: Save to database notifications table
    console.log(
      `[NotificationWorker] Sending in-app notification to ${userIds.join(', ')}`,
    );
    console.log(`  Type: ${type}`);
    console.log(`  Title: ${payload.title}`);
    console.log(`  Message: ${payload.message}`);

    // Simulate database save
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  /**
   * Setup event listeners for the worker
   */
  private setupEventListeners() {
    this.worker.on('completed', (job, result) => {
      console.log(
        `[NotificationWorker] Notification ${result.notification_id} sent via ${result.channels_succeeded.join(', ')}`,
      );
      if (result.channels_failed.length > 0) {
        console.warn(
          `  Failed channels: ${result.channels_failed.join(', ')}`,
        );
      }
    });

    this.worker.on('failed', (job, error) => {
      console.error(
        `[NotificationWorker] Job ${job?.id} failed:`,
        error.message,
      );
    });

    this.worker.on('error', (error) => {
      console.error('[NotificationWorker] Worker error:', error);
    });

    this.worker.on('stalled', (jobId) => {
      console.warn(`[NotificationWorker] Job ${jobId} stalled`);
    });
  }

  /**
   * Start the worker
   */
  async start() {
    console.log('[NotificationWorker] Worker started');
  }

  /**
   * Stop the worker gracefully
   */
  async stop() {
    console.log('[NotificationWorker] Stopping worker...');
    await this.worker.close();
    console.log('[NotificationWorker] Worker stopped');
  }

  /**
   * Get the underlying BullMQ worker instance
   */
  getWorker() {
    return this.worker;
  }
}

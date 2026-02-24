import type { Job } from 'bullmq';
import type { QUEUE_NAMES } from './config.js';

/**
 * Base job data interface
 */
export interface BaseJobData {
  trace_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Team execution job data
 */
export interface TeamExecutionJobData extends BaseJobData {
  run_id: string;
  request: {
    user_request: string;
    context?: Record<string, unknown>;
    preferences?: {
      quality_threshold?: number;
      max_iterations?: number;
      requires_approval?: boolean;
    };
  };
  template_id?: string;
  priority?: number;
}

/**
 * Tool execution job data
 */
export interface ToolExecutionJobData extends BaseJobData {
  tool_name: string;
  parameters: Record<string, unknown>;
  context: {
    run_id: string;
    agent_id?: string;
    step_id?: string;
  };
  timeout?: number;
}

/**
 * Batch processing job data
 */
export interface BatchProcessingJobData extends BaseJobData {
  batch_id: string;
  items: Array<{
    id: string;
    data: Record<string, unknown>;
  }>;
  operation: 'aggregate' | 'transform' | 'validate' | 'export';
  chunk_size?: number;
  progress_callback?: boolean;
}

/**
 * Notification channel types
 */
export type NotificationChannel = 'email' | 'slack' | 'webhook' | 'in_app';

/**
 * Notification job data
 */
export interface NotificationJobData extends BaseJobData {
  notification_id: string;
  type: 'run_complete' | 'run_failed' | 'approval_required' | 'system_alert';
  channels: NotificationChannel[];
  payload: {
    title: string;
    message: string;
    data?: Record<string, unknown>;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  };
  recipients: {
    user_ids?: string[];
    emails?: string[];
    slack_channels?: string[];
    webhook_urls?: string[];
  };
}

/**
 * Job result types
 */
export interface TeamExecutionJobResult {
  run_id: string;
  status: 'completed' | 'failed' | 'partial';
  output?: unknown;
  error?: string;
  execution_time_ms: number;
  steps_completed: number;
  models_used: string[];
}

export interface ToolExecutionJobResult {
  tool_name: string;
  success: boolean;
  result?: unknown;
  error?: string;
  execution_time_ms: number;
}

export interface BatchProcessingJobResult {
  batch_id: string;
  total_items: number;
  processed_items: number;
  failed_items: number;
  results: Array<{
    id: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
}

export interface NotificationJobResult {
  notification_id: string;
  channels_attempted: NotificationChannel[];
  channels_succeeded: NotificationChannel[];
  channels_failed: NotificationChannel[];
  errors?: Record<NotificationChannel, string>;
}

/**
 * Job type mapping
 */
export type QueueJobDataMap = {
  [QUEUE_NAMES.TEAM_EXECUTION]: TeamExecutionJobData;
  [QUEUE_NAMES.TOOL_EXECUTION]: ToolExecutionJobData;
  [QUEUE_NAMES.BATCH_PROCESSING]: BatchProcessingJobData;
  [QUEUE_NAMES.NOTIFICATION]: NotificationJobData;
};

export type QueueJobResultMap = {
  [QUEUE_NAMES.TEAM_EXECUTION]: TeamExecutionJobResult;
  [QUEUE_NAMES.TOOL_EXECUTION]: ToolExecutionJobResult;
  [QUEUE_NAMES.BATCH_PROCESSING]: BatchProcessingJobResult;
  [QUEUE_NAMES.NOTIFICATION]: NotificationJobResult;
};

/**
 * Typed job interface
 */
export type TypedJob<T extends keyof QueueJobDataMap> = Job<
  QueueJobDataMap[T],
  QueueJobResultMap[T]
>;

/**
 * Job progress data
 */
export interface JobProgress {
  percentage: number;
  current_step?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

import type { FastifyInstance } from 'fastify';
import {
  getTeamExecutionQueue,
  getToolExecutionQueue,
  getBatchProcessingQueue,
  getNotificationQueue,
  JobPriority,
  type TeamExecutionJobData,
  type ToolExecutionJobData,
  type BatchProcessingJobData,
} from '@repo/db';
import { z } from 'zod';

/**
 * Queue routes for job submission and monitoring
 */

const teamExecutionJobSchema = z.object({
  run_id: z.string().min(1),
  user_id: z.string().min(1),
  request: z.object({
    user_request: z.string().min(1),
    context: z.record(z.unknown()).optional(),
    preferences: z
      .object({
        quality_threshold: z.number().optional(),
        max_iterations: z.number().optional(),
        requires_approval: z.boolean().optional(),
      })
      .optional(),
  }),
  template_id: z.string().optional(),
  priority: z.number().optional(),
});

const toolExecutionJobSchema = z.object({
  tool_name: z.string().min(1),
  parameters: z.record(z.unknown()),
  context: z.object({
    run_id: z.string().min(1),
    agent_id: z.string().optional(),
    step_id: z.string().optional(),
  }),
  timeout: z.number().optional(),
});

const batchProcessingJobSchema = z.object({
  batch_id: z.string().min(1),
  items: z.array(
    z.object({
      id: z.string().min(1),
      data: z.record(z.unknown()),
    }),
  ),
  operation: z.enum(['aggregate', 'transform', 'validate', 'export']),
  chunk_size: z.number().optional(),
});

export async function registerQueueRoutes(app: FastifyInstance) {
  /**
   * Submit a team execution job
   */
  app.post('/api/queues/team-execution', async (request, reply) => {
    const body = teamExecutionJobSchema.parse(request.body);

    const teamExecutionQueue = getTeamExecutionQueue();

    const jobData: TeamExecutionJobData = {
      trace_id: body.run_id,
      user_id: body.user_id,
      created_at: new Date().toISOString(),
      run_id: body.run_id,
      request: body.request,
      template_id: body.template_id,
      priority: body.priority,
    };

    const result = await teamExecutionQueue.addJob(jobData, {
      priority: (body.priority as JobPriority) ?? JobPriority.NORMAL,
    });

    return reply.status(202).send({
      message: 'Job submitted successfully',
      ...result,
    });
  });

  /**
   * Submit a tool execution job
   */
  app.post('/api/queues/tool-execution', async (request, reply) => {
    const body = toolExecutionJobSchema.parse(request.body);

    const toolExecutionQueue = getToolExecutionQueue();

    const jobData: ToolExecutionJobData = {
      trace_id: body.context.run_id,
      user_id: 'system', // TODO: Get from auth context
      created_at: new Date().toISOString(),
      tool_name: body.tool_name,
      parameters: body.parameters,
      context: body.context,
      timeout: body.timeout,
    };

    const result = await toolExecutionQueue.addJob(jobData);

    return reply.status(202).send({
      message: 'Tool execution job submitted',
      ...result,
    });
  });

  /**
   * Submit a batch processing job
   */
  app.post('/api/queues/batch-processing', async (request, reply) => {
    const body = batchProcessingJobSchema.parse(request.body);

    const batchProcessingQueue = getBatchProcessingQueue();

    const jobData: BatchProcessingJobData = {
      trace_id: body.batch_id,
      user_id: 'system', // TODO: Get from auth context
      created_at: new Date().toISOString(),
      batch_id: body.batch_id,
      items: body.items,
      operation: body.operation,
      chunk_size: body.chunk_size,
    };

    const result = await batchProcessingQueue.addJob(jobData);

    return reply.status(202).send({
      message: 'Batch processing job submitted',
      ...result,
    });
  });

  /**
   * Get job status by ID
   */
  app.get<{
    Params: { queueName: string; jobId: string };
  }>('/api/queues/:queueName/jobs/:jobId', async (request, reply) => {
    const { queueName, jobId } = request.params;

    let queue;
    switch (queueName) {
      case 'team-execution':
        queue = getTeamExecutionQueue();
        break;
      case 'tool-execution':
        queue = getToolExecutionQueue();
        break;
      case 'batch-processing':
        queue = getBatchProcessingQueue();
        break;
      case 'notification':
        queue = getNotificationQueue();
        break;
      default:
        return reply.status(404).send({ error: 'Queue not found' });
    }

    const job = await queue.getJob(jobId);

    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress;

    return reply.send({
      job_id: job.id,
      queue_name: queueName,
      state,
      progress,
      data: job.data,
      result: job.returnvalue,
      failed_reason: job.failedReason,
      attempts: job.attemptsMade,
      timestamp: job.timestamp,
      processed_on: job.processedOn,
      finished_on: job.finishedOn,
    });
  });

  /**
   * Cancel a job
   */
  app.delete<{
    Params: { queueName: string; jobId: string };
  }>('/api/queues/:queueName/jobs/:jobId', async (request, reply) => {
    const { queueName, jobId } = request.params;

    let queue;
    switch (queueName) {
      case 'team-execution':
        queue = getTeamExecutionQueue();
        break;
      case 'tool-execution':
        queue = getToolExecutionQueue();
        break;
      case 'batch-processing':
        queue = getBatchProcessingQueue();
        break;
      case 'notification':
        queue = getNotificationQueue();
        break;
      default:
        return reply.status(404).send({ error: 'Queue not found' });
    }

    const success = await queue.cancelJob(jobId);

    if (!success) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return reply.send({
      message: 'Job cancelled successfully',
      job_id: jobId,
    });
  });

  /**
   * Get queue metrics
   */
  app.get<{
    Params: { queueName: string };
  }>('/api/queues/:queueName/metrics', async (request, reply) => {
    const { queueName } = request.params;

    let queue;
    switch (queueName) {
      case 'team-execution':
        queue = getTeamExecutionQueue();
        break;
      case 'tool-execution':
        queue = getToolExecutionQueue();
        break;
      case 'batch-processing':
        queue = getBatchProcessingQueue();
        break;
      case 'notification':
        queue = getNotificationQueue();
        break;
      default:
        return reply.status(404).send({ error: 'Queue not found' });
    }

    const metrics = await queue.getMetrics();

    return reply.send(metrics);
  });

  /**
   * Get all queues metrics
   */
  app.get('/api/queues/metrics', async (request, reply) => {
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

    return reply.send({
      queues: {
        'team-execution': teamExecutionMetrics,
        'tool-execution': toolExecutionMetrics,
        'batch-processing': batchProcessingMetrics,
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
    });
  });

  /**
   * Get waiting jobs for a queue
   */
  app.get<{
    Params: { queueName: string };
    Querystring: { start?: number; end?: number };
  }>('/api/queues/:queueName/jobs/waiting', async (request, reply) => {
    const { queueName } = request.params;
    const { start = 0, end = 10 } = request.query;

    let queue;
    switch (queueName) {
      case 'team-execution':
        queue = getTeamExecutionQueue();
        break;
      case 'tool-execution':
        queue = getToolExecutionQueue();
        break;
      case 'batch-processing':
        queue = getBatchProcessingQueue();
        break;
      case 'notification':
        queue = getNotificationQueue();
        break;
      default:
        return reply.status(404).send({ error: 'Queue not found' });
    }

    const jobs = await queue.getWaitingJobs(start, end);

    return reply.send({
      queue_name: queueName,
      jobs: jobs.map((job) => ({
        job_id: job.id,
        data: job.data,
        timestamp: job.timestamp,
      })),
    });
  });

  /**
   * Get active jobs for a queue
   */
  app.get<{
    Params: { queueName: string };
    Querystring: { start?: number; end?: number };
  }>('/api/queues/:queueName/jobs/active', async (request, reply) => {
    const { queueName } = request.params;
    const { start = 0, end = 10 } = request.query;

    let queue;
    switch (queueName) {
      case 'team-execution':
        queue = getTeamExecutionQueue();
        break;
      case 'tool-execution':
        queue = getToolExecutionQueue();
        break;
      case 'batch-processing':
        queue = getBatchProcessingQueue();
        break;
      case 'notification':
        queue = getNotificationQueue();
        break;
      default:
        return reply.status(404).send({ error: 'Queue not found' });
    }

    const jobs = await queue.getActiveJobs(start, end);

    return reply.send({
      queue_name: queueName,
      jobs: jobs.map((job) => ({
        job_id: job.id,
        data: job.data,
        progress: job.progress,
        timestamp: job.timestamp,
        processed_on: job.processedOn,
      })),
    });
  });
}

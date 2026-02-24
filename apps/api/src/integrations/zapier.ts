import type { FastifyPluginAsync } from 'fastify';

/**
 * Zapier Integration
 * Defines Triggers (events sent from our platform to Zapier)
 * and Actions (endpoints Zapier can call on our platform).
 */

export const zapierIntegrationPlugin: FastifyPluginAsync = async (fastify) => {
  // Triggers (Webhooks)
  // These endpoints allow Zapier to subscribe/unsubscribe from our events
  
  fastify.post('/integrations/zapier/triggers/run-completed/subscribe', async (request, reply) => {
    // In a real implementation, we would save the webhook_url to our DB
    const { webhook_url } = request.body as { webhook_url: string };
    
    fastify.log.info({ webhook_url }, 'Zapier subscribed to run-completed trigger');
    
    return {
      id: crypto.randomUUID(), // subscription id
      status: 'subscribed'
    };
  });

  fastify.delete('/integrations/zapier/triggers/run-completed/unsubscribe/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    fastify.log.info({ id }, 'Zapier unsubscribed from run-completed trigger');
    
    return { status: 'unsubscribed' };
  });

  // Example Trigger Data Endpoint (Zapier calls this to get sample data for setup)
  fastify.get('/integrations/zapier/triggers/run-completed/samples', async (request, reply) => {
    return [
      {
        id: 'run-123',
        team_id: 'team-456',
        status: 'completed',
        result: 'Successfully analyzed the codebase.',
        completed_at: new Date().toISOString()
      }
    ];
  });

  // Actions
  // These endpoints allow Zapier to perform actions in our platform

  fastify.post('/integrations/zapier/actions/create-run', async (request, reply) => {
    // Authenticate request (e.g. via API Key or OAuth)
    // Extract parameters from Zapier payload
    const { team_id, task_description } = request.body as { team_id: string; task_description: string };
    
    fastify.log.info({ team_id, task_description }, 'Zapier action: Create Run');

    // In a real implementation, we'd trigger the graph execution
    // const runId = await orchestrator.createRun(...)
    const mockRunId = `run-mock-${Date.now()}`;

    return {
      id: mockRunId,
      status: 'started',
      team_id,
      task_description,
      started_at: new Date().toISOString()
    };
  });
  
  fastify.post('/integrations/zapier/actions/approve-tool', async (request, reply) => {
    const { run_id, tool_call_id, approved } = request.body as { run_id: string; tool_call_id: string; approved: boolean };
    
    fastify.log.info({ run_id, tool_call_id, approved }, 'Zapier action: Approve Tool');

    // Proceed to unblock the interrupt in LangGraph
    return {
      success: true,
      run_id,
      status: approved ? 'approved' : 'rejected'
    };
  });
};

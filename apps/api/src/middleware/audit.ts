import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { auditLogger } from '@repo/observability';

/**
 * Audit logging hook for Fastify
 * Logs important user actions for security and compliance
 */
export async function registerAuditHooks(app: FastifyInstance): Promise<void> {
  // Add onSend hook to audit responses
  app.addHook('onSend', async (request, reply, payload) => {
    // Only audit certain methods and paths
    if (!shouldAudit(request)) {
      return payload;
    }

    // Log the audit event
    logAuditEvent(request, reply);
    return payload;
  });
}

/**
 * Determine if request should be audited
 */
function shouldAudit(request: FastifyRequest): boolean {
  const method = request.method;
  const path = request.url;

  // Audit write operations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true;
  }

  // Audit sensitive reads
  const sensitivePaths = ['/api/users', '/api/teams', '/api/permissions'];
  if (sensitivePaths.some((p) => path.startsWith(p))) {
    return true;
  }

  return false;
}

/**
 * Log audit event based on request
 */
function logAuditEvent(request: FastifyRequest, reply: FastifyReply): void {
  // Extract user info (assuming auth middleware sets this)
  const user = (request as any).user;
  const userId = user?.id || 'anonymous';
  const userEmail = user?.email;
  const ipAddress = request.ip || 'unknown';
  const userAgent = request.headers['user-agent'];

  // Determine event type and resource
  const { eventType, resourceType, resourceId, action } = parseRequest(request);

  if (!eventType) {
    return; // Skip if we can't determine event type
  }

  // Log the audit event
  const auditData: any = {
    event_type: eventType,
    actor: {
      user_id: userId,
      email: userEmail,
      ip_address: ipAddress,
    },
    resource: {
      type: resourceType,
      id: resourceId,
    },
    action,
    result: reply.statusCode >= 200 && reply.statusCode < 300 ? 'success' : 'failure',
    metadata: {
      method: request.method,
      path: request.url,
      status_code: reply.statusCode,
    },
  };

  // Only add user_agent if it exists (to satisfy exactOptionalPropertyTypes)
  if (userAgent) {
    auditData.actor.user_agent = userAgent;
  }

  auditLogger.log(auditData);
}

/**
 * Parse request to determine audit event details
 */
function parseRequest(request: FastifyRequest): {
  eventType: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
} {
  const method = request.method;
  const path = request.url;

  // Users
  if (path.includes('/users')) {
    return {
      eventType: method === 'POST' ? 'user.create' : method === 'DELETE' ? 'user.delete' : 'user.update',
      resourceType: 'user',
      resourceId: extractIdFromPath(path),
      action: method.toLowerCase(),
    };
  }

  // Teams
  if (path.includes('/teams')) {
    return {
      eventType: method === 'POST' ? 'team.create' : method === 'DELETE' ? 'team.delete' : 'team.update',
      resourceType: 'team',
      resourceId: extractIdFromPath(path),
      action: method.toLowerCase(),
    };
  }

  // Runs
  if (path.includes('/runs')) {
    return {
      eventType: method === 'POST' ? 'run.create' : method === 'DELETE' ? 'run.delete' : 'run.cancel',
      resourceType: 'run',
      resourceId: extractIdFromPath(path),
      action: method.toLowerCase(),
    };
  }

  // Permissions
  if (path.includes('/permissions')) {
    return {
      eventType: method === 'POST' ? 'permission.grant' : 'permission.revoke',
      resourceType: 'permission',
      resourceId: extractIdFromPath(path),
      action: method.toLowerCase(),
    };
  }

  // Default
  return {
    eventType: 'data.' + method.toLowerCase(),
    resourceType: 'unknown',
    resourceId: extractIdFromPath(path),
    action: method.toLowerCase(),
  };
}

/**
 * Extract ID from path
 */
function extractIdFromPath(path: string): string {
  const parts = path.split('/');
  // Find UUID or numeric ID
  const id = parts.find(
    (part) =>
      part.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ||
      part.match(/^\d+$/)
  );
  return id || 'unknown';
}

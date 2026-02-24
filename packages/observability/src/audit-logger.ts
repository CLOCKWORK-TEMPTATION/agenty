import { randomUUID } from 'node:crypto';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event_type: AuditEventType;
  actor: {
    user_id: string;
    email?: string;
    ip_address?: string;
    user_agent?: string;
  };
  resource: {
    type: string;
    id: string;
    name?: string;
  };
  action: string;
  result: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  trace_id?: string;
}

export type AuditEventType =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.failed_login'
  | 'auth.password_change'
  | 'auth.mfa_enable'
  | 'auth.mfa_disable'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'user.role_change'
  | 'permission.grant'
  | 'permission.revoke'
  | 'data.read'
  | 'data.create'
  | 'data.update'
  | 'data.delete'
  | 'data.export'
  | 'run.create'
  | 'run.cancel'
  | 'run.delete'
  | 'team.create'
  | 'team.update'
  | 'team.delete'
  | 'config.change'
  | 'security.breach_attempt'
  | 'security.unauthorized_access'
  | 'security.sensitive_tool_approval'
  | 'security.sensitive_tool_rejection'
  | 'api_key.create'
  | 'api_key.revoke';

export interface AuditLoggerConfig {
  enabled: boolean;
  logLevel: 'all' | 'high' | 'critical';
  shipper?: AuditLogShipper;
  storage?: AuditLogStorage;
}

export interface AuditLogShipper {
  ship(entries: AuditLogEntry[]): Promise<void>;
}

export interface AuditLogStorage {
  store(entry: AuditLogEntry): Promise<void>;
  query(filter: AuditLogFilter): Promise<AuditLogEntry[]>;
}

export interface AuditLogFilter {
  event_type?: AuditEventType[];
  actor_user_id?: string;
  resource_type?: string;
  resource_id?: string;
  start_date?: Date;
  end_date?: Date;
  severity?: AuditLogEntry['severity'][];
  result?: AuditLogEntry['result'];
  limit?: number;
  offset?: number;
}

/**
 * Audit logger for security and compliance
 */
class AuditLogger {
  private config: AuditLoggerConfig = {
    enabled: true,
    logLevel: 'all',
  };
  private buffer: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 10000; // 10 seconds
  private readonly BUFFER_SIZE = 100;

  /**
   * Initialize audit logger
   */
  initialize(config: Partial<AuditLoggerConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.config.enabled) {
      // Start periodic flush
      this.flushInterval = setInterval(() => {
        this.flush().catch((error) => {
          console.error('Failed to flush audit logs:', error);
        });
      }, this.FLUSH_INTERVAL_MS);

      console.log('Audit logger initialized successfully');
    }
  }

  /**
   * Shutdown audit logger
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining logs
    await this.flush();

    console.log('Audit logger shut down successfully');
  }

  /**
   * Log an audit event
   */
  log(params: {
    event_type: AuditEventType;
    actor: AuditLogEntry['actor'];
    resource: AuditLogEntry['resource'];
    action: string;
    result: AuditLogEntry['result'];
    metadata?: Record<string, unknown>;
    changes?: AuditLogEntry['changes'];
    severity?: AuditLogEntry['severity'];
    trace_id?: string;
  }): void {
    if (!this.config.enabled) {
      return;
    }

    const severity = params.severity || this.inferSeverity(params.event_type, params.result);

    // Filter by log level
    if (!this.shouldLog(severity)) {
      return;
    }

    const entry: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      event_type: params.event_type,
      actor: params.actor,
      resource: params.resource,
      action: params.action,
      result: params.result,
      ...(params.metadata && { metadata: params.metadata }),
      ...(params.changes && { changes: params.changes }),
      severity,
      ...(params.trace_id && { trace_id: params.trace_id }),
    };

    // Store immediately (asynchronously)
    if (this.config.storage) {
      this.config.storage.store(entry).catch((error) => {
        console.error('Failed to store audit log:', error);
      });
    }

    // Add to buffer for shipping
    this.buffer.push(entry);

    // Flush if buffer is full
    if (this.buffer.length >= this.BUFFER_SIZE) {
      this.flush().catch((error) => {
        console.error('Failed to flush audit logs:', error);
      });
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', JSON.stringify(entry, null, 2));
    }
  }

  /**
   * Convenience methods for common events
   */

  logLogin(userId: string, email: string, ipAddress: string, success: boolean): void {
    this.log({
      event_type: success ? 'auth.login' : 'auth.failed_login',
      actor: { user_id: userId, email, ip_address: ipAddress },
      resource: { type: 'user', id: userId },
      action: 'login',
      result: success ? 'success' : 'failure',
      severity: success ? 'low' : 'medium',
    });
  }

  logPermissionChange(
    actorUserId: string,
    targetUserId: string,
    permission: string,
    granted: boolean
  ): void {
    this.log({
      event_type: granted ? 'permission.grant' : 'permission.revoke',
      actor: { user_id: actorUserId },
      resource: { type: 'user', id: targetUserId },
      action: granted ? 'grant_permission' : 'revoke_permission',
      result: 'success',
      metadata: { permission },
      severity: 'high',
    });
  }

  logDataAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    operation: 'read' | 'create' | 'update' | 'delete' | 'export'
  ): void {
    this.log({
      event_type: `data.${operation}`,
      actor: { user_id: userId },
      resource: { type: resourceType, id: resourceId },
      action: operation,
      result: 'success',
      severity: operation === 'export' || operation === 'delete' ? 'medium' : 'low',
    });
  }

  logSensitiveToolApproval(
    userId: string,
    toolName: string,
    approved: boolean,
    reason?: string
  ): void {
    this.log({
      event_type: approved
        ? 'security.sensitive_tool_approval'
        : 'security.sensitive_tool_rejection',
      actor: { user_id: userId },
      resource: { type: 'tool', id: toolName, name: toolName },
      action: approved ? 'approve' : 'reject',
      result: 'success',
      metadata: { reason },
      severity: 'high',
    });
  }

  logSecurityEvent(
    eventType: Extract<AuditEventType, `security.${string}`>,
    userId: string,
    details: Record<string, unknown>
  ): void {
    this.log({
      event_type: eventType,
      actor: { user_id: userId },
      resource: { type: 'system', id: 'security' },
      action: eventType.replace('security.', ''),
      result: 'failure',
      metadata: details,
      severity: 'critical',
    });
  }

  logConfigChange(
    userId: string,
    configKey: string,
    oldValue: unknown,
    newValue: unknown
  ): void {
    this.log({
      event_type: 'config.change',
      actor: { user_id: userId },
      resource: { type: 'config', id: configKey },
      action: 'update_config',
      result: 'success',
      changes: {
        before: { [configKey]: oldValue },
        after: { [configKey]: newValue },
      },
      severity: 'medium',
    });
  }

  /**
   * Query audit logs
   */
  async query(filter: AuditLogFilter): Promise<AuditLogEntry[]> {
    if (!this.config.storage) {
      throw new Error('Audit log storage not configured');
    }

    return this.config.storage.query(filter);
  }

  /**
   * Flush buffered logs to shipper
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.shipper) {
      return;
    }

    const logsToShip = [...this.buffer];
    this.buffer = [];

    try {
      await this.config.shipper.ship(logsToShip);
    } catch (error) {
      console.error('Failed to ship audit logs:', error);
      // Re-add to buffer for retry
      this.buffer.unshift(...logsToShip);
    }
  }

  /**
   * Infer severity from event type and result
   */
  private inferSeverity(
    eventType: AuditEventType,
    result: AuditLogEntry['result']
  ): AuditLogEntry['severity'] {
    // Critical events
    if (
      eventType.startsWith('security.') ||
      eventType.includes('delete') ||
      eventType === 'permission.grant' ||
      eventType === 'permission.revoke'
    ) {
      return 'critical';
    }

    // High severity events
    if (
      eventType.includes('role_change') ||
      eventType === 'data.export' ||
      eventType === 'config.change' ||
      result === 'failure'
    ) {
      return 'high';
    }

    // Medium severity events
    if (eventType.includes('create') || eventType.includes('update')) {
      return 'medium';
    }

    // Low severity by default
    return 'low';
  }

  /**
   * Check if log should be recorded based on severity
   */
  private shouldLog(severity: AuditLogEntry['severity']): boolean {
    const { logLevel } = this.config;

    if (logLevel === 'all') {
      return true;
    }

    if (logLevel === 'high') {
      return severity === 'high' || severity === 'critical';
    }

    if (logLevel === 'critical') {
      return severity === 'critical';
    }

    return true;
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();

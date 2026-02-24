export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  channels: AlertChannel[];
  throttle?: {
    period_seconds: number;
    max_alerts: number;
  };
}

export interface AlertCondition {
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  threshold: number;
  duration_seconds?: number; // Alert only if condition persists for this duration
  labels?: Record<string, string>; // Metric label filters
}

export type AlertChannelType = 'email' | 'slack' | 'pagerduty' | 'webhook';

export interface AlertChannel {
  type: AlertChannelType;
  config: EmailChannelConfig | SlackChannelConfig | PagerDutyChannelConfig | WebhookChannelConfig;
}

export interface EmailChannelConfig {
  recipients: string[];
  subject_template?: string;
}

export interface SlackChannelConfig {
  webhook_url: string;
  channel?: string;
  username?: string;
}

export interface PagerDutyChannelConfig {
  integration_key: string;
  severity_mapping?: Record<string, 'info' | 'warning' | 'error' | 'critical'>;
}

export interface WebhookChannelConfig {
  url: string;
  headers?: Record<string, string>;
  method?: 'POST' | 'PUT';
}

export interface Alert {
  id: string;
  rule_id: string;
  rule_name: string;
  timestamp: string;
  severity: AlertRule['severity'];
  metric: string;
  current_value: number;
  threshold: number;
  message: string;
  labels?: Record<string, string>;
  resolved?: boolean;
  resolved_at?: string;
}

/**
 * Alert manager for monitoring and alerting
 */
class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private throttleState: Map<string, { count: number; windowStart: number }> = new Map();

  /**
   * Register alert rules
   */
  registerRules(rules: AlertRule[]): void {
    for (const rule of rules) {
      this.rules.set(rule.id, rule);
    }
    console.log(`Registered ${rules.length} alert rules`);
  }

  /**
   * Evaluate metric value against rules
   */
  evaluateMetric(metric: string, value: number, labels?: Record<string, string>): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled || rule.condition.metric !== metric) {
        continue;
      }

      // Check label filters
      if (rule.condition.labels && labels) {
        const labelsMatch = Object.entries(rule.condition.labels).every(
          ([key, val]) => labels[key] === val
        );
        if (!labelsMatch) {
          continue;
        }
      }

      // Evaluate condition
      const conditionMet = this.evaluateCondition(rule.condition, value);

      if (conditionMet) {
        this.triggerAlert(rule, value, labels);
      } else {
        this.resolveAlert(rule.id);
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, currentValue: number, labels?: Record<string, string>): void {
    const alertKey = this.getAlertKey(rule.id, labels);

    // Check if alert already exists
    if (this.activeAlerts.has(alertKey)) {
      return; // Alert already active
    }

    // Check throttling
    if (rule.throttle && this.isThrottled(rule.id)) {
      return;
    }

    const alert: Alert = {
      id: `${rule.id}-${Date.now()}`,
      rule_id: rule.id,
      rule_name: rule.name,
      timestamp: new Date().toISOString(),
      severity: rule.severity,
      metric: rule.condition.metric,
      current_value: currentValue,
      threshold: rule.condition.threshold,
      message: this.formatAlertMessage(rule, currentValue, labels),
      ...(labels && { labels }),
      resolved: false,
    };

    this.activeAlerts.set(alertKey, alert);
    this.alertHistory.push(alert);

    // Send notifications
    this.sendNotifications(alert, rule.channels);

    // Update throttle state
    if (rule.throttle) {
      this.updateThrottleState(rule.id);
    }

    console.log(`[ALERT] ${alert.rule_name}: ${alert.message}`);
  }

  /**
   * Resolve an alert
   */
  private resolveAlert(ruleId: string): void {
    const alertsToResolve: string[] = [];

    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.rule_id === ruleId && !alert.resolved) {
        alert.resolved = true;
        alert.resolved_at = new Date().toISOString();
        alertsToResolve.push(key);
        console.log(`[ALERT RESOLVED] ${alert.rule_name}`);
      }
    }

    // Remove resolved alerts from active set
    for (const key of alertsToResolve) {
      this.activeAlerts.delete(key);
    }
  }

  /**
   * Send notifications through configured channels
   */
  private async sendNotifications(alert: Alert, channels: AlertChannel[]): Promise<void> {
    for (const channel of channels) {
      try {
        await this.sendNotification(alert, channel);
      } catch (error) {
        console.error(`Failed to send alert notification via ${channel.type}:`, error);
      }
    }
  }

  /**
   * Send notification to a specific channel
   */
  private async sendNotification(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(alert, channel.config as EmailChannelConfig);
        break;
      case 'slack':
        await this.sendSlackNotification(alert, channel.config as SlackChannelConfig);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(alert, channel.config as PagerDutyChannelConfig);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, channel.config as WebhookChannelConfig);
        break;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    alert: Alert,
    config: EmailChannelConfig
  ): Promise<void> {
    // Implementation would integrate with email service (e.g., SendGrid, AWS SES)
    console.log(`Email notification to ${config.recipients.join(', ')}: ${alert.message}`);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert, config: SlackChannelConfig): Promise<void> {
    const payload = {
      channel: config.channel,
      username: config.username || 'Alert Manager',
      icon_emoji: this.getSeverityEmoji(alert.severity),
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          title: alert.rule_name,
          text: alert.message,
          fields: [
            {
              title: 'Metric',
              value: alert.metric,
              short: true,
            },
            {
              title: 'Current Value',
              value: alert.current_value.toString(),
              short: true,
            },
            {
              title: 'Threshold',
              value: alert.threshold.toString(),
              short: true,
            },
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
          ],
          footer: 'Alert Manager',
          ts: Math.floor(new Date(alert.timestamp).getTime() / 1000),
        },
      ],
    };

    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(
    alert: Alert,
    config: PagerDutyChannelConfig
  ): Promise<void> {
    const severity = config.severity_mapping?.[alert.severity] || 'error';

    const payload = {
      routing_key: config.integration_key,
      event_action: 'trigger',
      payload: {
        summary: alert.message,
        severity,
        source: 'alert-manager',
        custom_details: {
          metric: alert.metric,
          current_value: alert.current_value,
          threshold: alert.threshold,
          labels: alert.labels,
        },
      },
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`PagerDuty API error: ${response.statusText}`);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    alert: Alert,
    config: WebhookChannelConfig
  ): Promise<void> {
    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(alert),
    });

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.statusText}`);
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt':
        return value > condition.threshold;
      case 'gte':
        return value >= condition.threshold;
      case 'lt':
        return value < condition.threshold;
      case 'lte':
        return value <= condition.threshold;
      case 'eq':
        return value === condition.threshold;
      case 'neq':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(
    rule: AlertRule,
    currentValue: number,
    labels?: Record<string, string>
  ): string {
    const labelsStr = labels ? ` (${Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(', ')})` : '';
    return `${rule.description}. Current value: ${currentValue}, Threshold: ${rule.condition.threshold}${labelsStr}`;
  }

  /**
   * Get alert key for deduplication
   */
  private getAlertKey(ruleId: string, labels?: Record<string, string>): string {
    const labelsStr = labels
      ? Object.entries(labels)
          .sort()
          .map(([k, v]) => `${k}=${v}`)
          .join(',')
      : '';
    return `${ruleId}:${labelsStr}`;
  }

  /**
   * Check if alert is throttled
   */
  private isThrottled(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule?.throttle) {
      return false;
    }

    const state = this.throttleState.get(ruleId);
    if (!state) {
      return false;
    }

    const now = Date.now();
    const windowElapsed = now - state.windowStart;

    if (windowElapsed > rule.throttle.period_seconds * 1000) {
      // Window expired, reset
      this.throttleState.delete(ruleId);
      return false;
    }

    return state.count >= rule.throttle.max_alerts;
  }

  /**
   * Update throttle state
   */
  private updateThrottleState(ruleId: string): void {
    const state = this.throttleState.get(ruleId);
    const now = Date.now();

    if (!state) {
      this.throttleState.set(ruleId, { count: 1, windowStart: now });
    } else {
      state.count++;
    }
  }

  /**
   * Get severity emoji for Slack
   */
  private getSeverityEmoji(severity: Alert['severity']): string {
    switch (severity) {
      case 'critical':
        return ':rotating_light:';
      case 'warning':
        return ':warning:';
      case 'info':
        return ':information_source:';
      default:
        return ':bell:';
    }
  }

  /**
   * Get severity color for Slack
   */
  private getSeverityColor(severity: Alert['severity']): string {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'warning':
        return 'warning';
      case 'info':
        return 'good';
      default:
        return '#808080';
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): Alert[] {
    const history = [...this.alertHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }
}

// Singleton instance
export const alertManager = new AlertManager();

// Predefined alert rules
export const defaultAlertRules: AlertRule[] = [
  {
    id: 'high_error_rate',
    name: 'High Error Rate',
    description: 'Error rate exceeded threshold',
    condition: {
      metric: 'run_status_total',
      operator: 'gt',
      threshold: 0.1, // 10% error rate
      labels: { status: 'failed' },
    },
    severity: 'critical',
    enabled: true,
    channels: [],
  },
  {
    id: 'high_latency',
    name: 'High Latency',
    description: 'P95 latency exceeded threshold',
    condition: {
      metric: 'run_duration_seconds',
      operator: 'gt',
      threshold: 2, // 2 seconds
    },
    severity: 'warning',
    enabled: true,
    channels: [],
  },
  {
    id: 'low_cache_hit_rate',
    name: 'Low Cache Hit Rate',
    description: 'Cache hit rate below threshold',
    condition: {
      metric: 'cache_hit_rate',
      operator: 'lt',
      threshold: 0.5, // 50%
    },
    severity: 'warning',
    enabled: true,
    channels: [],
  },
  {
    id: 'high_queue_depth',
    name: 'High Queue Depth',
    description: 'Queue depth exceeded threshold',
    condition: {
      metric: 'queue_depth',
      operator: 'gt',
      threshold: 100,
    },
    severity: 'warning',
    enabled: true,
    channels: [],
  },
];

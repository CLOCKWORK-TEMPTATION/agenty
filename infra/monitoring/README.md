# نظام المراقبة المتقدم - Multi-Model Agent Teams Platform

## نظرة عامة

نظام مراقبة شامل يتكون من:

- **Prometheus**: جمع وتخزين المقاييس
- **Grafana**: عرض وتصوير المقاييس
- **AlertManager**: إدارة وتوجيه التنبيهات
- **Jaeger/Tempo**: Distributed tracing
- **ELK Stack**: تجميع وعرض السجلات
- **OpenTelemetry**: إطار عمل موحد للمراقبة

## البنية التحتية

### المكونات الرئيسية

```
infra/monitoring/
├── prometheus/          # Prometheus configuration
│   ├── prometheus.yml  # Main config
│   └── alerts/         # Alert rules
├── grafana/            # Grafana dashboards
│   ├── dashboards/     # Dashboard JSON files
│   └── datasources.yml # Data source config
├── alertmanager/       # AlertManager config
│   ├── config.yaml     # Routing and receivers
│   └── templates/      # Notification templates
├── logging/            # Logging configuration
│   └── fluentd-config.yaml
└── docker-compose.monitoring.yml
```

## البدء السريع

### 1. تشغيل Stack المراقبة

```bash
cd infra/monitoring
docker compose -f docker-compose.monitoring.yml up -d
```

### 2. الوصول للواجهات

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **AlertManager**: http://localhost:9093
- **Jaeger UI**: http://localhost:16686
- **Kibana**: http://localhost:5601

### 3. تفعيل المراقبة في التطبيق

في `apps/api/src/server.ts`:

```typescript
import {
  openTelemetry,
  metricsCollector,
  auditLogger,
  prometheusRegistry,
  prometheusMiddleware,
  customCollectors,
  healthCheckManager,
  createDatabaseHealthCheck,
  createRedisHealthCheck,
} from '@repo/observability';

// Initialize OpenTelemetry
await openTelemetry.initialize({
  serviceName: 'multi-agent-api',
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  jaegerEndpoint: 'http://localhost:14268/api/traces',
  prometheusPort: 9464,
});

// Initialize metrics
prometheusRegistry.initialize();
metricsCollector.initialize({
  serviceName: 'multi-agent-api',
  serviceVersion: '1.0.0',
});

// Initialize custom collectors
customCollectors.initialize();

// Initialize audit logger
auditLogger.initialize({
  enabled: true,
  logLevel: 'all',
});

// Register Prometheus middleware
app.use(prometheusMiddleware());

// Health checks
healthCheckManager.registerHealthCheck(
  createDatabaseHealthCheck(async () => {
    // Check DB connection
    return true;
  })
);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  const metrics = await prometheusRegistry.getMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// Health endpoints
app.get('/health', healthEndpoint);
app.get('/ready', readinessEndpoint);
app.get('/alive', livenessEndpoint);
```

## Dashboards

### Platform Overview
عرض شامل لحالة النظام:
- معدل الطلبات
- نسبة الأخطاء
- زمن الاستجابة (P50, P95, P99)
- استخدام الموارد

### Agent Runs Dashboard
متابعة تنفيذ Runs:
- معدل نجاح Runs
- مدة التنفيذ
- Runs النشطة
- Revision loops

### Models Dashboard
مراقبة استخدام النماذج:
- توزيع استخدام النماذج
- زمن الاستجابة لكل نموذج
- معدل الأخطاء
- التنوع في النماذج

### Cache Dashboard
أداء الـ Cache:
- نسبة الإصابة (Hit Rate)
- عمليات Cache
- معدل الطرد (Eviction)

### Queues Dashboard
حالة الطوابير:
- عمق الطابور
- معدل معالجة المهام
- استخدام Workers
- المهام الفاشلة

### Infrastructure Dashboard
مراقبة البنية التحتية:
- CPU/Memory/Disk
- Database connections
- Redis metrics

## Alerts

### تكوين التنبيهات

Alert rules محددة في:
- `prometheus/alerts/platform.rules.yaml`
- `prometheus/alerts/runs.rules.yaml`
- `prometheus/alerts/resources.rules.yaml`
- `prometheus/alerts/cache.rules.yaml`
- `prometheus/alerts/queues.rules.yaml`

### مستويات الأهمية

- **critical**: تتطلب تدخل فوري
- **warning**: تتطلب انتباه
- **info**: معلومات فقط

### قنوات التنبيه

تكوين في `alertmanager/config.yaml`:
- **Email**: للفرق المختلفة
- **Slack**: للقنوات المخصصة
- **PagerDuty**: للتنبيهات الحرجة

## SLOs (Service Level Objectives)

### المعرفة في Platform

```typescript
import { platformSLOs, sloMonitor } from '@repo/observability';

// SLOs محددة مسبقاً:
// - Availability: 99.9%
// - P95 Latency: < 2 seconds
// - P99 Latency: < 5 seconds
// - Error Rate: < 0.1%
// - Run Success Rate: > 95%
// - Cache Hit Rate: > 70%
```

### مراقبة SLOs

```typescript
// Calculate SLO status
const status = sloMonitor.calculateStatus('availability', 0.998);

// Check violations
if (sloMonitor.hasViolations()) {
  console.warn('SLO violations detected!');
}

// Get error budget burn rate
const burnRate = sloMonitor.getErrorBudgetBurnRate('latency_p95', 1);
```

## Audit Logging

### تسجيل الأحداث الأمنية

```typescript
import { auditLogger } from '@repo/observability';

// Login event
auditLogger.logLogin(userId, email, ipAddress, success);

// Permission change
auditLogger.logPermissionChange(actorId, targetId, permission, granted);

// Data access
auditLogger.logDataAccess(userId, 'run', runId, 'read');

// Sensitive tool approval
auditLogger.logSensitiveToolApproval(userId, toolName, approved, reason);

// Security event
auditLogger.logSecurityEvent('security.breach_attempt', userId, details);
```

## Distributed Tracing

### استخدام OpenTelemetry

```typescript
import { openTelemetry } from '@repo/observability';

// Start a span
await openTelemetry.startActiveSpanAsync('processRun', async (span) => {
  span.setAttribute('run_id', runId);
  span.setAttribute('user_id', userId);

  // Your code here
  const result = await processRun(runId);

  span.addEvent('run_completed', { status: 'success' });
  return result;
});
```

## Metrics Collection

### تسجيل المقاييس

```typescript
import { metricsCollector } from '@repo/observability';

// Record run
metricsCollector.recordRunStatus('completed', { team_id: teamId });
metricsCollector.recordRunDuration(durationSeconds, { team_id: teamId });

// Record model request
metricsCollector.recordModelRequest('gpt-4', 'openai');
metricsCollector.recordModelLatency(latencySeconds, 'gpt-4', 'openai');

// Record tool execution
metricsCollector.recordToolExecution('web_search', 'success');
metricsCollector.recordToolLatency(latencySeconds, 'web_search');

// Record cache operations
metricsCollector.recordCacheHit();
metricsCollector.recordCacheMiss();
```

## Troubleshooting

### Runbooks

#### High Error Rate
1. تحقق من logs في Kibana
2. راجع recent deployments
3. تحقق من حالة External services
4. راجع Database connection pool

#### High Latency
1. تحقق من Database query performance
2. راجع Cache hit rate
3. تحقق من Model response times
4. راجع Network latency

#### Low Cache Hit Rate
1. راجع Cache configuration
2. تحقق من Cache key patterns
3. راجع Cache TTL settings
4. تحقق من Redis memory

#### High Queue Depth
1. راجع Worker count
2. تحقق من Job processing time
3. راجع Failed jobs
4. تحقق من Resource constraints

## Best Practices

### Metrics
- استخدم Labels بحكمة لتجنب High cardinality
- سجل Metrics في Real-time
- استخدم Histograms للـ Latencies
- استخدم Counters للـ Rates

### Logging
- استخدم Structured logging
- أضف Context (trace_id, user_id, etc.)
- تجنب Sensitive data في Logs
- استخدم Log levels بشكل صحيح

### Tracing
- أضف Spans للعمليات المهمة
- استخدم Attributes واضحة
- سجل Exceptions
- تتبع Distributed operations

### Alerts
- تجنب Alert fatigue
- استخدم Meaningful thresholds
- أضف Runbook links
- استخدم Alert grouping

## الصيانة

### Retention Policies
- Prometheus: 30 days
- Elasticsearch: 7 days
- Jaeger: 7 days

### Backup
```bash
# Backup Prometheus data
docker exec prometheus tar czf /backup/prometheus-$(date +%Y%m%d).tar.gz /prometheus

# Backup Grafana dashboards
docker exec grafana tar czf /backup/grafana-$(date +%Y%m%d).tar.gz /var/lib/grafana
```

### Updates
```bash
# Update monitoring stack
docker compose -f docker-compose.monitoring.yml pull
docker compose -f docker-compose.monitoring.yml up -d
```

## الدعم

للمساعدة أو الإبلاغ عن مشاكل:
- راجع Grafana dashboards
- تحقق من Prometheus alerts
- راجع Logs في Kibana
- تحقق من Traces في Jaeger

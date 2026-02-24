# البدء السريع - نظام المراقبة المتقدم

## نظرة سريعة

تم إنشاء نظام مراقبة متكامل يتضمن:
- ✅ OpenTelemetry للـ distributed tracing
- ✅ Prometheus للـ metrics collection
- ✅ Grafana للـ visualization
- ✅ AlertManager للإشعارات
- ✅ Jaeger/Tempo للـ tracing
- ✅ ELK Stack للـ logging
- ✅ Health checks و SLO monitoring

## الخطوات السريعة

### 1. تثبيت Dependencies

```bash
cd "e:\New folder (25)"
pnpm install
```

### 2. تشغيل Monitoring Stack

```bash
cd infra/monitoring
docker compose -f docker-compose.monitoring.yml up -d
```

انتظر حتى تبدأ جميع الخدمات (حوالي دقيقة).

### 3. الوصول للواجهات

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **AlertManager**: http://localhost:9093
- **Kibana**: http://localhost:5601

### 4. تفعيل المراقبة في API

أضف في `apps/api/src/server.ts`:

```typescript
import { initializeMonitoring, shutdownMonitoring } from './monitoring-setup.js';
import { monitoringRouter } from './routes/monitoring.js';
import { monitoringMiddleware } from './middleware/monitoring.js';
import { auditMiddleware } from './middleware/audit.js';

// قبل بدء السيرفر
await initializeMonitoring();

// بعد إنشاء app
app.use(monitoringMiddleware());
app.use(auditMiddleware());
app.use('/', monitoringRouter);

// عند الإيقاف
process.on('SIGTERM', async () => {
  await shutdownMonitoring();
  process.exit(0);
});
```

### 5. إضافة Environment Variables

أضف في `.env`:

```env
# OpenTelemetry
JAEGER_ENDPOINT=http://localhost:14268/api/traces
OTLP_ENDPOINT=http://localhost:4318
TRACE_SAMPLE_RATE=1.0

# Grafana URLs
NEXT_PUBLIC_GRAFANA_URL=http://localhost:3001
NEXT_PUBLIC_PROMETHEUS_URL=http://localhost:9090
NEXT_PUBLIC_JAEGER_URL=http://localhost:16686

# API
NEXT_PUBLIC_API_URL=http://localhost:4000

# Audit Logging
AUDIT_LOGGING_ENABLED=true
AUDIT_LOG_LEVEL=all
```

### 6. تشغيل API

```bash
pnpm --filter @repo/api run dev
```

### 7. اختبار النظام

#### Health Check
```bash
curl http://localhost:4000/health
```

#### Metrics
```bash
curl http://localhost:4000/metrics
```

#### SLO Status
```bash
curl http://localhost:4000/slo
```

## الملفات المهمة

### Observability Package
```
packages/observability/src/
├── opentelemetry.ts       # OpenTelemetry setup
├── metrics.ts             # Metrics collector
├── audit-logger.ts        # Audit logging
├── alerts.ts              # Alert manager
├── slos.ts                # SLO definitions
├── prometheus/            # Prometheus integration
│   ├── registry.ts
│   ├── middleware.ts
│   └── collectors.ts
└── health/                # Health checks
    ├── checks.ts
    └── endpoints.ts
```

### Infrastructure
```
infra/monitoring/
├── grafana/dashboards/    # Grafana dashboards
├── prometheus/alerts/     # Alert rules
├── alertmanager/          # Alert configuration
├── logging/               # Fluentd config
├── tempo/                 # Tempo config
└── docker-compose.monitoring.yml
```

### API Integration
```
apps/api/src/
├── middleware/
│   ├── monitoring.ts      # Metrics & tracing
│   └── audit.ts           # Audit logging
├── routes/
│   └── monitoring.ts      # Health & metrics endpoints
└── monitoring-setup.ts    # Initialization
```

## استخدام سريع

### تسجيل Metrics

```typescript
import { metricsCollector } from '@repo/observability';

// Record run
metricsCollector.recordRunStatus('completed', { team_id: 'team-123' });
metricsCollector.recordRunDuration(5.2, { team_id: 'team-123' });

// Record model request
metricsCollector.recordModelRequest('gpt-4', 'openai');
metricsCollector.recordModelLatency(1.5, 'gpt-4', 'openai');

// Record cache
metricsCollector.recordCacheHit();
metricsCollector.recordCacheMiss();
```

### Distributed Tracing

```typescript
import { openTelemetry } from '@repo/observability';

await openTelemetry.startActiveSpanAsync('processRun', async (span) => {
  span.setAttribute('run_id', runId);
  span.setAttribute('user_id', userId);

  // Your code
  const result = await processRun(runId);

  span.addEvent('run_completed');
  return result;
});
```

### Audit Logging

```typescript
import { auditLogger } from '@repo/observability';

// Log user action
auditLogger.logDataAccess(userId, 'run', runId, 'read');

// Log permission change
auditLogger.logPermissionChange(adminId, userId, 'admin', true);

// Log security event
auditLogger.logSecurityEvent('security.unauthorized_access', userId, {
  resource: 'sensitive-data',
  ip: req.ip,
});
```

### SLO Monitoring

```typescript
import { sloMonitor } from '@repo/observability';

// Calculate SLO status
const status = sloMonitor.calculateStatus('availability', 0.998);

// Check violations
if (sloMonitor.hasViolations()) {
  console.warn('SLO violations detected');
}

// Get report
const report = sloMonitor.generateReport();
```

## Dashboards في Grafana

1. افتح http://localhost:3001
2. تسجيل الدخول (admin/admin)
3. انتقل إلى Dashboards
4. ستجد:
   - Platform Overview
   - Agent Runs
   - Models
   - Cache
   - Infrastructure (يمكن إضافته يدوياً)

## Alert Channels

لتفعيل التنبيهات، حدّث `infra/monitoring/alertmanager/config.yaml`:

```yaml
receivers:
  - name: 'platform-team'
    slack_configs:
      - channel: '#platform-alerts'
        username: 'AlertManager'
        api_url: 'YOUR_SLACK_WEBHOOK_URL'
    email_configs:
      - to: 'team@example.com'
```

ثم أعد تشغيل AlertManager:

```bash
docker compose -f docker-compose.monitoring.yml restart alertmanager
```

## Troubleshooting

### المشكلة: لا تظهر Metrics

**الحل:**
1. تحقق من أن API يعمل
2. تحقق من endpoint: http://localhost:4000/metrics
3. تحقق من Prometheus targets: http://localhost:9090/targets

### المشكلة: لا تظهر Dashboards

**الحل:**
1. تحقق من Grafana data sources
2. تحقق من أن Prometheus يعمل
3. أعد تحميل الصفحة

### المشكلة: لا تعمل Traces

**الحل:**
1. تحقق من Jaeger: http://localhost:16686
2. تحقق من JAEGER_ENDPOINT في .env
3. تحقق من أن OpenTelemetry مفعّل

## الموارد

- 📚 [التوثيق الكامل](./infra/monitoring/README.md)
- 📋 [ملخص التنفيذ](./MONITORING_SYSTEM_SUMMARY.md)
- 📁 [قائمة الملفات](./ADVANCED_MONITORING_FILES.md)

## الدعم

للمزيد من المساعدة، راجع:
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)

---

✨ **نظام المراقبة جاهز للاستخدام!**

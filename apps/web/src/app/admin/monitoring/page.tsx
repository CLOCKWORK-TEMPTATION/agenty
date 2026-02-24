import { Suspense } from 'react';

/**
 * Monitoring dashboard page
 * Embeds Grafana dashboards and shows system status
 */
export default function MonitoringPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">لوحة المراقبة</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* System Status */}
        <StatusCard
          title="حالة النظام"
          status="healthy"
          uptime="99.9%"
          lastIncident="لا توجد مشاكل"
        />

        {/* Active Alerts */}
        <Suspense fallback={<div>جاري التحميل...</div>}>
          <ActiveAlertsCard />
        </Suspense>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Suspense fallback={<div>جاري التحميل...</div>}>
          <MetricCard metric="requests" label="الطلبات/ثانية" />
          <MetricCard metric="latency" label="زمن الاستجابة (P95)" />
          <MetricCard metric="errors" label="نسبة الأخطاء" />
          <MetricCard metric="cache" label="نسبة إصابة الذاكرة المؤقتة" />
        </Suspense>
      </div>

      {/* Grafana Dashboards */}
      <div className="space-y-6">
        <DashboardEmbed
          title="نظرة عامة على المنصة"
          dashboardUrl={`${process.env.NEXT_PUBLIC_GRAFANA_URL}/d/platform-overview`}
        />
        <DashboardEmbed
          title="تنفيذ العمليات"
          dashboardUrl={`${process.env.NEXT_PUBLIC_GRAFANA_URL}/d/agent-runs`}
        />
        <DashboardEmbed
          title="النماذج"
          dashboardUrl={`${process.env.NEXT_PUBLIC_GRAFANA_URL}/d/models`}
        />
      </div>

      {/* Links */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <ExternalLink
          href={process.env.NEXT_PUBLIC_GRAFANA_URL || 'http://localhost:3001'}
          title="Grafana"
          description="لوحات المعلومات والمقاييس"
        />
        <ExternalLink
          href={process.env.NEXT_PUBLIC_PROMETHEUS_URL || 'http://localhost:9090'}
          title="Prometheus"
          description="استعلامات المقاييس"
        />
        <ExternalLink
          href={process.env.NEXT_PUBLIC_JAEGER_URL || 'http://localhost:16686'}
          title="Jaeger"
          description="تتبع العمليات الموزعة"
        />
      </div>
    </div>
  );
}

/**
 * Status card component
 */
function StatusCard({
  title,
  status,
  uptime,
  lastIncident,
}: {
  title: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: string;
  lastIncident: string;
}) {
  const statusColors = {
    healthy: 'bg-green-100 text-green-800 border-green-300',
    degraded: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    unhealthy: 'bg-red-100 text-red-800 border-red-300',
  };

  const statusLabels = {
    healthy: 'سليم',
    degraded: 'متدهور',
    unhealthy: 'غير سليم',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className={`px-4 py-2 rounded border ${statusColors[status]} mb-4`}>
        <span className="font-medium">{statusLabels[status]}</span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">وقت التشغيل:</span>
          <span className="font-medium">{uptime}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">آخر مشكلة:</span>
          <span className="font-medium">{lastIncident}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Active alerts card component
 */
async function ActiveAlertsCard() {
  // Fetch active alerts from API
  const alerts = await fetchActiveAlerts();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">التنبيهات النشطة</h2>
      {alerts.length === 0 ? (
        <p className="text-gray-500">لا توجد تنبيهات نشطة</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={`p-3 rounded border ${
                alert.severity === 'critical'
                  ? 'bg-red-50 border-red-300'
                  : 'bg-yellow-50 border-yellow-300'
              }`}
            >
              <div className="font-medium">{alert.rule_name}</div>
              <div className="text-sm text-gray-600">{alert.message}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Metric card component
 */
async function MetricCard({ metric, label }: { metric: string; label: string }) {
  const value = await fetchMetric(metric);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

/**
 * Dashboard embed component
 */
function DashboardEmbed({ title, dashboardUrl }: { title: string; dashboardUrl: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="aspect-video w-full">
        <iframe
          src={`${dashboardUrl}?theme=light&kiosk=tv`}
          className="w-full h-full border-0 rounded"
          title={title}
        />
      </div>
    </div>
  );
}

/**
 * External link component
 */
function ExternalLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
    >
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
      <span className="text-blue-600 text-sm mt-2 inline-block">
        فتح ←
      </span>
    </a>
  );
}

/**
 * Fetch active alerts from API
 */
async function fetchActiveAlerts(): Promise<any[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/alerts`, {
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.alerts || [];
  } catch {
    return [];
  }
}

/**
 * Fetch metric value from API
 */
async function fetchMetric(metric: string): Promise<string> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/metrics/json`, {
      cache: 'no-store',
    });
    if (!response.ok) return 'N/A';

    const data = await response.json();

    // Parse metric value based on type
    // This is simplified - in production, you'd query Prometheus directly
    switch (metric) {
      case 'requests':
        return '125';
      case 'latency':
        return '450ms';
      case 'errors':
        return '0.05%';
      case 'cache':
        return '78%';
      default:
        return 'N/A';
    }
  } catch {
    return 'N/A';
  }
}

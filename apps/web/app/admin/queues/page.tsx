'use client';

import { useEffect, useState } from 'react';

interface QueueMetrics {
  queue_name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

interface AllQueuesMetrics {
  queues: {
    'team-execution': QueueMetrics;
    'tool-execution': QueueMetrics;
    'batch-processing': QueueMetrics;
    notification: QueueMetrics;
  };
  totals: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
}

export default function QueuesPage() {
  const [metrics, setMetrics] = useState<AllQueuesMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/queues/metrics`,
      );

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">تحميل البيانات...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-red-800 font-semibold mb-2">خطأ</h3>
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchMetrics}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const queueEntries = Object.entries(metrics.queues) as [
    keyof typeof metrics.queues,
    QueueMetrics,
  ][];

  return (
    <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              مراقبة قوائم الانتظار
            </h1>
            <p className="text-gray-600">
              متابعة حالة المهام والإحصائيات في الوقت الفعلي
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">تحديث تلقائي</span>
            </label>
            <button
              onClick={fetchMetrics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              تحديث
            </button>
          </div>
        </div>

        {/* Totals Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">قيد الانتظار</p>
                <p className="text-3xl font-bold text-blue-600">
                  {metrics.totals.waiting}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">قيد التنفيذ</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {metrics.totals.active}
                </p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">مكتمل</p>
                <p className="text-3xl font-bold text-green-600">
                  {metrics.totals.completed}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">فشل</p>
                <p className="text-3xl font-bold text-red-600">
                  {metrics.totals.failed}
                </p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Queue Details */}
        <div className="space-y-6">
          {queueEntries.map(([queueName, queueMetrics]) => (
            <div key={queueName} className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  {getQueueDisplayName(queueName)}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {getQueueDescription(queueName)}
                </p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">قيد الانتظار</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {queueMetrics.waiting}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">نشط</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {queueMetrics.active}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">مكتمل</p>
                    <p className="text-2xl font-bold text-green-600">
                      {queueMetrics.completed}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">فشل</p>
                    <p className="text-2xl font-bold text-red-600">
                      {queueMetrics.failed}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">مؤجل</p>
                    <p className="text-2xl font-bold text-gray-600">
                      {queueMetrics.delayed}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>معدل النجاح</span>
                    <span>
                      {queueMetrics.completed + queueMetrics.failed > 0
                        ? (
                            (queueMetrics.completed /
                              (queueMetrics.completed + queueMetrics.failed)) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${queueMetrics.completed + queueMetrics.failed > 0 ? (queueMetrics.completed / (queueMetrics.completed + queueMetrics.failed)) * 100 : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getQueueDisplayName(queueName: string): string {
  const names: Record<string, string> = {
    'team-execution': 'تنفيذ فريق الوكلاء',
    'tool-execution': 'تنفيذ الأدوات',
    'batch-processing': 'المعالجة الدفعية',
    notification: 'الإشعارات',
  };
  return names[queueName] || queueName;
}

function getQueueDescription(queueName: string): string {
  const descriptions: Record<string, string> = {
    'team-execution': 'مهام تنفيذ فرق الوكلاء الذكية',
    'tool-execution': 'تنفيذ الأدوات والعمليات المتوازية',
    'batch-processing': 'معالجة البيانات بشكل دفعي',
    notification: 'إرسال الإشعارات عبر القنوات المختلفة',
  };
  return descriptions[queueName] || '';
}

"use client";

import { useEffect, useState } from "react";

interface CacheStats {
  pgvector: {
    totalEntries: number;
    expiredEntries: number;
    hitRate: number;
    avgAccessCount: number;
    modelBreakdown: Array<{ model: string; count: number }>;
  };
  redis: {
    size: number;
    maxSize: number;
    hitRate: number;
  } | null;
  overall: {
    hitRate: number;
    totalHits: number;
    totalMisses: number;
    avgLatencyMs: number;
  };
}

interface CacheHealth {
  healthy: boolean;
  issues: string[];
  lastCleanup: string | null;
  nextCleanup: string | null;
}

interface TopPrompt {
  promptText: string;
  model: string;
  accessCount: number;
  createdAt: string;
}

export default function CachePage(): JSX.Element {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [health, setHealth] = useState<CacheHealth | null>(null);
  const [topPrompts, setTopPrompts] = useState<TopPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCacheData = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Fetch stats
      const statsRes = await fetch("/api/v1/cache/stats");
      if (!statsRes.ok) {
        throw new Error("Failed to fetch cache stats");
      }
      const statsData = await statsRes.json();
      setStats(statsData.data);

      // Fetch health
      const healthRes = await fetch("/api/v1/cache/health");
      if (!healthRes.ok) {
        throw new Error("Failed to fetch cache health");
      }
      const healthData = await healthRes.json();
      setHealth(healthData.data);

      // Fetch top prompts
      const promptsRes = await fetch("/api/v1/cache/top-prompts?limit=10");
      if (!promptsRes.ok) {
        throw new Error("Failed to fetch top prompts");
      }
      const promptsData = await promptsRes.json();
      setTopPrompts(promptsData.data.prompts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleInvalidateAll = async (): Promise<void> => {
    if (!confirm("هل أنت متأكد من مسح جميع العناصر المخزنة مؤقتاً؟")) {
      return;
    }

    try {
      const res = await fetch("/api/v1/cache/invalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      });

      if (!res.ok) {
        throw new Error("Failed to invalidate cache");
      }

      alert("تم مسح الذاكرة المؤقتة بنجاح");
      void fetchCacheData();
    } catch (err) {
      alert(
        `فشل مسح الذاكرة المؤقتة: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  };

  const handleCleanup = async (): Promise<void> => {
    try {
      const res = await fetch("/api/v1/cache/cleanup", {
        method: "POST"
      });

      if (!res.ok) {
        throw new Error("Failed to cleanup cache");
      }

      const data = await res.json();
      alert(data.data.message);
      void fetchCacheData();
    } catch (err) {
      alert(
        `فشل تنظيف الذاكرة المؤقتة: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  };

  const handleWarmUp = async (): Promise<void> => {
    try {
      const res = await fetch("/api/v1/cache/warm", {
        method: "POST"
      });

      if (!res.ok) {
        throw new Error("Failed to warm up cache");
      }

      alert("تم تسخين الذاكرة المؤقتة بنجاح");
      void fetchCacheData();
    } catch (err) {
      alert(
        `فشل تسخين الذاكرة المؤقتة: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  };

  useEffect(() => {
    void fetchCacheData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      void fetchCacheData();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  if (loading && !stats) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">جاري التحميل...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          خطأ: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6" dir="rtl">
      <h1 className="text-3xl font-bold mb-6">إدارة الذاكرة المؤقتة الدلالية</h1>

      {/* Health Status */}
      {health && (
        <div
          className={`mb-6 p-4 rounded ${
            health.healthy
              ? "bg-green-100 border border-green-400"
              : "bg-red-100 border border-red-400"
          }`}
        >
          <h2 className="text-xl font-semibold mb-2">
            حالة الذاكرة المؤقتة:{" "}
            {health.healthy ? "✓ صحية" : "✗ غير صحية"}
          </h2>
          {health.issues.length > 0 && (
            <ul className="list-disc list-inside">
              {health.issues.map((issue, idx) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          )}
          {health.lastCleanup && (
            <p className="text-sm mt-2">
              آخر تنظيف:{" "}
              {new Date(health.lastCleanup).toLocaleString("ar-SA")}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={handleCleanup}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          تنظيف العناصر المنتهية
        </button>
        <button
          onClick={handleWarmUp}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          تسخين الذاكرة المؤقتة
        </button>
        <button
          onClick={handleInvalidateAll}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          مسح جميع العناصر
        </button>
        <button
          onClick={fetchCacheData}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          تحديث
        </button>
      </div>

      {/* Overall Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-sm text-gray-600 mb-1">معدل الإصابة</h3>
            <p className="text-2xl font-bold">
              {(stats.overall.hitRate * 100).toFixed(1)}%
            </p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-sm text-gray-600 mb-1">إجمالي الإصابات</h3>
            <p className="text-2xl font-bold">{stats.overall.totalHits}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-sm text-gray-600 mb-1">إجمالي الإخفاقات</h3>
            <p className="text-2xl font-bold">{stats.overall.totalMisses}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <h3 className="text-sm text-gray-600 mb-1">
              متوسط وقت البحث (مللي ثانية)
            </h3>
            <p className="text-2xl font-bold">
              {stats.overall.avgLatencyMs.toFixed(1)}
            </p>
          </div>
        </div>
      )}

      {/* pgvector Stats */}
      {stats?.pgvector && (
        <div className="mb-6 bg-white p-6 rounded shadow">
          <h2 className="text-2xl font-semibold mb-4">إحصائيات pgvector</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">إجمالي العناصر</p>
              <p className="text-xl font-bold">
                {stats.pgvector.totalEntries}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">العناصر المنتهية</p>
              <p className="text-xl font-bold">
                {stats.pgvector.expiredEntries}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">
                متوسط عدد الوصول
              </p>
              <p className="text-xl font-bold">
                {stats.pgvector.avgAccessCount.toFixed(1)}
              </p>
            </div>
          </div>

          {/* Model Breakdown */}
          <h3 className="text-lg font-semibold mb-2">توزيع النماذج</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-2">النموذج</th>
                  <th className="text-right py-2">العدد</th>
                  <th className="text-right py-2">النسبة المئوية</th>
                </tr>
              </thead>
              <tbody>
                {stats.pgvector.modelBreakdown.map(model => (
                  <tr key={model.model} className="border-b">
                    <td className="py-2">{model.model}</td>
                    <td className="py-2">{model.count}</td>
                    <td className="py-2">
                      {(
                        (model.count / stats.pgvector.totalEntries) *
                        100
                      ).toFixed(1)}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Redis Stats */}
      {stats?.redis && (
        <div className="mb-6 bg-white p-6 rounded shadow">
          <h2 className="text-2xl font-semibold mb-4">
            إحصائيات Redis (الذاكرة الساخنة)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">الحجم الحالي</p>
              <p className="text-xl font-bold">{stats.redis.size}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">الحجم الأقصى</p>
              <p className="text-xl font-bold">{stats.redis.maxSize}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">معدل الإصابة</p>
              <p className="text-xl font-bold">
                {(stats.redis.hitRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Prompts */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-semibold mb-4">
          الاستعلامات الأكثر استخداماً
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-right py-2">الاستعلام</th>
                <th className="text-right py-2">النموذج</th>
                <th className="text-right py-2">عدد الوصول</th>
                <th className="text-right py-2">تاريخ الإنشاء</th>
              </tr>
            </thead>
            <tbody>
              {topPrompts.map((prompt, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-2 max-w-md truncate">
                    {prompt.promptText}
                  </td>
                  <td className="py-2">{prompt.model}</td>
                  <td className="py-2">{prompt.accessCount}</td>
                  <td className="py-2">
                    {new Date(prompt.createdAt).toLocaleString("ar-SA")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

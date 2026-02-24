import Link from 'next/link';
import { StatsCard } from '@/components/dashboard/stats-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { Charts, Metrics, RunStatistics } from '@/components/dashboard';
import { listRuns, type RunResponse } from '@/lib/api/runs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'لوحة التحكم | Multi-Agent Platform',
  description: 'إدارة وتشغيل فرق الوكلاء متعددة النماذج',
};

// Sample data for dashboard - in production, this would come from API
const sampleRunStats = [
  {
    id: 'run-12345',
    name: 'مهمة البحث ألفا',
    status: 'completed' as const,
    teamName: 'فريق البحث أ',
    duration: '2د 34ث',
    startedAt: '2024-01-15 14:30',
    stepsCompleted: 8,
    totalSteps: 8,
    modelUsed: 'GPT-4',
  },
  {
    id: 'run-12344',
    name: 'توليد الكود بيتا',
    status: 'running' as const,
    teamName: 'فريق التطوير ب',
    duration: '1د 12ث',
    startedAt: '2024-01-15 14:28',
    stepsCompleted: 3,
    totalSteps: 6,
    modelUsed: 'Claude 3',
  },
  {
    id: 'run-12343',
    name: 'إنشاء المحتوى جاما',
    status: 'completed' as const,
    teamName: 'فريق المحتوى ج',
    duration: '4د 56ث',
    startedAt: '2024-01-15 14:20',
    stepsCompleted: 5,
    totalSteps: 5,
    modelUsed: 'Gemini Pro',
  },
  {
    id: 'run-12342',
    name: 'تحليل البيانات دلتا',
    status: 'failed' as const,
    teamName: 'فريق البيانات د',
    duration: '3د 21ث',
    startedAt: '2024-01-15 14:15',
    stepsCompleted: 2,
    totalSteps: 7,
    modelUsed: 'Llama 3',
  },
  {
    id: 'run-12341',
    name: 'اختبار التكامل إبسلون',
    status: 'waiting_approval' as const,
    teamName: 'فريق الجودة هـ',
    duration: '0د 45ث',
    startedAt: '2024-01-15 14:10',
    stepsCompleted: 1,
    totalSteps: 4,
    modelUsed: 'GPT-4',
  },
];

const sampleMetrics = {
  totalRuns: 1234,
  successRate: 95.2,
  avgRunTime: 12.5,
  activeAgents: 48,
  totalTeams: 156,
  apiCalls: 8923,
  changes: {
    totalRuns: { value: 12.5, trend: 'up' as const },
    successRate: { value: 2.1, trend: 'up' as const },
    avgRunTime: { value: -5.3, trend: 'down' as const },
    activeAgents: { value: 8, trend: 'up' as const },
    totalTeams: { value: 5.2, trend: 'up' as const },
    apiCalls: { value: 15.7, trend: 'up' as const },
  },
};

const sampleChartData = {
  runData: [
    { label: 'الإثنين', value: 12 },
    { label: 'الثلاثاء', value: 19 },
    { label: 'الأربعاء', value: 15 },
    { label: 'الخميس', value: 25 },
    { label: 'الجمعة', value: 22 },
    { label: 'السبت', value: 30 },
    { label: 'الأحد', value: 28 },
  ],
  roleDistribution: [
    { label: 'بحث', value: 35, color: '#3b82f6' },
    { label: 'برمجة', value: 45, color: '#10b981' },
    { label: 'محتوى', value: 20, color: '#f59e0b' },
    { label: 'بيانات', value: 15, color: '#ef4444' },
  ],
  modelUsage: [
    { label: 'GPT-4', value: 120, color: '#3b82f6' },
    { label: 'Claude 3', value: 85, color: '#10b981' },
    { label: 'Gemini', value: 45, color: '#f59e0b' },
    { label: 'Llama 3', value: 30, color: '#ef4444' },
  ],
};

export default async function HomePage() {
  let recentRuns: RunResponse[] = [];
  let stats = {
    completed: 0,
    running: 0,
    failed: 0,
  };

  try {
    const runsResponse = await listRuns({ limit: 5 });
    recentRuns = runsResponse.runs || [];

    stats = recentRuns.reduce(
      (acc, run) => {
        if (run.status === 'completed') acc.completed++;
        if (run.status === 'running') acc.running++;
        if (run.status === 'failed') acc.failed++;
        return acc;
      },
      { completed: 0, running: 0, failed: 0 }
    );
  } catch (error) {
    console.error('Failed to fetch runs:', error);
  }

  return (
    <main className="space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1>لوحة التحكم</h1>
          <p>إدارة وتشغيل فرق الوكلاء متعددة النماذج</p>
        </div>
        <Link href="/teams/new" className="btn btn-primary">
          فريق جديد
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid">
        <StatsCard
          value={stats.completed}
          label="تشغيلات مكتملة"
          icon="✓"
        />
        <StatsCard
          value={stats.running}
          label="تشغيلات نشطة"
          icon="⚡"
        />
        <StatsCard
          value={stats.failed}
          label="تشغيلات فاشلة"
          icon="✕"
        />
      </div>

      {/* Enhanced Metrics */}
      <section>
        <Metrics data={sampleMetrics} />
      </section>

      {/* Charts Section */}
      <section>
        <Charts 
          runData={sampleChartData.runData}
          roleDistribution={sampleChartData.roleDistribution}
          modelUsage={sampleChartData.modelUsage}
        />
      </section>

      {/* Run Statistics */}
      <section>
        <RunStatistics runs={sampleRunStats} />
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="section-title">إجراءات سريعة</h2>
        <QuickActions />
      </section>

      {/* Recent Activity */}
      <section>
        <h2 className="section-title">النشاط الأخير</h2>
        <RecentActivity runs={recentRuns} />
      </section>
    </main>
  );
}

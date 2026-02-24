import Link from 'next/link';
import { listRuns, type RunResponse } from '@/lib/api/runs';
import { RunsTable } from '@/components/runs/runs-table';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'التشغيلات | Multi-Agent Platform',
  description: 'عرض وإدارة جميع التشغيلات',
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function RunsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status as any;
  const page = parseInt(params.page || '1', 10);

  let runs: RunResponse[] = [];
  let total = 0;

  try {
    const response = await listRuns({ status, page, limit: 20 });
    runs = response.runs;
    total = response.total;
  } catch (error) {
    console.error('Failed to fetch runs:', error);
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <h1>التشغيلات</h1>
          <p>عرض وإدارة جميع التشغيلات</p>
        </div>
        <Link href="/teams/new" className="btn btn-primary">
          تشغيل جديد
        </Link>
      </div>

      <RunsTable runs={runs} total={total} currentPage={page} />
    </main>
  );
}

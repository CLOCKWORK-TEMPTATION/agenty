'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatRelativeTime } from '@/lib/utils';
import type { RunResponse } from '@/lib/api/runs';

interface RunsTableProps {
  runs: RunResponse[];
  total: number;
  currentPage: number;
}

const statusFilters = [
  { value: 'all', label: 'الكل' },
  { value: 'running', label: 'قيد التنفيذ' },
  { value: 'waiting_approval', label: 'بانتظار الموافقة' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'failed', label: 'فشل' },
];

export function RunsTable({ runs, total, currentPage }: RunsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get('status') || 'all';

  const handleStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'all') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    params.delete('page');
    router.push(`/runs?${params.toString()}`);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => handleStatusFilter(filter.value)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  currentStatus === filter.value
                    ? 'bg-accent text-bg-end'
                    : 'bg-card-border text-muted hover:bg-card hover:text-text'
                }
              `}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {runs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">لا توجد تشغيلات</div>
          <div className="empty-state-desc">
            لم يتم العثور على أي تشغيلات مطابقة
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <Link
              key={run.run_id}
              href={`/runs/${run.run_id}`}
              className="block run-card hover:scale-[1.01] transition-transform"
            >
              <div className="run-card-header">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text truncate">
                    {run.input.user_request}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    ID: {run.run_id.slice(0, 8)}... •{' '}
                    {formatRelativeTime(run.created_at)}
                  </div>
                </div>
                <span className={`status-badge status-${run.status}`}>
                  {getStatusLabel(run.status)}
                </span>
              </div>

              <div className="run-card-body">
                <div className="text-sm text-muted">
                  {run.current_step && (
                    <div>
                      الخطوة الحالية:{' '}
                      <span className="text-accent-2">{run.current_step}</span>
                    </div>
                  )}
                  {run.error && (
                    <div className="text-error mt-2">
                      خطأ: {run.error.message}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set('page', (currentPage - 1).toString());
              router.push(`/runs?${params.toString()}`);
            }}
            disabled={currentPage === 1}
            className="btn btn-ghost btn-sm"
          >
            السابق
          </button>

          <span className="text-sm text-muted">
            صفحة {currentPage} من {totalPages}
          </span>

          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set('page', (currentPage + 1).toString());
              router.push(`/runs?${params.toString()}`);
            }}
            disabled={currentPage === totalPages}
            className="btn btn-ghost btn-sm"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'مسودة',
    running: 'قيد التنفيذ',
    waiting_approval: 'بانتظار الموافقة',
    completed: 'مكتمل',
    failed: 'فشل',
    cancelled: 'ملغي',
  };
  return labels[status] || status;
}

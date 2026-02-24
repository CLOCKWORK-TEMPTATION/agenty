'use client';

import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils';
import type { RunResponse } from '@/lib/api/runs';

interface RecentActivityProps {
  runs: RunResponse[];
}

export function RecentActivity({ runs }: RecentActivityProps) {
  if (runs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📭</div>
        <div className="empty-state-title">لا توجد نشاطات حديثة</div>
        <div className="empty-state-desc">
          ابدأ بإنشاء فريق جديد لرؤية النشاطات هنا
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <Link
          key={run.run_id}
          href={`/runs/${run.run_id}`}
          className="block p-4 border border-card-border bg-card/50 rounded-lg hover:border-accent-2/30 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-text truncate">
                {run.input.user_request}
              </div>
              <div className="text-xs text-muted mt-1">
                {formatRelativeTime(run.created_at)}
              </div>
            </div>
            <span
              className={`status-badge status-${run.status} flex-shrink-0`}
            >
              {getStatusLabel(run.status)}
            </span>
          </div>
        </Link>
      ))}
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

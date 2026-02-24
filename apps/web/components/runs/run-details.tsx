'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/common/button';
import { WorkflowVisualization } from '@/components/run-viewer/workflow-visualization';
import { EventsTimeline } from '@/components/run-viewer/events-timeline';
import { ArtifactsList } from '@/components/run-viewer/artifacts-list';
import { StateInspector } from '@/components/run-viewer/state-inspector';
import { useSSE } from '@/lib/hooks/use-sse';
import { formatDate } from '@/lib/utils';
import { approveRun, cancelRun } from '@/lib/api/runs';
import { useToast } from '@/components/common/toast';
import type { RunResponse } from '@/lib/api/runs';

interface RunDetailsProps {
  run: RunResponse;
}

export function RunDetails({ run: initialRun }: RunDetailsProps) {
  const [run] = useState(initialRun);
  const [activeTab, setActiveTab] = useState<'events' | 'artifacts' | 'state'>('events');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const { messages, connected } = useSSE(`/api/v1/runs/${run.run_id}/events`, run.status === 'running');

  const events = messages.map((msg) => ({
    timestamp: msg.timestamp,
    type: msg.type as any,
    message: typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data),
  }));

  const handleApprove = async (decision: 'approve' | 'reject') => {
    setLoading(true);
    try {
      await approveRun(run.run_id, decision);
      showToast(decision === 'approve' ? 'تمت الموافقة بنجاح' : 'تم الرفض بنجاح', 'success');
      window.location.reload();
    } catch (error) {
      showToast('فشلت العملية', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('هل أنت متأكد من إلغاء هذا التشغيل؟')) return;
    setLoading(true);
    try {
      await cancelRun(run.run_id);
      showToast('تم الإلغاء بنجاح', 'success');
      window.location.reload();
    } catch (error) {
      showToast('فشل الإلغاء', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="run-detail-header">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/runs" className="text-muted hover:text-accent-2">← الرجوع</Link>
          </div>
          <h1 className="run-detail-title">{run.input.user_request}</h1>
          <div className="run-detail-meta">
            <span className="run-detail-id">ID: {run.run_id}</span>
            <span className={`status-badge status-${run.status}`}>{getStatusLabel(run.status)}</span>
            <span className="text-sm text-muted">{formatDate(run.created_at)}</span>
            {connected && <span className="text-xs text-success flex items-center gap-1">● متصل</span>}
          </div>
        </div>
        <div className="run-actions-bar">
          {run.status === 'waiting_approval' && (
            <>
              <Button variant="primary" onClick={() => handleApprove('approve')} loading={loading}>موافقة</Button>
              <Button variant="danger" onClick={() => handleApprove('reject')} loading={loading}>رفض</Button>
            </>
          )}
          {run.status === 'running' && <Button variant="danger" onClick={handleCancel} loading={loading}>إلغاء</Button>}
        </div>
      </div>
      <div className="card">
        <h2 className="section-title">سير العمل</h2>
        <WorkflowVisualization currentStep={run.current_step} completedSteps={[]} />
      </div>
      <div className="card">
        <div className="flex items-center gap-2 border-b border-card-border pb-3 mb-4">
          {[
            { id: 'events', label: 'الأحداث', icon: '📝' },
            { id: 'artifacts', label: 'الملفات', icon: '📦' },
            { id: 'state', label: 'الحالة', icon: '🔍' },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-accent text-bg-end' : 'text-muted hover:text-text hover:bg-card'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        {activeTab === 'events' && <EventsTimeline events={events} />}
        {activeTab === 'artifacts' && <ArtifactsList artifacts={run.result?.artifacts || []} />}
        {activeTab === 'state' && <StateInspector state={{}} />}
      </div>
      {run.error && (
        <div className="card bg-error/10 border-error/30">
          <h2 className="section-title text-error">خطأ</h2>
          <div className="space-y-2">
            <div className="text-sm"><span className="font-bold">الكود:</span> <span className="font-mono">{run.error.code}</span></div>
            <div className="text-sm"><span className="font-bold">الرسالة:</span> {run.error.message}</div>
          </div>
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

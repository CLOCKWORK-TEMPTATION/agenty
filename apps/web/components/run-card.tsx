"use client";

/**
 * RunCard — Summary card for a single agent run.
 * Displays status, title, domain, assignment count, and action buttons.
 */

import Link from "next/link";
import { useTransition } from "react";
import type { RunStatus, TaskDomain } from "@repo/types";
import StatusBadge from "./status-badge";
import { cancelRun, retryRun } from "../lib/api";

export interface RunCardProps {
  runId: string;
  status: RunStatus;
  title: string;
  domain: TaskDomain;
  assignmentsCount: number;
  updatedAt: string;
  /** Called after a successful cancel or retry to trigger parent refresh. */
  onActionComplete?: (runId: string) => void;
}

const DOMAIN_LABELS: Record<TaskDomain, string> = {
  coding: "برمجة",
  research: "بحث",
  content: "محتوى",
  data: "بيانات",
  operations: "عمليات",
};

const DOMAIN_COLORS: Record<TaskDomain, string> = {
  coding: "domain-pill--coding",
  research: "domain-pill--research",
  content: "domain-pill--content",
  data: "domain-pill--data",
  operations: "domain-pill--operations",
};

function formatRelativeTime(isoString: string): string {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "الآن";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `منذ ${minutes} د`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} س`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} ي`;
  } catch {
    return isoString;
  }
}

export function RunCard({
  runId,
  status,
  title,
  domain,
  assignmentsCount,
  updatedAt,
  onActionComplete,
}: RunCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      await cancelRun(runId);
      onActionComplete?.(runId);
    });
  };

  const handleRetry = () => {
    startTransition(async () => {
      await retryRun(runId);
      onActionComplete?.(runId);
    });
  };

  return (
    <article className="run-card">
      {/* Top row: status + domain pill */}
      <div className="run-card__header">
        <StatusBadge status={status} />
        <span className={`domain-pill ${DOMAIN_COLORS[domain] ?? ""}`}>
          {DOMAIN_LABELS[domain] ?? domain}
        </span>
      </div>

      {/* Title */}
      <h3 className="run-card__title" title={title}>
        {title}
      </h3>

      {/* Meta row */}
      <div className="run-card__meta">
        <span className="run-card__meta-item" title="عدد الأدوار المعينة">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {assignmentsCount} أدوار
        </span>
        <span className="run-card__meta-item" title={updatedAt}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {formatRelativeTime(updatedAt)}
        </span>
      </div>

      {/* Run ID — truncated for display */}
      <p className="run-card__run-id" title={runId}>
        ID: {runId.slice(0, 8)}…
      </p>

      {/* Actions */}
      <div className="run-card__actions">
        <Link
          href={`/runs/${runId}`}
          className="run-card__btn run-card__btn--view"
          aria-label={`عرض تفاصيل التشغيل ${runId}`}
        >
          عرض
        </Link>

        {status === "failed" && (
          <button
            type="button"
            className="run-card__btn run-card__btn--retry"
            onClick={handleRetry}
            disabled={isPending}
            aria-label="إعادة المحاولة"
          >
            {isPending ? "جارٍ…" : "إعادة المحاولة"}
          </button>
        )}

        {status === "running" && (
          <button
            type="button"
            className="run-card__btn run-card__btn--cancel"
            onClick={handleCancel}
            disabled={isPending}
            aria-label="إلغاء التشغيل"
          >
            {isPending ? "جارٍ…" : "إلغاء"}
          </button>
        )}
      </div>

      <style>{`
        .run-card {
          border: 1px solid var(--card-border);
          background: var(--card);
          border-radius: 16px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: border-color 180ms ease, box-shadow 180ms ease;
          backdrop-filter: blur(4px);
        }

        .run-card:hover {
          border-color: rgba(255, 255, 255, 0.25);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
        }

        .run-card__header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .run-card__title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          direction: rtl;
        }

        .run-card__meta {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .run-card__meta-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--muted);
          direction: rtl;
        }

        .run-card__run-id {
          margin: 0;
          font-size: 10px;
          color: var(--muted);
          font-family: monospace;
          opacity: 0.6;
        }

        /* Domain pill */
        .domain-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          direction: rtl;
        }

        .domain-pill--coding {
          background: rgba(142, 202, 230, 0.12);
          color: #8ecae6;
          border: 1px solid rgba(142, 202, 230, 0.25);
        }
        .domain-pill--research {
          background: rgba(168, 130, 255, 0.12);
          color: #a882ff;
          border: 1px solid rgba(168, 130, 255, 0.25);
        }
        .domain-pill--content {
          background: rgba(255, 183, 3, 0.12);
          color: #ffb703;
          border: 1px solid rgba(255, 183, 3, 0.25);
        }
        .domain-pill--data {
          background: rgba(46, 213, 115, 0.1);
          color: #2ed573;
          border: 1px solid rgba(46, 213, 115, 0.2);
        }
        .domain-pill--operations {
          background: rgba(255, 165, 0, 0.1);
          color: #ffa500;
          border: 1px solid rgba(255, 165, 0, 0.2);
        }

        /* Action buttons */
        .run-card__actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 4px;
        }

        .run-card__btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          border: 1px solid transparent;
          transition: background 140ms ease, opacity 140ms ease;
          direction: rtl;
        }

        .run-card__btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .run-card__btn--view {
          background: rgba(142, 202, 230, 0.12);
          border-color: rgba(142, 202, 230, 0.3);
          color: #8ecae6;
        }
        .run-card__btn--view:hover {
          background: rgba(142, 202, 230, 0.2);
        }

        .run-card__btn--retry {
          background: rgba(255, 183, 3, 0.1);
          border-color: rgba(255, 183, 3, 0.3);
          color: #ffb703;
        }
        .run-card__btn--retry:hover:not(:disabled) {
          background: rgba(255, 183, 3, 0.18);
        }

        .run-card__btn--cancel {
          background: rgba(255, 71, 87, 0.08);
          border-color: rgba(255, 71, 87, 0.25);
          color: #ff4757;
        }
        .run-card__btn--cancel:hover:not(:disabled) {
          background: rgba(255, 71, 87, 0.15);
        }
      `}</style>
    </article>
  );
}

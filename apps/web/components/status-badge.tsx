/**
 * StatusBadge — Renders a colored pill badge for a RunStatus value.
 * Server-component safe (no "use client" needed — purely presentational).
 */

import type { RunStatus } from "@repo/types";

interface StatusBadgeProps {
  status: RunStatus;
  /** Optional extra CSS class names to merge onto the root element. */
  className?: string;
}

interface StatusConfig {
  label: string;
  labelAr: string;
  cssClass: string;
}

const STATUS_CONFIG: Record<RunStatus, StatusConfig> = {
  draft: {
    label: "Draft",
    labelAr: "مسودة",
    cssClass: "status-badge--draft",
  },
  running: {
    label: "Running",
    labelAr: "قيد التشغيل",
    cssClass: "status-badge--running",
  },
  waiting_approval: {
    label: "Awaiting Approval",
    labelAr: "بانتظار الموافقة",
    cssClass: "status-badge--waiting",
  },
  completed: {
    label: "Completed",
    labelAr: "مكتمل",
    cssClass: "status-badge--completed",
  },
  failed: {
    label: "Failed",
    labelAr: "فشل",
    cssClass: "status-badge--failed",
  },
  cancelled: {
    label: "Cancelled",
    labelAr: "ملغي",
    cssClass: "status-badge--cancelled",
  },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    labelAr: status,
    cssClass: "status-badge--draft",
  };

  const classes = ["status-badge", config.cssClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} role="status" aria-label={config.label}>
      <span className="status-badge__dot" aria-hidden="true" />
      <span className="status-badge__label-ar">{config.labelAr}</span>
      <span className="status-badge__label-en" aria-hidden="true">
        {config.label}
      </span>

      <style>{`
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 999px;
          border-width: 1px;
          border-style: solid;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.01em;
          white-space: nowrap;
          line-height: 1.4;
        }

        .status-badge__dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .status-badge__label-ar {
          direction: rtl;
        }

        .status-badge__label-en {
          font-size: 9px;
          opacity: 0.65;
          font-weight: 500;
        }

        /* ---- Draft ---- */
        .status-badge--draft {
          background: rgba(163, 183, 199, 0.1);
          border-color: rgba(163, 183, 199, 0.3);
          color: #a3b7c7;
        }
        .status-badge--draft .status-badge__dot {
          background: #a3b7c7;
        }

        /* ---- Running ---- */
        .status-badge--running {
          background: rgba(142, 202, 230, 0.12);
          border-color: rgba(142, 202, 230, 0.35);
          color: #8ecae6;
        }
        .status-badge--running .status-badge__dot {
          background: #8ecae6;
          animation: running-pulse 1.4s ease-in-out infinite;
        }

        /* ---- Waiting approval ---- */
        .status-badge--waiting {
          background: rgba(255, 183, 3, 0.12);
          border-color: rgba(255, 183, 3, 0.35);
          color: #ffb703;
        }
        .status-badge--waiting .status-badge__dot {
          background: #ffb703;
          animation: running-pulse 1.8s ease-in-out infinite;
        }

        /* ---- Completed ---- */
        .status-badge--completed {
          background: rgba(46, 213, 115, 0.1);
          border-color: rgba(46, 213, 115, 0.3);
          color: #2ed573;
        }
        .status-badge--completed .status-badge__dot {
          background: #2ed573;
        }

        /* ---- Failed ---- */
        .status-badge--failed {
          background: rgba(255, 71, 87, 0.1);
          border-color: rgba(255, 71, 87, 0.3);
          color: #ff4757;
        }
        .status-badge--failed .status-badge__dot {
          background: #ff4757;
        }

        /* ---- Cancelled ---- */
        .status-badge--cancelled {
          background: rgba(150, 150, 150, 0.1);
          border-color: rgba(150, 150, 150, 0.3);
          color: #969696;
        }
        .status-badge--cancelled .status-badge__dot {
          background: #969696;
        }

        @keyframes running-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </span>
  );
}

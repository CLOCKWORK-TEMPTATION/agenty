"use client";

/**
 * EventFeed — Displays a scrollable list of live agent run events.
 * Connects to the WebSocket via useRunEvents hook and auto-scrolls to the
 * latest event as they arrive.  Shows a connection status indicator.
 */

import { useEffect, useRef } from "react";
import { useRunEvents } from "../lib/use-run-events";
import type { RunEvent } from "../lib/use-run-events";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString("ar-SA", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return isoString;
  }
}

/** Map raw event strings to human-readable Arabic labels. */
function labelForEvent(event: string): { ar: string; en: string; kind: EventKind } {
  const lower = event.toLowerCase();

  if (lower.includes("node.intake")) return { ar: "استقبال المهمة", en: "Task Intake", kind: "node" };
  if (lower.includes("node.profile")) return { ar: "تحليل المتطلبات", en: "Profiling", kind: "node" };
  if (lower.includes("node.template_select")) return { ar: "اختيار القالب", en: "Template Select", kind: "node" };
  if (lower.includes("node.team_design")) return { ar: "تصميم الفريق", en: "Team Design", kind: "node" };
  if (lower.includes("node.model_route")) return { ar: "توجيه النماذج", en: "Model Routing", kind: "node" };
  if (lower.includes("node.tools_allocate")) return { ar: "تخصيص الأدوات", en: "Tool Allocation", kind: "node" };
  if (lower.includes("node.skills_load")) return { ar: "تحميل المهارات", en: "Skills Load", kind: "node" };
  if (lower.includes("node.approval_gate")) return { ar: "بوابة الموافقة", en: "Approval Gate", kind: "gate" };
  if (lower.includes("node.planner")) return { ar: "مرحلة التخطيط", en: "Planning", kind: "node" };
  if (lower.includes("node.specialists_parallel")) return { ar: "تنفيذ المتخصصين", en: "Specialists", kind: "node" };
  if (lower.includes("node.tool_executor")) return { ar: "تنفيذ الأداة", en: "Tool Executor", kind: "tool" };
  if (lower.includes("node.aggregate")) return { ar: "تجميع النتائج", en: "Aggregation", kind: "node" };
  if (lower.includes("node.verifier")) return { ar: "التحقق من الجودة", en: "Verification", kind: "node" };
  if (lower.includes("node.human_feedback")) return { ar: "انتظار الملاحظات", en: "Human Feedback", kind: "gate" };
  if (lower.includes("node.finalizer")) return { ar: "الإنهاء", en: "Finalizing", kind: "node" };
  if (lower.includes("tool.approve")) return { ar: "موافقة على الأداة", en: "Tool Approved", kind: "tool" };
  if (lower.includes("tool.reject")) return { ar: "رفض الأداة", en: "Tool Rejected", kind: "error" };
  if (lower.includes("error") || lower.includes("fail")) return { ar: "خطأ", en: "Error", kind: "error" };
  if (lower.includes("complete") || lower.includes("done")) return { ar: "اكتمل", en: "Completed", kind: "success" };
  if (lower.includes("start")) return { ar: "بدء", en: "Started", kind: "node" };

  return { ar: event, en: event, kind: "info" };
}

type EventKind = "node" | "tool" | "gate" | "error" | "success" | "info";

const KIND_CLASSES: Record<EventKind, string> = {
  node: "event-row--node",
  tool: "event-row--tool",
  gate: "event-row--gate",
  error: "event-row--error",
  success: "event-row--success",
  info: "event-row--info",
};

const KIND_ICONS: Record<EventKind, string> = {
  node: "⬡",
  tool: "⚙",
  gate: "◈",
  error: "✕",
  success: "✓",
  info: "·",
};

// ---------------------------------------------------------------------------
// EventRow sub-component
// ---------------------------------------------------------------------------

function EventRow({ event }: { event: RunEvent }) {
  const { ar, en, kind } = labelForEvent(event.event);
  const kindClass = KIND_CLASSES[kind];

  return (
    <li className={`event-row ${kindClass}`} role="listitem">
      <span className="event-row__icon" aria-hidden="true">
        {KIND_ICONS[kind]}
      </span>
      <div className="event-row__body">
        <span className="event-row__label-ar">{ar}</span>
        <span className="event-row__label-en">{en}</span>
      </div>
      <time className="event-row__time" dateTime={event.ts}>
        {formatTime(event.ts)}
      </time>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface EventFeedProps {
  runId: string;
  /** Maximum events to show (older ones are trimmed). Default: 200. */
  maxEvents?: number;
}

export function EventFeed({ runId, maxEvents = 200 }: EventFeedProps) {
  const { events, connected } = useRunEvents(runId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Track whether the user has manually scrolled up; if so, don't force-scroll.
  const autoScrollRef = useRef(true);

  const handleScroll = () => {
    const el = listRef.current?.parentElement;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  };

  // Auto-scroll to bottom whenever new events arrive, if the user hasn't scrolled up.
  useEffect(() => {
    if (autoScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [events.length]);

  const visibleEvents =
    events.length > maxEvents ? events.slice(events.length - maxEvents) : events;

  return (
    <section className="event-feed" aria-label="سجل أحداث التشغيل">
      {/* Header */}
      <div className="event-feed__header">
        <h2 className="event-feed__title">سجل الأحداث</h2>
        <div className="event-feed__status">
          <span
            className={`event-feed__dot ${connected ? "event-feed__dot--live" : "event-feed__dot--offline"}`}
            aria-hidden="true"
          />
          <span className="event-feed__status-text" role="status" aria-live="polite">
            {connected ? "متصل — مباشر" : "غير متصل"}
          </span>
          <span className="event-feed__count" aria-label={`${events.length} حدث`}>
            {events.length} حدث
          </span>
        </div>
      </div>

      {/* Scrollable event list */}
      <div className="event-feed__scroll" onScroll={handleScroll}>
        {visibleEvents.length === 0 ? (
          <div className="event-feed__empty" aria-live="polite">
            {connected
              ? "في انتظار الأحداث…"
              : "لا توجد أحداث — جارٍ محاولة الاتصال"}
          </div>
        ) : (
          <ul className="event-feed__list" ref={listRef} role="list">
            {events.length > maxEvents && (
              <li className="event-feed__overflow-note" aria-live="off">
                تم تجاوز الحد الأقصى — يُعرض آخر {maxEvents} حدث
              </li>
            )}
            {visibleEvents.map((ev, idx) => (
              <EventRow key={`${ev.ts}-${idx}`} event={ev} />
            ))}
          </ul>
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </div>

      <style>{`
        .event-feed {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--card-border);
          background: var(--card);
          border-radius: 16px;
          overflow: hidden;
          backdrop-filter: blur(4px);
        }

        /* Header */
        .event-feed__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          border-bottom: 1px solid var(--card-border);
          direction: rtl;
          flex-wrap: wrap;
          gap: 8px;
        }

        .event-feed__title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
        }

        .event-feed__status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--muted);
        }

        .event-feed__dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .event-feed__dot--live {
          background: #2ed573;
          animation: live-pulse 1.6s ease-in-out infinite;
        }

        .event-feed__dot--offline {
          background: #a3b7c7;
          opacity: 0.5;
        }

        .event-feed__status-text {
          direction: rtl;
        }

        .event-feed__count {
          padding: 1px 7px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          font-size: 11px;
        }

        /* Scrollable area */
        .event-feed__scroll {
          overflow-y: auto;
          max-height: 420px;
          min-height: 120px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.12) transparent;
        }

        .event-feed__scroll::-webkit-scrollbar {
          width: 4px;
        }
        .event-feed__scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
        }

        /* Empty state */
        .event-feed__empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--muted);
          font-size: 13px;
          direction: rtl;
          opacity: 0.7;
        }

        /* Overflow note */
        .event-feed__overflow-note {
          padding: 6px 18px;
          text-align: center;
          font-size: 11px;
          color: var(--muted);
          background: rgba(255, 183, 3, 0.06);
          border-bottom: 1px solid rgba(255, 183, 3, 0.12);
          direction: rtl;
          list-style: none;
        }

        /* Event list */
        .event-feed__list {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        /* Event row */
        .event-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 9px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          transition: background 100ms ease;
          direction: rtl;
        }

        .event-row:last-child {
          border-bottom: none;
        }

        .event-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        .event-row__icon {
          flex-shrink: 0;
          width: 18px;
          font-size: 13px;
          line-height: 1.4;
          text-align: center;
        }

        .event-row__body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .event-row__label-ar {
          font-size: 13px;
          color: var(--text);
          font-weight: 500;
          line-height: 1.3;
          direction: rtl;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .event-row__label-en {
          font-size: 10px;
          color: var(--muted);
          opacity: 0.6;
          direction: ltr;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .event-row__time {
          flex-shrink: 0;
          font-size: 10px;
          color: var(--muted);
          opacity: 0.55;
          font-variant-numeric: tabular-nums;
          direction: ltr;
          padding-top: 2px;
        }

        /* Kind color overrides */
        .event-row--node .event-row__icon { color: var(--accent-2); }
        .event-row--tool .event-row__icon { color: #a882ff; }
        .event-row--gate .event-row__icon { color: var(--accent); }
        .event-row--error .event-row__icon { color: #ff4757; }
        .event-row--error .event-row__label-ar { color: #ff4757; }
        .event-row--success .event-row__icon { color: #2ed573; }
        .event-row--success .event-row__label-ar { color: #2ed573; }
        .event-row--info .event-row__icon { color: var(--muted); }

        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </section>
  );
}

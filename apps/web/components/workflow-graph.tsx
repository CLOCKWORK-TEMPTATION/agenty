"use client";

/**
 * WorkflowGraph — Pure-CSS visualisation of the fixed LangGraph execution flow.
 *
 * Node order:
 *   START → intake → profile → template_select → team_design → model_route
 *         → tools_allocate → skills_load → approval_gate → planner
 *         → specialists_parallel → tool_executor → aggregate → verifier
 *         → human_feedback → finalizer → END
 *
 * Completed nodes are green, the current (active) node is blue with a pulse
 * animation, and future nodes are gray.  The current node is inferred from
 * the events[] array by finding the last "node.<name>.completed" or
 * "node.<name>.started" string.
 */

import type { RunStatus } from "@repo/types";

// ---------------------------------------------------------------------------
// Graph node definitions
// ---------------------------------------------------------------------------

interface GraphNode {
  /** Internal key that matches event strings, e.g. "intake". */
  id: string;
  /** Arabic display label. */
  labelAr: string;
  /** English technical name shown below the Arabic label. */
  labelEn: string;
  /** Visual style variant. */
  kind: "start_end" | "process" | "gate" | "parallel";
}

const GRAPH_NODES: GraphNode[] = [
  { id: "START", labelAr: "بداية", labelEn: "START", kind: "start_end" },
  { id: "intake", labelAr: "استقبال المهمة", labelEn: "intake", kind: "process" },
  { id: "profile", labelAr: "تحليل المتطلبات", labelEn: "profile", kind: "process" },
  { id: "template_select", labelAr: "اختيار القالب", labelEn: "template_select", kind: "process" },
  { id: "team_design", labelAr: "تصميم الفريق", labelEn: "team_design", kind: "process" },
  { id: "model_route", labelAr: "توجيه النماذج", labelEn: "model_route", kind: "process" },
  { id: "tools_allocate", labelAr: "تخصيص الأدوات", labelEn: "tools_allocate", kind: "process" },
  { id: "skills_load", labelAr: "تحميل المهارات", labelEn: "skills_load", kind: "process" },
  { id: "approval_gate", labelAr: "بوابة الموافقة", labelEn: "approval_gate", kind: "gate" },
  { id: "planner", labelAr: "مرحلة التخطيط", labelEn: "planner", kind: "process" },
  { id: "specialists_parallel", labelAr: "تنفيذ متوازٍ", labelEn: "specialists_parallel", kind: "parallel" },
  { id: "tool_executor", labelAr: "تنفيذ الأداة", labelEn: "tool_executor", kind: "process" },
  { id: "aggregate", labelAr: "تجميع النتائج", labelEn: "aggregate", kind: "process" },
  { id: "verifier", labelAr: "التحقق من الجودة", labelEn: "verifier", kind: "process" },
  { id: "human_feedback", labelAr: "ملاحظات بشرية", labelEn: "human_feedback", kind: "gate" },
  { id: "finalizer", labelAr: "الإنهاء والتسليم", labelEn: "finalizer", kind: "process" },
  { id: "END", labelAr: "نهاية", labelEn: "END", kind: "start_end" },
];

// ---------------------------------------------------------------------------
// Event → current node mapping
// ---------------------------------------------------------------------------

/**
 * Parses the events[] array and returns the id of the last active node.
 * Events are expected in the form "node.<name>.started" or "node.<name>.completed".
 */
function resolveCurrentNode(events: string[]): string | null {
  let lastNode: string | null = null;

  for (const ev of events) {
    const lower = ev.toLowerCase();
    for (const node of GRAPH_NODES) {
      if (node.id === "START" || node.id === "END") continue;
      if (
        lower.includes(`node.${node.id}.started`) ||
        lower.includes(`node.${node.id}.`)
      ) {
        lastNode = node.id;
      }
    }
  }
  return lastNode;
}

/**
 * Determines which nodes are completed based on events.
 * A node is completed when "node.<name>.completed" appears in events.
 */
function resolveCompletedNodes(events: string[]): Set<string> {
  const completed = new Set<string>();
  for (const ev of events) {
    const lower = ev.toLowerCase();
    for (const node of GRAPH_NODES) {
      if (node.id === "START" || node.id === "END") continue;
      if (lower.includes(`node.${node.id}.completed`)) {
        completed.add(node.id);
      }
    }
  }
  return completed;
}

// ---------------------------------------------------------------------------
// NodeState type + derivation
// ---------------------------------------------------------------------------

type NodeState = "completed" | "active" | "future" | "start_end";

interface ResolvedNode extends GraphNode {
  state: NodeState;
}

function buildResolvedNodes(
  events: string[],
  runStatus: RunStatus
): ResolvedNode[] {
  const currentNode = resolveCurrentNode(events);
  const completedSet = resolveCompletedNodes(events);

  const allDone = runStatus === "completed";
  const failed = runStatus === "failed";

  return GRAPH_NODES.map((node, idx) => {
    if (node.kind === "start_end") {
      return { ...node, state: "start_end" as NodeState };
    }

    if (completedSet.has(node.id) || allDone) {
      return { ...node, state: "completed" as NodeState };
    }

    if (node.id === currentNode && !failed) {
      return { ...node, state: "active" as NodeState };
    }

    // If no current node has been determined yet, the first process node is active for running status
    if (currentNode === null && runStatus === "running" && idx === 1) {
      return { ...node, state: "active" as NodeState };
    }

    return { ...node, state: "future" as NodeState };
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface NodeBoxProps {
  node: ResolvedNode;
  isLast: boolean;
}

function NodeBox({ node, isLast }: NodeBoxProps) {
  const stateClass = `wf-node--${node.state}`;
  const kindClass = `wf-node--${node.kind}`;

  return (
    <li className="wf-step">
      <div
        className={`wf-node ${stateClass} ${kindClass}`}
        role="listitem"
        aria-label={`${node.labelAr} — ${node.state === "completed" ? "مكتمل" : node.state === "active" ? "نشط" : "قادم"}`}
      >
        {/* State indicator */}
        <span className="wf-node__indicator" aria-hidden="true">
          {node.state === "completed" && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6.5L5 9.5L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {node.state === "active" && (
            <span className="wf-node__pulse-dot" />
          )}
          {node.state === "future" && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
          {node.state === "start_end" && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" fill="currentColor" opacity="0.6" />
            </svg>
          )}
        </span>

        {/* Labels */}
        <div className="wf-node__labels">
          <span className="wf-node__label-ar">{node.labelAr}</span>
          <span className="wf-node__label-en">{node.labelEn}</span>
        </div>

        {/* Kind badge for special nodes */}
        {node.kind === "gate" && (
          <span className="wf-node__kind-badge wf-node__kind-badge--gate">بوابة</span>
        )}
        {node.kind === "parallel" && (
          <span className="wf-node__kind-badge wf-node__kind-badge--parallel">متوازٍ</span>
        )}
      </div>

      {/* Connector arrow (not shown after last node) */}
      {!isLast && (
        <div className="wf-connector" aria-hidden="true">
          <div className="wf-connector__line" />
          <div className="wf-connector__arrow" />
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend() {
  return (
    <div className="wf-legend" aria-label="مفتاح الرسم البياني">
      <span className="wf-legend__item">
        <span className="wf-legend__swatch wf-legend__swatch--completed" aria-hidden="true" />
        مكتمل
      </span>
      <span className="wf-legend__item">
        <span className="wf-legend__swatch wf-legend__swatch--active" aria-hidden="true" />
        نشط
      </span>
      <span className="wf-legend__item">
        <span className="wf-legend__swatch wf-legend__swatch--future" aria-hidden="true" />
        قادم
      </span>
      <span className="wf-legend__item">
        <span className="wf-legend__swatch wf-legend__swatch--gate" aria-hidden="true" />
        بوابة
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface WorkflowGraphProps {
  /** Raw event strings from RunState.events. */
  events: string[];
  /** Current run status. */
  status: RunStatus;
}

export function WorkflowGraph({ events, status }: WorkflowGraphProps) {
  const nodes = buildResolvedNodes(events, status);

  // Count stats for the header summary
  const completedCount = nodes.filter((n) => n.state === "completed").length;
  const totalProcess = GRAPH_NODES.filter(
    (n) => n.kind !== "start_end"
  ).length;

  return (
    <section className="wf-graph" aria-label="رسم سير عمل LangGraph">
      {/* Header */}
      <div className="wf-graph__header">
        <div className="wf-graph__title-group">
          <h2 className="wf-graph__title">مسار التنفيذ</h2>
          <span className="wf-graph__subtitle">LangGraph Execution Flow</span>
        </div>
        <div className="wf-graph__progress-group">
          <div
            className="wf-graph__progress-bar"
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={totalProcess}
            aria-label={`${completedCount} من ${totalProcess} خطوة مكتملة`}
          >
            <div
              className="wf-graph__progress-fill"
              style={{ width: `${(completedCount / totalProcess) * 100}%` }}
            />
          </div>
          <span className="wf-graph__progress-label">
            {completedCount}/{totalProcess}
          </span>
        </div>
      </div>

      <Legend />

      {/* Node list */}
      <ol className="wf-graph__nodes" aria-label="خطوات التنفيذ">
        {nodes.map((node, idx) => (
          <NodeBox key={node.id} node={node} isLast={idx === nodes.length - 1} />
        ))}
      </ol>

      <style>{`
        /* ---- Container ---- */
        .wf-graph {
          border: 1px solid var(--card-border);
          background: var(--card);
          border-radius: 16px;
          padding: 20px;
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ---- Header ---- */
        .wf-graph__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          direction: rtl;
        }

        .wf-graph__title-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .wf-graph__title {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
        }

        .wf-graph__subtitle {
          font-size: 10px;
          color: var(--muted);
          opacity: 0.7;
          font-family: monospace;
        }

        .wf-graph__progress-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .wf-graph__progress-bar {
          width: 100px;
          height: 5px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
        }

        .wf-graph__progress-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--accent-2), var(--accent));
          transition: width 400ms ease;
        }

        .wf-graph__progress-label {
          font-size: 11px;
          color: var(--muted);
          font-variant-numeric: tabular-nums;
        }

        /* ---- Legend ---- */
        .wf-legend {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          direction: rtl;
        }

        .wf-legend__item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--muted);
        }

        .wf-legend__swatch {
          width: 10px;
          height: 10px;
          border-radius: 3px;
          flex-shrink: 0;
        }

        .wf-legend__swatch--completed { background: #2ed573; }
        .wf-legend__swatch--active { background: var(--accent-2); }
        .wf-legend__swatch--future { background: rgba(163, 183, 199, 0.25); border: 1px solid rgba(163, 183, 199, 0.4); }
        .wf-legend__swatch--gate { background: rgba(255, 183, 3, 0.3); border: 1px solid rgba(255, 183, 3, 0.5); }

        /* ---- Node list ---- */
        .wf-graph__nodes {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }

        /* ---- Step (node + connector) ---- */
        .wf-step {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* ---- Node box ---- */
        .wf-node {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px;
          border-radius: 10px;
          border: 1px solid transparent;
          transition: border-color 200ms ease, background 200ms ease, box-shadow 200ms ease;
          direction: rtl;
        }

        /* State variants */
        .wf-node--completed {
          background: rgba(46, 213, 115, 0.07);
          border-color: rgba(46, 213, 115, 0.2);
          color: #2ed573;
        }
        .wf-node--completed .wf-node__label-ar { color: #2ed573; }

        .wf-node--active {
          background: rgba(142, 202, 230, 0.10);
          border-color: rgba(142, 202, 230, 0.40);
          color: var(--accent-2);
          box-shadow: 0 0 0 3px rgba(142, 202, 230, 0.12), 0 0 16px rgba(142, 202, 230, 0.12);
        }
        .wf-node--active .wf-node__label-ar { color: var(--accent-2); }

        .wf-node--future {
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.06);
          color: var(--muted);
          opacity: 0.55;
        }

        .wf-node--start_end {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.08);
          color: var(--muted);
          justify-content: center;
          border-radius: 999px;
          padding: 5px 20px;
        }
        .wf-node--start_end .wf-node__label-ar {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .wf-node--start_end .wf-node__label-en { display: none; }

        /* Kind variants */
        .wf-node--gate.wf-node--future,
        .wf-node--gate.wf-node--active {
          border-style: dashed;
        }
        .wf-node--gate.wf-node--active {
          border-color: rgba(255, 183, 3, 0.5);
          background: rgba(255, 183, 3, 0.07);
          color: var(--accent);
        }
        .wf-node--gate.wf-node--active .wf-node__label-ar { color: var(--accent); }

        .wf-node--parallel.wf-node--active {
          border-style: dashed;
        }

        /* ---- Indicator ---- */
        .wf-node__indicator {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .wf-node__pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          animation: node-pulse 1.2s ease-in-out infinite;
        }

        @keyframes node-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.7); }
        }

        /* ---- Labels ---- */
        .wf-node__labels {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .wf-node__label-ar {
          font-size: 12px;
          font-weight: 600;
          line-height: 1.3;
          color: var(--text);
          direction: rtl;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .wf-node__label-en {
          font-size: 9px;
          opacity: 0.55;
          font-family: monospace;
          direction: ltr;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* ---- Kind badge ---- */
        .wf-node__kind-badge {
          flex-shrink: 0;
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          letter-spacing: 0.03em;
        }

        .wf-node__kind-badge--gate {
          background: rgba(255, 183, 3, 0.15);
          color: var(--accent);
          border: 1px solid rgba(255, 183, 3, 0.25);
        }

        .wf-node__kind-badge--parallel {
          background: rgba(168, 130, 255, 0.12);
          color: #a882ff;
          border: 1px solid rgba(168, 130, 255, 0.22);
        }

        /* ---- Connector ---- */
        .wf-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
          padding: 0;
          height: 20px;
        }

        .wf-connector__line {
          width: 1px;
          flex: 1;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.15),
            rgba(255, 255, 255, 0.06)
          );
        }

        .wf-connector__arrow {
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-top: 5px solid rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </section>
  );
}

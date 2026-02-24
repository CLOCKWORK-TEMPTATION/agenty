'use client';

import { useState } from 'react';

interface StateInspectorProps {
  state: Record<string, unknown>;
}

export function StateInspector({ state }: StateInspectorProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleKey = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!state || Object.keys(state).length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-title">لا توجد حالة متاحة</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(state).map(([key, value]) => (
        <div
          key={key}
          className="border border-card-border bg-card/30 rounded-lg overflow-hidden"
        >
          <button
            onClick={() => toggleKey(key)}
            className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-card/50 transition-colors"
          >
            <span className="font-mono text-sm text-accent-2">{key}</span>
            <span className="text-muted">{expanded[key] ? '▼' : '▶'}</span>
          </button>
          {expanded[key] && (
            <div className="px-4 py-3 border-t border-card-border bg-black/20">
              <pre className="text-xs text-muted overflow-x-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

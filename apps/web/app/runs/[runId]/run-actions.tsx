"use client";

import { useState } from "react";
import type { RunStatus } from "@repo/types";
import { resumeRun, cancelRun, retryRun } from "@/lib/api";

interface RunActionsProps {
  runId: string;
  status: RunStatus;
}

type ActionKey = "resume" | "retry" | "cancel";

export function RunActions({ runId, status }: RunActionsProps) {
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const execute = async (action: ActionKey) => {
    setPending(action);
    setError(null);

    try {
      let result;
      if (action === "resume") {
        result = await resumeRun(runId);
      } else if (action === "retry") {
        result = await retryRun(runId);
      } else {
        result = await cancelRun(runId);
      }

      if (result.ok) {
        window.location.reload();
      } else {
        setError(result.message);
      }
    } catch {
      setError("حدث خطأ في الاتصال بالخادم.");
    } finally {
      setPending(null);
    }
  };

  const showResume = status === "waiting_approval";
  const showRetry = status === "failed";
  const showCancel = status === "running" || status === "waiting_approval";

  if (!showResume && !showRetry && !showCancel) {
    return null;
  }

  return (
    <div className="run-actions-bar">
      {error && (
        <span className="small" style={{ color: "var(--error)" }}>
          {error}
        </span>
      )}

      {showResume && (
        <button
          className="btn btn-primary"
          disabled={pending !== null}
          onClick={() => void execute("resume")}
        >
          {pending === "resume" && (
            <span className="loading-spinner loading-spinner-sm" aria-hidden="true" />
          )}
          متابعة التنفيذ
        </button>
      )}

      {showRetry && (
        <button
          className="btn btn-info"
          disabled={pending !== null}
          onClick={() => void execute("retry")}
        >
          {pending === "retry" && (
            <span className="loading-spinner loading-spinner-sm" aria-hidden="true" />
          )}
          إعادة المحاولة
        </button>
      )}

      {showCancel && (
        <button
          className="btn btn-danger"
          disabled={pending !== null}
          onClick={() => void execute("cancel")}
        >
          {pending === "cancel" && (
            <span className="loading-spinner loading-spinner-sm" aria-hidden="true" />
          )}
          إلغاء التشغيل
        </button>
      )}
    </div>
  );
}

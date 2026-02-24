"use client";

import { useState } from "react";
import { testMcpServer } from "@/lib/api";

interface McpTestButtonProps {
  serverId: string;
}

type TestState = "idle" | "loading" | "ok" | "error";

export function McpTestButton({ serverId }: McpTestButtonProps) {
  const [state, setState] = useState<TestState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const handleTest = async () => {
    setState("loading");
    setMessage(null);

    try {
      const result = await testMcpServer(serverId);
      if (result.ok) {
        setState("ok");
        setMessage(result.data.reachable ? "الاتصال ناجح" : "الخادم غير قابل للوصول");
      } else {
        setState("error");
        setMessage(result.message ?? "فشل الاتصال");
      }
    } catch {
      setState("error");
      setMessage("خطأ في الشبكة");
    }

    // Reset after 4 seconds
    setTimeout(() => {
      setState("idle");
      setMessage(null);
    }, 4000);
  };

  const labelMap: Record<TestState, string> = {
    idle: "اختبار الاتصال",
    loading: "جارٍ الاختبار...",
    ok: "ناجح ✓",
    error: "فشل ✗"
  };

  const styleMap: Record<TestState, React.CSSProperties> = {
    idle: {},
    loading: { opacity: 0.7 },
    ok: {
      background: "rgba(34,197,94,0.15)",
      color: "var(--success)",
      borderColor: "rgba(34,197,94,0.3)"
    },
    error: {
      background: "rgba(239,68,68,0.15)",
      color: "var(--error)",
      borderColor: "rgba(239,68,68,0.3)"
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        className="btn btn-ghost btn-sm"
        style={styleMap[state]}
        disabled={state === "loading"}
        onClick={() => void handleTest()}
      >
        {state === "loading" && (
          <span className="loading-spinner loading-spinner-sm" aria-hidden="true" />
        )}
        {labelMap[state]}
      </button>
      {message && state !== "loading" && (
        <span
          className="small"
          style={{
            color: state === "ok" ? "var(--success)" : "var(--error)",
            fontSize: 12
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}

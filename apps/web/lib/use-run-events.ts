"use client";

/**
 * useRunEvents — React hook that connects to the run WebSocket endpoint and
 * delivers live events as they arrive.  Automatically reconnects with
 * exponential back-off on unintended disconnects and cleans up the socket on
 * unmount or when runId changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface RunEvent {
  /** Event type string, e.g. "node.intake.completed", "tool.approved". */
  event: string;
  /** ISO-8601 timestamp string. */
  ts: string;
  /** Optional free-form payload attached to the event. */
  payload?: Record<string, unknown>;
}

interface UseRunEventsResult {
  events: RunEvent[];
  connected: boolean;
  /** Clears the local event buffer. */
  clearEvents: () => void;
}

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_MULTIPLIER = 2;

function buildWsUrl(runId: string): string {
  if (typeof window === "undefined") return "";

  // Honour explicit WS override (rare in dev tunnels / reverse proxies).
  const explicit = process.env.NEXT_PUBLIC_API_URL;
  if (explicit) {
    const base = explicit.replace(/^http/, "ws").replace(/\/$/, "");
    return `${base}/api/v1/runs/${runId}/ws`;
  }

  // Default: same host, same scheme as the page (ws:// or wss://).
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/v1/runs/${runId}/ws`;
}

function parseMessage(raw: string): RunEvent | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "event" in parsed &&
      typeof (parsed as Record<string, unknown>).event === "string"
    ) {
      const obj = parsed as Record<string, unknown>;
      return {
        event: obj.event as string,
        ts: typeof obj.ts === "string" ? obj.ts : new Date().toISOString(),
        payload:
          obj.payload !== undefined &&
          obj.payload !== null &&
          typeof obj.payload === "object"
            ? (obj.payload as Record<string, unknown>)
            : undefined,
      };
    }
    // Plain string event (non-JSON envelope)
    return { event: raw, ts: new Date().toISOString() };
  } catch {
    // Server sent a plain string event
    return { event: raw, ts: new Date().toISOString() };
  }
}

export function useRunEvents(runId: string | null): UseRunEventsResult {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [connected, setConnected] = useState(false);

  // Mutable refs so callbacks inside the effect do not stale-close over state.
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_BASE_MS);
  const unmountedRef = useRef(false);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const connect = useCallback(
    (id: string) => {
      if (unmountedRef.current) return;

      const url = buildWsUrl(id);
      if (!url) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) {
          ws.close();
          return;
        }
        setConnected(true);
        reconnectDelayRef.current = RECONNECT_BASE_MS;
      };

      ws.onmessage = (ev: MessageEvent<string>) => {
        if (unmountedRef.current) return;
        const parsed = parseMessage(ev.data);
        if (parsed) {
          setEvents((prev) => [...prev, parsed]);
        }
      };

      ws.onerror = () => {
        // onerror is always followed by onclose — let onclose drive reconnect.
      };

      ws.onclose = (ev: CloseEvent) => {
        if (unmountedRef.current) return;
        setConnected(false);

        // 1000 = normal closure (run finished or component unmounted intentionally).
        // 1001 = going away. Both are considered terminal — do not reconnect.
        if (ev.code === 1000 || ev.code === 1001) return;

        // Schedule reconnect with exponential back-off.
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(
          delay * RECONNECT_MULTIPLIER,
          RECONNECT_MAX_MS
        );
        reconnectTimerRef.current = setTimeout(() => {
          if (!unmountedRef.current) {
            connect(id);
          }
        }, delay);
      };
    },
    []
  );

  useEffect(() => {
    unmountedRef.current = false;

    if (!runId) {
      setConnected(false);
      return;
    }

    // Reset event list and reconnect state when runId changes.
    setEvents([]);
    reconnectDelayRef.current = RECONNECT_BASE_MS;

    connect(runId);

    return () => {
      unmountedRef.current = true;

      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        // Normal close — onclose will see code 1000 and skip reconnect.
        wsRef.current.close(1000, "component unmounted");
        wsRef.current = null;
      }

      setConnected(false);
    };
  }, [runId, connect]);

  return { events, connected, clearEvents };
}

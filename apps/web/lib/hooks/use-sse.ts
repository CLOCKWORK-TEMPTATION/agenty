'use client';

import { useEffect, useRef, useState } from 'react';
import { getAPIBaseURL } from '../api/client';

export interface SSEMessage<T = unknown> {
  type: string;
  data: T;
  timestamp: string;
}

export function useSSE<T = unknown>(
  endpoint: string,
  enabled: boolean = true
): {
  messages: SSEMessage<T>[];
  error: Error | null;
  connected: boolean;
} {
  const [messages, setMessages] = useState<SSEMessage<T>[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const url = `${getAPIBaseURL()}${endpoint}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage<T> = JSON.parse(event.data);
        setMessages((prev) => [...prev, message]);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      setError(new Error('SSE connection error'));
      eventSource.close();
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [endpoint, enabled]);

  return { messages, error, connected };
}

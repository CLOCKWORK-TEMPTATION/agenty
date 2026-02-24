import pino from "pino";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LangSmithRunData {
  /** UUID that uniquely identifies this run. */
  runId: string;
  /** Human-readable run name (e.g. graph node name). */
  name: string;
  /** LangSmith run type. */
  runType: "chain" | "llm" | "tool" | "retriever" | "embedding";
  /** Serialisable input payload sent to the component. */
  inputs: Record<string, unknown>;
  /** Serialisable output produced by the component. */
  outputs?: Record<string, unknown>;
  /** Terminal status of the run. */
  status: "success" | "error";
  /** ISO-8601 timestamp when the run started. */
  startTime: string;
  /** ISO-8601 timestamp when the run ended. */
  endTime?: string;
  /** UUID of the parent run (for nested traces). */
  parentRunId?: string;
  /** Arbitrary string tags attached to the run. */
  tags?: string[];
}

export interface LangSmithSpanData {
  /** UUID that uniquely identifies this span. */
  spanId: string;
  /** Human-readable span name. */
  name: string;
  /** Serialisable input payload. */
  inputs: Record<string, unknown>;
  /** Serialisable output produced. */
  outputs?: Record<string, unknown>;
  /** ISO-8601 timestamp when the span started. */
  startTime: string;
  /** ISO-8601 timestamp when the span ended. */
  endTime?: string;
  /** UUID of the parent span (for nested traces). */
  parentSpanId?: string;
  /** Arbitrary key/value metadata. */
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const LANGSMITH_API_BASE = "https://api.smith.langchain.com";

const _log = pino({
  name: "langsmith-reporter",
  level: process.env["NODE_ENV"] === "production" ? "info" : "debug"
});

// ---------------------------------------------------------------------------
// LangSmithReporter
// ---------------------------------------------------------------------------

/**
 * Lightweight reporter that forwards run / span data to the LangSmith API.
 *
 * Designed to be fault-tolerant: network or API errors are logged as warnings
 * and never propagated to the caller.  When no API key is configured the
 * reporter silently discards all calls (`isEnabled()` returns `false`).
 */
export class LangSmithReporter {
  private readonly apiKey: string | undefined;
  private readonly project: string;

  public constructor(apiKey?: string, project?: string) {
    this.apiKey = apiKey ?? process.env["LANGSMITH_API_KEY"];
    this.project =
      project ?? process.env["LANGSMITH_PROJECT"] ?? "default";
  }

  /** Returns `true` when a LangSmith API key is available. */
  public isEnabled(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.length > 0;
  }

  /**
   * Report a completed (or failed) run to LangSmith.
   * Silently drops the call when the reporter is disabled.
   */
  public async reportRun(data: LangSmithRunData): Promise<void> {
    if (!this.isEnabled()) return;

    const body: Record<string, unknown> = {
      id: data.runId,
      name: data.name,
      run_type: data.runType,
      inputs: data.inputs,
      start_time: data.startTime,
      session_name: this.project,
      status: data.status
    };

    if (data.outputs !== undefined) body["outputs"] = data.outputs;
    if (data.endTime !== undefined) body["end_time"] = data.endTime;
    if (data.parentRunId !== undefined)
      body["parent_run_id"] = data.parentRunId;
    if (data.tags !== undefined && data.tags.length > 0)
      body["tags"] = data.tags;

    await this._post("/api/v1/runs", body);
  }

  /**
   * Report a span as a LangSmith run of type `"chain"`.
   * Silently drops the call when the reporter is disabled.
   */
  public async reportSpan(data: LangSmithSpanData): Promise<void> {
    if (!this.isEnabled()) return;

    const body: Record<string, unknown> = {
      id: data.spanId,
      name: data.name,
      run_type: "chain",
      inputs: data.inputs,
      start_time: data.startTime,
      session_name: this.project
    };

    if (data.outputs !== undefined) body["outputs"] = data.outputs;
    if (data.endTime !== undefined) body["end_time"] = data.endTime;
    if (data.parentSpanId !== undefined)
      body["parent_run_id"] = data.parentSpanId;
    if (data.metadata !== undefined) body["extra"] = { metadata: data.metadata };

    await this._post("/api/v1/runs", body);
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private async _post(
    path: string,
    body: Record<string, unknown>
  ): Promise<void> {
    try {
      const response = await fetch(`${LANGSMITH_API_BASE}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey ?? ""
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "<unreadable>");
        _log.warn(
          { status: response.status, body: text },
          "LangSmith API returned non-2xx response"
        );
      }
    } catch (err) {
      _log.warn(
        { err },
        "LangSmith API request failed — trace data not sent"
      );
    }
  }
}

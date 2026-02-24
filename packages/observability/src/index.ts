import pino from "pino";
import type { AuditEvent } from "@repo/types";
import { getTracer, withSpan } from "./otel.js";
import { LangSmithReporter } from "./langsmith.js";
import type { Tracer as OtelTracer } from "@opentelemetry/api";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

export const createLogger = (name: string) => {
  return pino({
    name,
    level: process.env["NODE_ENV"] === "production" ? "info" : "debug",
    redact: {
      paths: ["req.headers.authorization", "*.token", "*.apiKey"],
      censor: "[REDACTED]"
    }
  });
};

// ---------------------------------------------------------------------------
// Legacy Tracer interface (kept for backwards compatibility)
// ---------------------------------------------------------------------------

export interface Tracer {
  startSpan: (name: string, attributes?: Record<string, unknown>) => { end: () => void };
}

// ---------------------------------------------------------------------------
// createTracer — returns an OTel-backed tracer wrapper
// ---------------------------------------------------------------------------

/**
 * Create a `Tracer` using the underlying OpenTelemetry tracer.
 *
 * The returned object satisfies the existing `Tracer` interface so that all
 * existing call-sites continue to compile and work without modification.
 *
 * @param name - Instrumentation library / scope name passed to OTel.
 */
export const createTracer = (name = "default"): Tracer => {
  const otelTracer = getTracer(name);

  return {
    startSpan: (spanName: string, attributes?: Record<string, unknown>) => {
      // Convert unknown-valued attributes to string-valued ones (OTel
      // AttributeValue supports strings, numbers, booleans and arrays but our
      // legacy interface only guarantees `unknown`).
      const safeAttrs: Record<string, string> = {};
      if (attributes) {
        for (const [k, v] of Object.entries(attributes)) {
          safeAttrs[k] = String(v);
        }
      }
      const span = otelTracer.startSpan(spanName, { attributes: safeAttrs });
      return {
        end: () => span.end()
      };
    }
  };
};

// ---------------------------------------------------------------------------
// createGraphNodeTracer — LangGraph node / tool tracing helpers
// ---------------------------------------------------------------------------

interface GraphNodeTracer {
  /**
   * Wrap a LangGraph node execution in an OTel span and, if LangSmith is
   * configured, report the run to the LangSmith API.
   */
  traceNode: <T>(nodeName: string, fn: () => Promise<T>) => Promise<T>;
  /**
   * Wrap a tool call in an OTel span and report it to LangSmith.
   */
  traceToolCall: <T>(toolName: string, fn: () => Promise<T>) => Promise<T>;
}

/**
 * Build tracing helpers scoped to a single LangGraph run.
 *
 * Usage:
 * ```ts
 * const { traceNode, traceToolCall } = createGraphNodeTracer(runId);
 * const result = await traceNode("planner", async () => runPlanner(state));
 * ```
 */
export const createGraphNodeTracer = (runId: string): GraphNodeTracer => {
  const otelTracer: OtelTracer = getTracer("langgraph");
  const reporter = new LangSmithReporter();

  const trace = async <T>(
    spanName: string,
    runType: "chain" | "tool",
    fn: () => Promise<T>
  ): Promise<T> => {
    const startTime = new Date().toISOString();
    let status: "success" | "error" = "success";
    let outputs: Record<string, unknown> | undefined;

    const result = await withSpan(otelTracer, spanName, async (span) => {
      span.setAttribute("run_id", runId);
      span.setAttribute("run_type", runType);

      try {
        const value = await fn();
        outputs =
          value !== undefined && value !== null
            ? { result: value as unknown }
            : undefined;
        return value;
      } catch (err) {
        status = "error";
        throw err;
      }
    });

    if (reporter.isEnabled()) {
      const endTime = new Date().toISOString();
      // Build the run data object without undefined optional properties to
      // satisfy exactOptionalPropertyTypes.
      const runData = {
        runId: `${runId}:${spanName}:${startTime}`,
        name: spanName,
        runType: (runType === "tool" ? "tool" : "chain") as "tool" | "chain",
        inputs: { run_id: runId },
        status,
        startTime,
        endTime,
        parentRunId: runId,
        tags: [runType] as string[]
      };
      await reporter
        .reportRun(
          outputs !== undefined
            ? { ...runData, outputs }
            : runData
        )
        .catch(() => {
          // Intentionally swallowed — LangSmith errors must not affect the run
        });
    }

    return result;
  };

  return {
    traceNode: <T>(nodeName: string, fn: () => Promise<T>): Promise<T> =>
      trace(nodeName, "chain", fn),

    traceToolCall: <T>(toolName: string, fn: () => Promise<T>): Promise<T> =>
      trace(toolName, "tool", fn)
  };
};

// ---------------------------------------------------------------------------
// AuditTrail
// ---------------------------------------------------------------------------

export class AuditTrail {
  private readonly events: AuditEvent[] = [];

  public append(event: AuditEvent): void {
    this.events.push(event);
  }

  public list(): AuditEvent[] {
    return [...this.events];
  }
}

// ---------------------------------------------------------------------------
// Re-exports from sub-modules
// ---------------------------------------------------------------------------

export {
  initOtel,
  shutdownOtel,
  getTracer,
  startSpan,
  endSpan,
  withSpan
} from "./otel.js";

export type { Span } from "@opentelemetry/api";

export {
  LangSmithReporter
} from "./langsmith.js";

export type { LangSmithRunData, LangSmithSpanData } from "./langsmith.js";

// ---------------------------------------------------------------------------
// Advanced Monitoring Exports
// ---------------------------------------------------------------------------

export { openTelemetry } from './opentelemetry.js';
export type { OpenTelemetryConfig } from './opentelemetry.js';

export { metricsCollector } from './metrics.js';
export type { MetricsConfig } from './metrics.js';

export { auditLogger } from './audit-logger.js';
export type {
  AuditLogEntry,
  AuditEventType,
  AuditLoggerConfig,
  AuditLogFilter,
  AuditLogShipper,
  AuditLogStorage
} from './audit-logger.js';

export { alertManager, defaultAlertRules } from './alerts.js';
export type {
  AlertRule,
  AlertCondition,
  AlertChannel,
  Alert,
  EmailChannelConfig,
  SlackChannelConfig,
  PagerDutyChannelConfig,
  WebhookChannelConfig
} from './alerts.js';

export { platformSLOs, sloMonitor } from './slos.js';
export type { SLO, SLI, TimeWindow, SLOStatus } from './slos.js';

// Prometheus
export { prometheusRegistry } from './prometheus/registry.js';
export { registerPrometheusHooks } from './prometheus/middleware.js';
export { customCollectors } from './prometheus/collectors.js';

// Health checks
export {
  healthCheckManager,
  createDatabaseHealthCheck,
  createRedisHealthCheck,
  createLiteLLMHealthCheck,
  createDiskSpaceHealthCheck,
  createMemoryHealthCheck,
  createMigrationsReadinessCheck,
  createServicesReadinessCheck
} from './health/checks.js';
export type {
  HealthCheck,
  HealthCheckResult,
  HealthStatus,
  ReadinessStatus
} from './health/checks.js';
export {
  healthEndpoint,
  readinessEndpoint,
  livenessEndpoint,
  individualCheckEndpoint
} from './health/endpoints.js';

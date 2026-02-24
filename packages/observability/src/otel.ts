import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION
} from "@opentelemetry/semantic-conventions";
import {
  trace,
  SpanStatusCode,
  type Span,
  type Tracer
} from "@opentelemetry/api";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

let _sdk: NodeSDK | null = null;

/**
 * Initialise the OpenTelemetry Node SDK.
 *
 * When `otlpEndpoint` or the `OTEL_EXPORTER_OTLP_ENDPOINT` environment
 * variable is set, traces are exported via OTLP/HTTP.  Otherwise the SDK
 * is started with no exporters (noop / console-only in development).
 */
export function initOtel(serviceName: string, otlpEndpoint?: string): void {
  const endpoint =
    otlpEndpoint ?? process.env["OTEL_EXPORTER_OTLP_ENDPOINT"];

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: process.env["npm_package_version"] ?? "0.0.0"
  });

  if (endpoint) {
    const exporter = new OTLPTraceExporter({ url: endpoint });
    _sdk = new NodeSDK({
      resource,
      spanProcessors: [new BatchSpanProcessor(exporter)]
    });
  } else {
    // No OTLP endpoint configured — start SDK without an exporter so all
    // OTel API calls are valid but produce no external traffic.
    _sdk = new NodeSDK({ resource });
  }

  _sdk.start();
}

/**
 * Gracefully shut down the OpenTelemetry SDK, flushing any pending spans.
 */
export async function shutdownOtel(): Promise<void> {
  if (_sdk) {
    await _sdk.shutdown();
    _sdk = null;
  }
}

/**
 * Return an OTel `Tracer` scoped to the given instrumentation library name.
 * If `initOtel` has not been called the API falls back to the noop
 * implementation automatically.
 */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}

/**
 * Start a new span attached to the current active context.
 *
 * @param tracer     - OTel tracer obtained via `getTracer`.
 * @param name       - Span name.
 * @param attributes - Optional string-valued span attributes.
 * @returns The started (active) `Span`.
 */
export function startSpan(
  tracer: Tracer,
  name: string,
  attributes?: Record<string, string>
): Span {
  if (attributes !== undefined) {
    return tracer.startSpan(name, { attributes });
  }
  return tracer.startSpan(name);
}

/**
 * End a span.  If `error` is provided the span status is set to ERROR and
 * the error is recorded as an exception event.
 */
export function endSpan(span: Span, error?: Error): void {
  if (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }
  span.end();
}

/**
 * Execute `fn` inside a new span.  The span is ended automatically whether
 * `fn` resolves or rejects.
 *
 * @param tracer     - OTel tracer.
 * @param name       - Span name.
 * @param fn         - Async function that receives the live span.
 * @returns Whatever `fn` resolves to.
 */
export async function withSpan<T>(
  tracer: Tracer,
  name: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const span = tracer.startSpan(name);
  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw err;
  } finally {
    span.end();
  }
}

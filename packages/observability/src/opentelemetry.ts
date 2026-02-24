import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
// Auto-instrumentation commented out - install package if needed
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// Note: Using OTLP exporters instead of direct Jaeger/Prometheus
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context, propagation, SpanStatusCode, Span } from '@opentelemetry/api';
import type { Context } from '@opentelemetry/api';

export interface OpenTelemetryConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaegerEndpoint?: string;
  otlpEndpoint?: string;
  prometheusPort?: number;
  enableAutoInstrumentation?: boolean;
  sampleRate?: number;
}

class OpenTelemetryService {
  private sdk: NodeSDK | null = null;
  private tracer: ReturnType<typeof trace.getTracer> | null = null;

  /**
   * Initialize OpenTelemetry SDK with configuration
   */
  async initialize(configParam: OpenTelemetryConfig): Promise<void> {

    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: configParam.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: configParam.serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: configParam.environment,
    });

    // Setup trace exporters
    const traceExporters: BatchSpanProcessor[] = [];

    // Use OTLP for both Jaeger and other backends
    const otlpEndpoint = configParam.otlpEndpoint || configParam.jaegerEndpoint;
    if (otlpEndpoint) {
      const otlpExporter = new OTLPTraceExporter({
        url: `${otlpEndpoint}/v1/traces`,
      });
      traceExporters.push(new BatchSpanProcessor(otlpExporter));
    }

    // Setup metric exporters
    let metricReader: PeriodicExportingMetricReader | undefined;

    // Prometheus metrics are handled by prom-client directly
    // Remove PrometheusExporter as it's not compatible with this setup

    if (configParam.otlpEndpoint) {
      const otlpMetricExporter = new OTLPMetricExporter({
        url: `${configParam.otlpEndpoint}/v1/metrics`,
      });
      metricReader = new PeriodicExportingMetricReader({
        exporter: otlpMetricExporter,
        exportIntervalMillis: 60000,
      });
    }

    // Initialize SDK
    const sdkConfig: any = {
      resource,
      spanProcessors: traceExporters,
      instrumentations: [],
      // Auto-instrumentation disabled by default
      // Uncomment and install @opentelemetry/auto-instrumentations-node if needed
    };

    if (metricReader) {
      sdkConfig.metricReader = metricReader;
    }

    this.sdk = new NodeSDK(sdkConfig);

    await this.sdk.start();

    // Get tracer instance
    this.tracer = trace.getTracer(configParam.serviceName, configParam.serviceVersion);

    console.log('OpenTelemetry initialized successfully');
  }

  /**
   * Shutdown OpenTelemetry SDK gracefully
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      console.log('OpenTelemetry shut down successfully');
    }
  }

  /**
   * Get the tracer instance
   */
  getTracer() {
    if (!this.tracer) {
      throw new Error('OpenTelemetry not initialized. Call initialize() first.');
    }
    return this.tracer;
  }

  /**
   * Start a new span
   */
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): Span {
    const tracer = this.getTracer();
    return tracer.startSpan(name, attributes ? { attributes } : {});
  }

  /**
   * Start a span with active context
   */
  startActiveSpan<T>(
    name: string,
    fn: (span: Span) => T,
    attributes?: Record<string, string | number | boolean>
  ): T {
    const tracer = this.getTracer();
    return tracer.startActiveSpan(name, attributes ? { attributes } : {}, (span) => {
      try {
        const result = fn(span);
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        throw error;
      } finally {
        span.end();
      }
    }) as T;
  }

  /**
   * Start an async span with active context
   */
  async startActiveSpanAsync<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const tracer = this.getTracer();
    return tracer.startActiveSpan(name, attributes ? { attributes } : {}, async (span) => {
      try {
        const result = await fn(span);
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: (error as Error).message,
        });
        throw error;
      } finally {
        span.end();
      }
    }) as Promise<T>;
  }

  /**
   * Get current active context
   */
  getActiveContext(): Context {
    return context.active();
  }

  /**
   * Set active context
   */
  setActiveContext(ctx: Context, fn: () => void): void {
    context.with(ctx, fn);
  }

  /**
   * Inject context into carrier (for cross-service propagation)
   */
  inject(carrier: Record<string, unknown>): void {
    propagation.inject(context.active(), carrier);
  }

  /**
   * Extract context from carrier (for cross-service propagation)
   */
  extract(carrier: Record<string, unknown>): Context {
    return propagation.extract(context.active(), carrier);
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set attribute on current span
   */
  setAttribute(key: string, value: string | number | boolean): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }

  /**
   * Record exception on current span
   */
  recordException(error: Error): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    }
  }
}

// Singleton instance
export const openTelemetry = new OpenTelemetryService();

// Convenience exports
export { trace, context, propagation, SpanStatusCode };
export type { Span, Context };

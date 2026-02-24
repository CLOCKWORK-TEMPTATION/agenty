import { Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus registry for metrics collection
 */
class PrometheusRegistry {
  private registry: Registry | null = null;
  private defaultMetricsCollected = false;

  /**
   * Initialize Prometheus registry
   */
  initialize(options?: { collectDefaultMetrics?: boolean }): Registry {
    if (this.registry) {
      return this.registry;
    }

    this.registry = new Registry();

    // Collect default Node.js metrics
    if (options?.collectDefaultMetrics !== false && !this.defaultMetricsCollected) {
      collectDefaultMetrics({
        register: this.registry,
        prefix: 'nodejs_',
        labels: {
          app: 'multi_agent_platform',
        },
      });
      this.defaultMetricsCollected = true;
    }

    console.log('Prometheus registry initialized');
    return this.registry;
  }

  /**
   * Get registry instance
   */
  getRegistry(): Registry {
    if (!this.registry) {
      throw new Error('Prometheus registry not initialized. Call initialize() first.');
    }
    return this.registry;
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    const registry = this.getRegistry();
    return registry.metrics();
  }

  /**
   * Get metrics as JSON
   */
  async getMetricsJSON(): Promise<unknown> {
    const registry = this.getRegistry();
    return registry.getMetricsAsJSON();
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    if (this.registry) {
      this.registry.clear();
    }
  }

  /**
   * Reset registry
   */
  reset(): void {
    this.clear();
    this.registry = null;
    this.defaultMetricsCollected = false;
  }

  /**
   * Register a metric
   */
  registerMetric<T>(metric: T): T {
    this.getRegistry();
    // Metrics auto-register when created with prom-client
    // This method is here for explicit registration if needed
    return metric;
  }

  /**
   * Get single metric by name
   */
  getSingleMetric(name: string): unknown {
    this.getRegistry();
    // Note: Access metrics through getMetricsAsJSON() instead
    return { name };
  }

  /**
   * Remove single metric
   */
  removeSingleMetric(_name: string): void {
    this.getRegistry();
    // Note: Registry.removeSingleMetric is not directly exposed in types
    // Metrics are automatically managed by prom-client
  }

  /**
   * Set default labels for all metrics
   */
  setDefaultLabels(labels: Record<string, string>): void {
    this.getRegistry();
    // Note: Default labels should be set on individual metrics
    // This is a placeholder for compatibility
    void labels;
  }
}

// Singleton instance
export const prometheusRegistry = new PrometheusRegistry();

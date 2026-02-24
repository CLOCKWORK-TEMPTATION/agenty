/**
 * Service Level Objectives (SLOs) and Service Level Indicators (SLIs)
 * for the Multi-Model Agent Teams Platform
 */

export interface SLO {
  id: string;
  name: string;
  description: string;
  target: number; // Target percentage (0-1)
  sli: SLI;
  window: TimeWindow;
  error_budget?: number; // Calculated error budget (1 - target)
}

export interface SLI {
  id: string;
  name: string;
  description: string;
  metric: string;
  aggregation: 'success_rate' | 'percentile' | 'average';
  threshold?: number; // For latency-based SLIs
  good_events_query?: string; // Query for successful events
  total_events_query?: string; // Query for total events
}

export interface TimeWindow {
  type: 'rolling' | 'calendar';
  duration_days: number;
}

export interface SLOStatus {
  slo_id: string;
  current_value: number;
  target: number;
  compliance: number; // current_value / target
  error_budget_remaining: number; // Percentage of error budget remaining
  error_budget_consumed: number; // Percentage of error budget consumed
  status: 'healthy' | 'warning' | 'critical';
  window_start: string;
  window_end: string;
  last_updated: string;
}

/**
 * Platform SLOs
 */
export const platformSLOs: SLO[] = [
  // Availability SLO
  {
    id: 'availability',
    name: 'Platform Availability',
    description: 'Percentage of successful requests over total requests',
    target: 0.999, // 99.9%
    sli: {
      id: 'availability_sli',
      name: 'Availability SLI',
      description: 'Ratio of successful requests to total requests',
      metric: 'http_requests_total',
      aggregation: 'success_rate',
      good_events_query: 'http_requests_total{status=~"2..|3.."}',
      total_events_query: 'http_requests_total',
    },
    window: {
      type: 'rolling',
      duration_days: 30,
    },
    error_budget: 0.001, // 0.1%
  },

  // Latency SLO - P95
  {
    id: 'latency_p95',
    name: 'P95 Latency',
    description: '95th percentile request latency under 2 seconds',
    target: 0.95, // 95% of requests
    sli: {
      id: 'latency_p95_sli',
      name: 'P95 Latency SLI',
      description: 'Percentage of requests completing under 2 seconds',
      metric: 'http_request_duration_seconds',
      aggregation: 'percentile',
      threshold: 2, // 2 seconds
    },
    window: {
      type: 'rolling',
      duration_days: 7,
    },
    error_budget: 0.05, // 5%
  },

  // Latency SLO - P99
  {
    id: 'latency_p99',
    name: 'P99 Latency',
    description: '99th percentile request latency under 5 seconds',
    target: 0.99, // 99% of requests
    sli: {
      id: 'latency_p99_sli',
      name: 'P99 Latency SLI',
      description: 'Percentage of requests completing under 5 seconds',
      metric: 'http_request_duration_seconds',
      aggregation: 'percentile',
      threshold: 5, // 5 seconds
    },
    window: {
      type: 'rolling',
      duration_days: 7,
    },
    error_budget: 0.01, // 1%
  },

  // Error Rate SLO
  {
    id: 'error_rate',
    name: 'Error Rate',
    description: 'Error rate below 0.1%',
    target: 0.999, // 99.9% success rate
    sli: {
      id: 'error_rate_sli',
      name: 'Error Rate SLI',
      description: 'Percentage of successful requests',
      metric: 'run_status_total',
      aggregation: 'success_rate',
      good_events_query: 'run_status_total{status="completed"}',
      total_events_query: 'run_status_total',
    },
    window: {
      type: 'rolling',
      duration_days: 30,
    },
    error_budget: 0.001, // 0.1%
  },

  // Run Success Rate SLO
  {
    id: 'run_success_rate',
    name: 'Run Success Rate',
    description: 'Percentage of successful agent runs',
    target: 0.95, // 95% success rate
    sli: {
      id: 'run_success_rate_sli',
      name: 'Run Success Rate SLI',
      description: 'Ratio of successful runs to total runs',
      metric: 'run_status_total',
      aggregation: 'success_rate',
      good_events_query: 'run_status_total{status="completed"}',
      total_events_query: 'run_status_total',
    },
    window: {
      type: 'rolling',
      duration_days: 7,
    },
    error_budget: 0.05, // 5%
  },

  // Cache Hit Rate SLO
  {
    id: 'cache_hit_rate',
    name: 'Cache Hit Rate',
    description: 'Cache hit rate above 70%',
    target: 0.7, // 70% hit rate
    sli: {
      id: 'cache_hit_rate_sli',
      name: 'Cache Hit Rate SLI',
      description: 'Ratio of cache hits to total cache operations',
      metric: 'cache_hit_rate',
      aggregation: 'average',
    },
    window: {
      type: 'rolling',
      duration_days: 1,
    },
    error_budget: 0.3, // 30%
  },

  // Model Request Success Rate SLO
  {
    id: 'model_success_rate',
    name: 'Model Request Success Rate',
    description: 'Percentage of successful model requests',
    target: 0.99, // 99% success rate
    sli: {
      id: 'model_success_rate_sli',
      name: 'Model Success Rate SLI',
      description: 'Ratio of successful model requests to total requests',
      metric: 'model_requests_total',
      aggregation: 'success_rate',
      good_events_query: 'model_requests_total - model_errors_total',
      total_events_query: 'model_requests_total',
    },
    window: {
      type: 'rolling',
      duration_days: 7,
    },
    error_budget: 0.01, // 1%
  },

  // Tool Execution Success Rate SLO
  {
    id: 'tool_success_rate',
    name: 'Tool Execution Success Rate',
    description: 'Percentage of successful tool executions',
    target: 0.98, // 98% success rate
    sli: {
      id: 'tool_success_rate_sli',
      name: 'Tool Success Rate SLI',
      description: 'Ratio of successful tool executions to total executions',
      metric: 'tool_executions_total',
      aggregation: 'success_rate',
      good_events_query: 'tool_executions_total{status="success"}',
      total_events_query: 'tool_executions_total',
    },
    window: {
      type: 'rolling',
      duration_days: 7,
    },
    error_budget: 0.02, // 2%
  },
];

/**
 * SLO Monitor
 */
class SLOMonitor {
  private slos: Map<string, SLO> = new Map();
  private sloStatus: Map<string, SLOStatus> = new Map();

  constructor() {
    // Initialize with platform SLOs
    for (const slo of platformSLOs) {
      this.slos.set(slo.id, slo);
    }
  }

  /**
   * Calculate current SLO status
   */
  calculateStatus(sloId: string, currentValue: number): SLOStatus {
    const slo = this.slos.get(sloId);
    if (!slo) {
      throw new Error(`SLO not found: ${sloId}`);
    }

    const errorBudget = slo.error_budget || 1 - slo.target;
    const compliance = currentValue / slo.target;
    const errorBudgetConsumed = Math.max(0, (slo.target - currentValue) / errorBudget);
    const errorBudgetRemaining = Math.max(0, 1 - errorBudgetConsumed);

    let status: SLOStatus['status'] = 'healthy';
    if (errorBudgetRemaining < 0.1) {
      // Less than 10% error budget remaining
      status = 'critical';
    } else if (errorBudgetRemaining < 0.25) {
      // Less than 25% error budget remaining
      status = 'warning';
    }

    const now = new Date();
    const windowStart = new Date(
      now.getTime() - slo.window.duration_days * 24 * 60 * 60 * 1000
    );

    const sloStatus: SLOStatus = {
      slo_id: sloId,
      current_value: currentValue,
      target: slo.target,
      compliance,
      error_budget_remaining: errorBudgetRemaining,
      error_budget_consumed: errorBudgetConsumed,
      status,
      window_start: windowStart.toISOString(),
      window_end: now.toISOString(),
      last_updated: now.toISOString(),
    };

    this.sloStatus.set(sloId, sloStatus);
    return sloStatus;
  }

  /**
   * Get SLO status
   */
  getStatus(sloId: string): SLOStatus | undefined {
    return this.sloStatus.get(sloId);
  }

  /**
   * Get all SLO statuses
   */
  getAllStatuses(): SLOStatus[] {
    return Array.from(this.sloStatus.values());
  }

  /**
   * Get SLOs by status
   */
  getByStatus(status: SLOStatus['status']): SLOStatus[] {
    return Array.from(this.sloStatus.values()).filter((s) => s.status === status);
  }

  /**
   * Check if any SLOs are violated
   */
  hasViolations(): boolean {
    return Array.from(this.sloStatus.values()).some((s) => s.status === 'critical');
  }

  /**
   * Get error budget burn rate
   * Returns the rate at which error budget is being consumed
   */
  getErrorBudgetBurnRate(sloId: string, periodHours: number = 1): number {
    const status = this.sloStatus.get(sloId);
    const slo = this.slos.get(sloId);

    if (!status || !slo) {
      return 0;
    }

    // Calculate how much error budget was consumed in the period
    // This is a simplified calculation; in production, you'd track this over time
    const totalHours = slo.window.duration_days * 24;
    const burnRate = (status.error_budget_consumed * totalHours) / periodHours;

    return burnRate;
  }

  /**
   * Get time to exhaustion of error budget
   * Returns hours until error budget is exhausted at current burn rate
   */
  getTimeToExhaustion(sloId: string): number | null {
    const status = this.sloStatus.get(sloId);
    if (!status || status.error_budget_remaining <= 0) {
      return null;
    }

    const burnRate = this.getErrorBudgetBurnRate(sloId);
    if (burnRate <= 0) {
      return Infinity;
    }

    return status.error_budget_remaining / burnRate;
  }

  /**
   * Generate SLO report
   */
  generateReport(): {
    summary: {
      total: number;
      healthy: number;
      warning: number;
      critical: number;
    };
    slos: SLOStatus[];
  } {
    const statuses = this.getAllStatuses();

    return {
      summary: {
        total: statuses.length,
        healthy: statuses.filter((s) => s.status === 'healthy').length,
        warning: statuses.filter((s) => s.status === 'warning').length,
        critical: statuses.filter((s) => s.status === 'critical').length,
      },
      slos: statuses,
    };
  }
}

// Singleton instance
export const sloMonitor = new SLOMonitor();

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
  critical?: boolean; // If true, failure means system is unhealthy
  timeout?: number; // Timeout in milliseconds
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  metadata?: Record<string, unknown>;
  latency_ms?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime_seconds: number;
  checks: Record<string, HealthCheckResult>;
}

export interface ReadinessStatus {
  ready: boolean;
  timestamp: string;
  checks: Record<string, HealthCheckResult>;
}

/**
 * Health check manager
 */
class HealthCheckManager {
  private checks: Map<string, HealthCheck> = new Map();
  private readinessChecks: Map<string, HealthCheck> = new Map();
  private startTime: number = Date.now();

  /**
   * Register a health check
   */
  registerHealthCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
  }

  /**
   * Register a readiness check
   */
  registerReadinessCheck(check: HealthCheck): void {
    this.readinessChecks.set(check.name, check);
  }

  /**
   * Execute all health checks
   */
  async checkHealth(): Promise<HealthStatus> {
    const results: Record<string, HealthCheckResult> = {};
    let overallStatus: HealthStatus['status'] = 'healthy';

    for (const [name, check] of this.checks.entries()) {
      try {
        const startTime = Date.now();
        const timeoutPromise = new Promise<HealthCheckResult>((_, reject) =>
          setTimeout(
            () => reject(new Error('Health check timeout')),
            check.timeout || 5000
          )
        );

        const result = await Promise.race([check.check(), timeoutPromise]);
        result.latency_ms = Date.now() - startTime;
        results[name] = result;

        // Update overall status
        if (check.critical && result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus !== 'unhealthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          message: (error as Error).message,
        };

        if (check.critical) {
          overallStatus = 'unhealthy';
        }
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      checks: results,
    };
  }

  /**
   * Execute all readiness checks
   */
  async checkReadiness(): Promise<ReadinessStatus> {
    const results: Record<string, HealthCheckResult> = {};
    let ready = true;

    for (const [name, check] of this.readinessChecks.entries()) {
      try {
        const startTime = Date.now();
        const timeoutPromise = new Promise<HealthCheckResult>((_, reject) =>
          setTimeout(
            () => reject(new Error('Readiness check timeout')),
            check.timeout || 5000
          )
        );

        const result = await Promise.race([check.check(), timeoutPromise]);
        result.latency_ms = Date.now() - startTime;
        results[name] = result;

        if (result.status !== 'healthy') {
          ready = false;
        }
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          message: (error as Error).message,
        };
        ready = false;
      }
    }

    return {
      ready,
      timestamp: new Date().toISOString(),
      checks: results,
    };
  }

  /**
   * Get individual check result
   */
  async checkIndividual(name: string): Promise<HealthCheckResult | null> {
    const check = this.checks.get(name) || this.readinessChecks.get(name);
    if (!check) {
      return null;
    }

    try {
      const result = await check.check();
      return result;
    } catch (error) {
      return {
        status: 'unhealthy',
        message: (error as Error).message,
      };
    }
  }
}

// Singleton instance
export const healthCheckManager = new HealthCheckManager();

/**
 * Predefined health checks
 */

/**
 * Database connectivity check
 */
export function createDatabaseHealthCheck(
  checkConnection: () => Promise<boolean>
): HealthCheck {
  return {
    name: 'database',
    critical: true,
    timeout: 5000,
    check: async () => {
      try {
        const isConnected = await checkConnection();
        if (isConnected) {
          return {
            status: 'healthy',
            message: 'Database connection is healthy',
          };
        }
        return {
          status: 'unhealthy',
          message: 'Database connection failed',
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Database error: ${(error as Error).message}`,
        };
      }
    },
  };
}

/**
 * Redis connectivity check
 */
export function createRedisHealthCheck(ping: () => Promise<boolean>): HealthCheck {
  return {
    name: 'redis',
    critical: true,
    timeout: 3000,
    check: async () => {
      try {
        const isConnected = await ping();
        if (isConnected) {
          return {
            status: 'healthy',
            message: 'Redis connection is healthy',
          };
        }
        return {
          status: 'unhealthy',
          message: 'Redis ping failed',
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Redis error: ${(error as Error).message}`,
        };
      }
    },
  };
}

/**
 * LiteLLM connectivity check
 */
export function createLiteLLMHealthCheck(healthUrl: string): HealthCheck {
  return {
    name: 'litellm',
    critical: false,
    timeout: 5000,
    check: async () => {
      try {
        const response = await fetch(healthUrl, { method: 'GET' });
        if (response.ok) {
          return {
            status: 'healthy',
            message: 'LiteLLM is healthy',
          };
        }
        return {
          status: 'degraded',
          message: `LiteLLM returned status ${response.status}`,
        };
      } catch (error) {
        return {
          status: 'degraded',
          message: `LiteLLM error: ${(error as Error).message}`,
        };
      }
    },
  };
}

/**
 * Disk space check
 */
export function createDiskSpaceHealthCheck(
  getUsage: () => Promise<{ used: number; total: number }>,
  threshold: number = 0.9
): HealthCheck {
  return {
    name: 'disk_space',
    critical: false,
    check: async () => {
      try {
        const { used, total } = await getUsage();
        const usage = used / total;

        if (usage < threshold) {
          return {
            status: 'healthy',
            message: `Disk usage: ${(usage * 100).toFixed(1)}%`,
            metadata: { used, total, usage },
          };
        }

        if (usage < 0.95) {
          return {
            status: 'degraded',
            message: `Disk usage high: ${(usage * 100).toFixed(1)}%`,
            metadata: { used, total, usage },
          };
        }

        return {
          status: 'unhealthy',
          message: `Disk usage critical: ${(usage * 100).toFixed(1)}%`,
          metadata: { used, total, usage },
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Disk check error: ${(error as Error).message}`,
        };
      }
    },
  };
}

/**
 * Memory usage check
 */
export function createMemoryHealthCheck(threshold: number = 0.9): HealthCheck {
  return {
    name: 'memory',
    critical: false,
    check: async () => {
      const usage = process.memoryUsage();
      const heapUsage = usage.heapUsed / usage.heapTotal;

      const metadata: Record<string, unknown> = {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
      };

      if (heapUsage < threshold) {
        return {
          status: 'healthy',
          message: `Memory usage: ${(heapUsage * 100).toFixed(1)}%`,
          metadata,
        };
      }

      if (heapUsage < 0.95) {
        return {
          status: 'degraded',
          message: `Memory usage high: ${(heapUsage * 100).toFixed(1)}%`,
          metadata,
        };
      }

      return {
        status: 'unhealthy',
        message: `Memory usage critical: ${(heapUsage * 100).toFixed(1)}%`,
        metadata,
      };
    },
  };
}

/**
 * Migrations applied check (readiness)
 */
export function createMigrationsReadinessCheck(
  checkMigrations: () => Promise<boolean>
): HealthCheck {
  return {
    name: 'migrations',
    critical: true,
    check: async () => {
      try {
        const applied = await checkMigrations();
        if (applied) {
          return {
            status: 'healthy',
            message: 'All migrations applied',
          };
        }
        return {
          status: 'unhealthy',
          message: 'Pending migrations',
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Migration check error: ${(error as Error).message}`,
        };
      }
    },
  };
}

/**
 * Services initialized check (readiness)
 */
export function createServicesReadinessCheck(
  checkServices: () => Promise<{ initialized: boolean; services: string[] }>
): HealthCheck {
  return {
    name: 'services',
    critical: true,
    check: async () => {
      try {
        const { initialized, services } = await checkServices();
        if (initialized) {
          return {
            status: 'healthy',
            message: 'All services initialized',
            metadata: { services },
          };
        }
        return {
          status: 'unhealthy',
          message: 'Services not initialized',
          metadata: { services },
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: `Services check error: ${(error as Error).message}`,
        };
      }
    },
  };
}

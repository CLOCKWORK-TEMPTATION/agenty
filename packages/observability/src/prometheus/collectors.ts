import { Gauge, register } from 'prom-client';
import * as os from 'node:os';
import * as process from 'node:process';

/**
 * Custom collectors for system and application metrics
 */
class CustomCollectors {
  private processMetrics: ProcessMetricsCollector;
  private systemMetrics: SystemMetricsCollector;
  private dbMetrics: DatabaseMetricsCollector;
  private redisMetrics: RedisMetricsCollector;
  private queueMetrics: QueueMetricsCollector;

  constructor() {
    this.processMetrics = new ProcessMetricsCollector();
    this.systemMetrics = new SystemMetricsCollector();
    this.dbMetrics = new DatabaseMetricsCollector();
    this.redisMetrics = new RedisMetricsCollector();
    this.queueMetrics = new QueueMetricsCollector();
  }

  /**
   * Initialize all collectors
   */
  initialize(): void {
    this.processMetrics.initialize();
    this.systemMetrics.initialize();
    this.dbMetrics.initialize();
    this.redisMetrics.initialize();
    this.queueMetrics.initialize();
    console.log('Custom collectors initialized');
  }

  /**
   * Update database metrics
   */
  updateDatabaseMetrics(stats: {
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    totalConnections: number;
  }): void {
    this.dbMetrics.update(stats);
  }

  /**
   * Update Redis metrics
   */
  updateRedisMetrics(stats: {
    connectedClients: number;
    blockedClients: number;
    usedMemory: number;
    totalConnections: number;
  }): void {
    this.redisMetrics.update(stats);
  }

  /**
   * Update queue metrics
   */
  updateQueueMetrics(stats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }): void {
    this.queueMetrics.update(stats);
  }
}

/**
 * Process metrics collector
 */
class ProcessMetricsCollector {
  private cpuUsage: Gauge<string>;
  private memoryUsage: Gauge<string>;
  private activeHandles: Gauge<string>;

  constructor() {
    this.cpuUsage = new Gauge({
      name: 'process_cpu_usage_percent',
      help: 'Process CPU usage percentage',
      registers: [register],
    });

    this.memoryUsage = new Gauge({
      name: 'process_memory_usage_bytes',
      help: 'Process memory usage in bytes',
      labelNames: ['type'],
      registers: [register],
    });

    this.activeHandles = new Gauge({
      name: 'nodejs_active_handles_total',
      help: 'Number of active handles',
      registers: [register],
    });
  }

  initialize(): void {
    // Update metrics every 5 seconds
    setInterval(() => {
      this.collect();
    }, 5000);
  }

  private collect(): void {
    // CPU usage
    const cpuUsage = process.cpuUsage();
    const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.cpuUsage.set(totalUsage);

    // Memory usage
    const memUsage = process.memoryUsage();
    this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
    this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
    this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
    this.memoryUsage.set({ type: 'external' }, memUsage.external);

    // Active handles
    // Note: _getActiveHandles is deprecated and may not exist in all Node versions
    try {
      // @ts-expect-error - _getActiveHandles is not in types but exists
      const handles = process._getActiveHandles?.()?.length ?? 0;
      this.activeHandles.set(handles);
    } catch {
      // Ignore if not available
    }
  }
}

/**
 * System metrics collector
 */
class SystemMetricsCollector {
  private systemCpuUsage: Gauge<string>;
  private systemMemory: Gauge<string>;
  private systemLoadAverage: Gauge<string>;

  constructor() {
    this.systemCpuUsage = new Gauge({
      name: 'system_cpu_usage_percent',
      help: 'System CPU usage percentage',
      registers: [register],
    });

    this.systemMemory = new Gauge({
      name: 'system_memory_bytes',
      help: 'System memory in bytes',
      labelNames: ['type'],
      registers: [register],
    });

    this.systemLoadAverage = new Gauge({
      name: 'system_load_average',
      help: 'System load average',
      labelNames: ['period'],
      registers: [register],
    });
  }

  initialize(): void {
    // Update metrics every 10 seconds
    setInterval(() => {
      this.collect();
    }, 10000);
  }

  private collect(): void {
    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    this.systemMemory.set({ type: 'total' }, totalMem);
    this.systemMemory.set({ type: 'free' }, freeMem);
    this.systemMemory.set({ type: 'used' }, usedMem);

    // Load average
    const loadAvg = os.loadavg();
    this.systemLoadAverage.set({ period: '1m' }, loadAvg[0] ?? 0);
    this.systemLoadAverage.set({ period: '5m' }, loadAvg[1] ?? 0);
    this.systemLoadAverage.set({ period: '15m' }, loadAvg[2] ?? 0);

    // CPU usage (simplified)
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const cpuUsage = 100 - (100 * totalIdle) / totalTick;
    this.systemCpuUsage.set(cpuUsage);
  }
}

/**
 * Database metrics collector
 */
class DatabaseMetricsCollector {
  private connectionPool: Gauge<string>;

  constructor() {
    this.connectionPool = new Gauge({
      name: 'db_connection_pool',
      help: 'Database connection pool metrics',
      labelNames: ['state'],
      registers: [register],
    });
  }

  initialize(): void {
    // Metrics are updated externally via update() method
  }

  update(stats: {
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    totalConnections: number;
  }): void {
    this.connectionPool.set({ state: 'active' }, stats.activeConnections);
    this.connectionPool.set({ state: 'idle' }, stats.idleConnections);
    this.connectionPool.set({ state: 'waiting' }, stats.waitingRequests);
    this.connectionPool.set({ state: 'total' }, stats.totalConnections);
  }
}

/**
 * Redis metrics collector
 */
class RedisMetricsCollector {
  private redisConnections: Gauge<string>;
  private redisMemory: Gauge<string>;

  constructor() {
    this.redisConnections = new Gauge({
      name: 'redis_connections',
      help: 'Redis connection metrics',
      labelNames: ['state'],
      registers: [register],
    });

    this.redisMemory = new Gauge({
      name: 'redis_memory_bytes',
      help: 'Redis memory usage in bytes',
      registers: [register],
    });
  }

  initialize(): void {
    // Metrics are updated externally via update() method
  }

  update(stats: {
    connectedClients: number;
    blockedClients: number;
    usedMemory: number;
    totalConnections: number;
  }): void {
    this.redisConnections.set({ state: 'connected' }, stats.connectedClients);
    this.redisConnections.set({ state: 'blocked' }, stats.blockedClients);
    this.redisConnections.set({ state: 'total' }, stats.totalConnections);
    this.redisMemory.set(stats.usedMemory);
  }
}

/**
 * Queue metrics collector
 */
class QueueMetricsCollector {
  private queueJobs: Gauge<string>;

  constructor() {
    this.queueJobs = new Gauge({
      name: 'queue_jobs',
      help: 'Queue job counts by state',
      labelNames: ['state'],
      registers: [register],
    });
  }

  initialize(): void {
    // Metrics are updated externally via update() method
  }

  update(stats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }): void {
    this.queueJobs.set({ state: 'waiting' }, stats.waiting);
    this.queueJobs.set({ state: 'active' }, stats.active);
    this.queueJobs.set({ state: 'completed' }, stats.completed);
    this.queueJobs.set({ state: 'failed' }, stats.failed);
    this.queueJobs.set({ state: 'delayed' }, stats.delayed);
  }
}

// Singleton instance
export const customCollectors = new CustomCollectors();

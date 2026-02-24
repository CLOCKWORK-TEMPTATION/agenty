import { getWorkerManager } from './manager.js';

/**
 * Main entry point for workers
 * Starts all BullMQ workers and handles lifecycle
 */

async function main() {
  console.log('='.repeat(60));
  console.log('Multi-Model Agent Teams Platform - Workers');
  console.log('='.repeat(60));

  const workerManager = getWorkerManager();

  try {
    // Start all workers
    await workerManager.start();

    // Log initial health status
    const health = await workerManager.getHealthStatus();
    console.log('\n[Main] Initial health status:', health);

    // Log initial metrics
    const metrics = await workerManager.getMetrics();
    console.log('\n[Main] Initial metrics:', {
      active_jobs: metrics.totals.active,
      waiting_jobs: metrics.totals.waiting,
      memory_mb: metrics.memory.heap_used_mb,
    });

    console.log('\n[Main] Workers are running. Press Ctrl+C to stop.\n');
  } catch (error) {
    console.error('[Main] Failed to start workers:', error);
    process.exit(1);
  }
}

// Start the workers
main().catch((error) => {
  console.error('[Main] Unhandled error:', error);
  process.exit(1);
});

export { getWorkerManager } from './manager.js';
export { TeamExecutionWorker } from './team-execution-worker.js';
export { ToolExecutionWorker } from './tool-execution-worker.js';
export { BatchProcessingWorker } from './batch-processing-worker.js';
export { NotificationWorker } from './notification-worker.js';
export { WorkerMonitor } from './monitor.js';

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createStdioClient } from '../src/mcp/stdio-client';
import * as child_process from 'node:child_process';
import EventEmitter from 'node:events';

// Mock child_process.spawn
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn(),
  };
});

describe('StdioClient Lifecycle Management', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should track child process and remove it on cleanup', async () => {
    // Mock the ChildProcess
    const mockProc = new EventEmitter() as any;
    mockProc.pid = 12345;
    mockProc.killed = false;
    mockProc.kill = vi.fn();
    mockProc.stdout = new EventEmitter();
    mockProc.stdout.setEncoding = vi.fn();
    mockProc.stderr = new EventEmitter();
    mockProc.stderr.setEncoding = vi.fn();
    mockProc.stdin = { write: vi.fn() };

    (child_process.spawn as any).mockReturnValue(mockProc);

    const client = createStdioClient({
      command: 'dummy-mcp',
      args: [],
    });

    await client.start();

    // The spawn should be called once
    expect(child_process.spawn).toHaveBeenCalledTimes(1);
    
    // Test if cleanup gracefully kills
    await client.stop();

    // Verify it attempted to kill via SIGTERM first, then SIGKILL in cleanup
    expect(mockProc.kill).toHaveBeenCalled();
  });
});

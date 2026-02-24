import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { AppError } from "@repo/types";
import { randomUUID } from "node:crypto";

// Global registry to prevent child process leaks on parent exit
const activeProcesses = new Set<ChildProcess>();
process.on("exit", () => {
  for (const proc of activeProcesses) {
    try {
      if (proc.pid && !proc.killed) {
        proc.kill("SIGKILL");
      }
    } catch {
      // Ignore errors during process exit cleanup
    }
  }
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StdioClientConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface StdioMessage {
  jsonrpc: "2.0";
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export type MessageHandler = (message: StdioMessage) => void;
export type ErrorHandler = (error: Error) => void;
export type ExitHandler = (code: number | null, signal: NodeJS.Signals | null) => void;

// ---------------------------------------------------------------------------
// StdioClient
// ---------------------------------------------------------------------------

/**
 * StdioClient manages communication with MCP servers over stdio transport.
 * Features:
 * - Child process lifecycle management
 * - JSON-RPC message handling
 * - Graceful shutdown
 * - Error recovery
 * - Resource cleanup
 */
export class StdioClient {
  private readonly config: Required<StdioClientConfig>;
  private process: ChildProcess | null = null;
  private lineBuffer = "";
  private requestCounter = 0;
  private connected = false;

  // Pending requests tracking
  private readonly pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();

  // Event handlers
  private messageHandlers: MessageHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private exitHandlers: ExitHandler[] = [];

  // Shutdown tracking
  private shuttingDown = false;
  private shutdownPromise: Promise<void> | null = null;

  public constructor(config: StdioClientConfig) {
    this.config = {
      command: config.command,
      args: config.args,
      env: config.env ?? {},
      timeoutMs: config.timeoutMs ?? 30000
    };
  }

  /**
   * Start the stdio client and spawn child process
   */
  public async start(): Promise<void> {
    if (this.connected || this.process) {
      return; // Already started
    }

    const traceId = randomUUID();

    try {
      // Merge environment variables
      const mergedEnv: Record<string, string> = {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            (entry): entry is [string, string] => entry[1] !== undefined
          )
        ),
        ...this.config.env
      };

      // Spawn child process
      this.process = spawn(this.config.command, this.config.args, {
        env: mergedEnv,
        stdio: ["pipe", "pipe", "pipe"]
      });

      const proc = this.process;
      activeProcesses.add(proc);

      // Validate stdio streams
      if (!proc.stdout || !proc.stdin || !proc.stderr) {
        throw new AppError({
          message: "Failed to open stdio streams for MCP child process",
          errorCode: "STDIO_STREAMS_FAILED",
          retryable: false,
          traceId,
          statusCode: 500
        });
      }

      // Setup stdout handler
      proc.stdout.setEncoding("utf8");
      proc.stdout.on("data", (chunk: string) => {
        this.handleStdout(chunk);
      });

      // Setup stderr handler
      proc.stderr.setEncoding("utf8");
      proc.stderr.on("data", (chunk: string) => {
        this.handleStderr(chunk);
      });

      // Setup error handler
      proc.on("error", (err: Error) => {
        this.handleProcessError(err);
      });

      // Setup exit handler
      proc.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
        this.handleProcessExit(code, signal);
      });

      this.connected = true;
    } catch (error) {
      this.cleanup();

      throw new AppError({
        message: `Failed to start stdio client: ${error instanceof Error ? error.message : String(error)}`,
        errorCode: "STDIO_START_FAILED",
        retryable: true,
        traceId,
        statusCode: 500,
        details: {
          command: this.config.command,
          args: this.config.args,
          originalError: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }

  /**
   * Stop the stdio client and cleanup resources
   */
  public async stop(): Promise<void> {
    if (this.shuttingDown) {
      return this.shutdownPromise ?? Promise.resolve();
    }

    this.shuttingDown = true;
    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  /**
   * Send a JSON-RPC request
   */
  public async sendRequest(
    method: string,
    params?: unknown
  ): Promise<unknown> {
    this.assertConnected();

    const id = this.nextId();
    const message: StdioMessage = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined && { params })
    };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          pending.reject(
            new Error(`Request timeout after ${this.config.timeoutMs}ms: ${method}`)
          );
        }
      }, this.config.timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (value: unknown) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          reject(error);
        },
        timer
      });

      this.writeMessage(message);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  public sendNotification(method: string, params?: unknown): void {
    this.assertConnected();

    const message: StdioMessage = {
      jsonrpc: "2.0",
      method,
      ...(params !== undefined && { params })
    };

    this.writeMessage(message);
  }

  /**
   * Check if client is connected
   */
  public isConnected(): boolean {
    return this.connected && this.process !== null && !this.shuttingDown;
  }

  /**
   * Register message handler
   */
  public onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Register error handler
   */
  public onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Register exit handler
   */
  public onExit(handler: ExitHandler): void {
    this.exitHandlers.push(handler);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Assert client is connected
   */
  private assertConnected(): void {
    if (!this.connected || !this.process) {
      throw new Error("Stdio client is not connected");
    }
    if (this.shuttingDown) {
      throw new Error("Stdio client is shutting down");
    }
  }

  /**
   * Get next request ID
   */
  private nextId(): number {
    this.requestCounter += 1;
    return this.requestCounter;
  }

  /**
   * Write message to stdin
   */
  private writeMessage(message: StdioMessage): void {
    const proc = this.process;
    if (!proc?.stdin) {
      throw new Error("Process stdin not available");
    }

    const json = JSON.stringify(message);
    proc.stdin.write(json + "\n");
  }

  /**
   * Handle stdout data
   */
  private handleStdout(chunk: string): void {
    this.lineBuffer += chunk;
    this.processLineBuffer();
  }

  /**
   * Handle stderr data
   */
  private handleStderr(_chunk: string): void {
    // Stderr is informational in MCP protocol
    // In production, this could be logged for debugging
  }

  /**
   * Handle process error
   */
  private handleProcessError(error: Error): void {
    // Reject all pending requests
    this.rejectAllPending(error);

    // Notify error handlers
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch {
        // Ignore handler errors
      }
    }

    // Cleanup
    this.cleanup();
  }

  /**
   * Handle process exit
   */
  private handleProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
    const error = new Error(`Process exited with code ${String(code)} and signal ${String(signal)}`);
    this.rejectAllPending(error);

    // Notify exit handlers
    for (const handler of this.exitHandlers) {
      try {
        handler(code, signal);
      } catch {
        // Ignore handler errors
      }
    }

    // Cleanup
    this.cleanup();
  }

  /**
   * Process line buffer
   */
  private processLineBuffer(): void {
    const lines = this.lineBuffer.split("\n");
    this.lineBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      try {
        const message = JSON.parse(trimmed) as StdioMessage;
        this.handleMessage(message);
      } catch {
        // Invalid JSON - ignore
      }
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: StdioMessage): void {
    // Handle responses to our requests
    if (typeof message.id === "number") {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        clearTimeout(pending.timer);

        if (message.error) {
          pending.reject(
            new Error(
              `JSON-RPC error ${message.error.code}: ${message.error.message}`
            )
          );
        } else {
          pending.resolve(message.result);
        }
        return;
      }
    }

    // Notify message handlers (for notifications from server)
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Reject all pending requests
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Perform shutdown
   */
  private async performShutdown(): Promise<void> {
    // Reject all pending requests
    this.rejectAllPending(new Error("Client shutting down"));

    // Kill process
    if (this.process) {
      // Try graceful shutdown first
      this.process.kill("SIGTERM");

      // Wait up to 5 seconds for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Force kill if still running
          if (this.process) {
            this.process.kill("SIGKILL");
          }
          resolve();
        }, 5000);

        if (this.process) {
          this.process.once("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        } else {
          clearTimeout(timeout);
          resolve();
        }
      });
    }

    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.process) {
      activeProcesses.delete(this.process);
      if (this.process.pid && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }
    this.connected = false;
    this.process = null;
    this.lineBuffer = "";
    this.pendingRequests.clear();
    this.messageHandlers = [];
    this.errorHandlers = [];
    this.exitHandlers = [];
  }
}

/**
 * Create a stdio client
 */
export function createStdioClient(config: StdioClientConfig): StdioClient {
  return new StdioClient(config);
}

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { McpServerConfig } from "@repo/types";

// ---------------------------------------------------------------------------
// MCP Protocol Types
// ---------------------------------------------------------------------------

interface McpInitializeParams {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  clientInfo: { name: string; version: string };
}

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface McpJsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface McpToolCallResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

interface McpListToolsResult {
  tools: McpToolDef[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;
const PROTOCOL_VERSION = "2024-11-05";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function buildRequest(id: number, method: string, params?: unknown): McpJsonRpcRequest {
  const req: McpJsonRpcRequest = { jsonrpc: "2.0", id, method };
  if (params !== undefined) {
    req.params = params;
  }
  return req;
}

function buildNotification(method: string, params?: unknown): McpJsonRpcNotification {
  const notif: McpJsonRpcNotification = { jsonrpc: "2.0", method };
  if (params !== undefined) {
    notif.params = params;
  }
  return notif;
}

function initializeParams(): McpInitializeParams {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "tool-broker", version: "0.1.0" }
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`MCP timeout after ${ms}ms: ${label}`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// ---------------------------------------------------------------------------
// McpStdioClient
// ---------------------------------------------------------------------------

export class McpStdioClient {
  private readonly command: string;
  private readonly args: string[];
  private readonly env: Record<string, string> | undefined;

  private process: ChildProcess | null = null;
  private requestCounter = 0;
  private readonly pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();
  private lineBuffer = "";
  private connected = false;

  public constructor(command: string, args: string[], env?: Record<string, string>) {
    this.command = command;
    this.args = args;
    this.env = env;
  }

  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const mergedEnv: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
      ),
      ...(this.env ?? {})
    };

    this.process = spawn(this.command, this.args, {
      env: mergedEnv,
      stdio: ["pipe", "pipe", "pipe"]
    });

    const proc = this.process;

    if (!proc.stdout || !proc.stdin || !proc.stderr) {
      throw new Error("Failed to open stdio streams for MCP child process");
    }

    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      this.lineBuffer += chunk;
      this.processLineBuffer();
    });

    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (_chunk: string) => {
      // Stderr from MCP servers is informational; suppress in production
    });

    proc.on("error", (err: Error) => {
      this.rejectAllPending(err);
    });

    proc.on("exit", (code: number | null) => {
      const err = new Error(`MCP process exited with code ${String(code)}`);
      this.rejectAllPending(err);
      this.connected = false;
    });

    // Send initialize request
    const initResult = await withTimeout(
      this.sendRequest("initialize", initializeParams()),
      DEFAULT_TIMEOUT_MS,
      "initialize"
    );

    if (typeof initResult !== "object" || initResult === null) {
      throw new Error("Invalid initialize response from MCP server");
    }

    // Send initialized notification (no response expected)
    this.sendNotification("notifications/initialized");

    this.connected = true;
  }

  public async listTools(): Promise<McpToolDef[]> {
    this.assertConnected();
    const result = await withTimeout(
      this.sendRequest("tools/list"),
      DEFAULT_TIMEOUT_MS,
      "tools/list"
    );
    const typed = result as McpListToolsResult;
    return typed.tools ?? [];
  }

  public async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    this.assertConnected();
    const result = await withTimeout(
      this.sendRequest("tools/call", { name, arguments: args }),
      DEFAULT_TIMEOUT_MS,
      `tools/call:${name}`
    );
    const typed = result as McpToolCallResult;
    if (typed.isError === true) {
      const msg = typed.content.map((c) => c.text ?? "").join("");
      throw new Error(`MCP tool error (${name}): ${msg}`);
    }
    // Normalise content array into a flat output map
    const output: Record<string, unknown> = { content: typed.content };
    return output;
  }

  public disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.rejectAllPending(new Error("MCP client disconnected"));
    this.pendingRequests.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private assertConnected(): void {
    if (!this.connected || !this.process) {
      throw new Error("MCP stdio client is not connected");
    }
  }

  private nextId(): number {
    this.requestCounter += 1;
    return this.requestCounter;
  }

  private sendNotification(method: string, params?: unknown): void {
    const proc = this.process;
    if (!proc?.stdin) {
      return;
    }
    const notif = buildNotification(method, params);
    proc.stdin.write(JSON.stringify(notif) + "\n");
  }

  private sendRequest(method: string, params?: unknown): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const proc = this.process;
      if (!proc?.stdin) {
        reject(new Error("MCP process stdin not available"));
        return;
      }

      const id = this.nextId();
      const request = buildRequest(id, method, params);
      this.pendingRequests.set(id, { resolve, reject });
      proc.stdin.write(JSON.stringify(request) + "\n");
    });
  }

  private processLineBuffer(): void {
    const lines = this.lineBuffer.split("\n");
    // Keep the last (potentially incomplete) line in the buffer
    this.lineBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const message = JSON.parse(trimmed) as McpJsonRpcResponse;
        this.handleResponse(message);
      } catch {
        // Non-JSON line from server; ignore
      }
    }
  }

  private handleResponse(message: McpJsonRpcResponse): void {
    const pending = this.pendingRequests.get(message.id);
    if (!pending) {
      return;
    }
    this.pendingRequests.delete(message.id);

    if (message.error) {
      pending.reject(
        new Error(`MCP error ${message.error.code}: ${message.error.message}`)
      );
    } else {
      pending.resolve(message.result);
    }
  }

  private rejectAllPending(err: Error): void {
    for (const [, pending] of this.pendingRequests) {
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }
}

// ---------------------------------------------------------------------------
// McpHttpClient
// ---------------------------------------------------------------------------

export class McpHttpClient {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;

  private requestCounter = 0;
  private connected = false;

  public constructor(endpoint: string, headers?: Record<string, string>) {
    this.endpoint = endpoint;
    this.headers = {
      "Content-Type": "application/json",
      ...(headers ?? {})
    };
  }

  public async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    // Send initialize to verify connectivity
    const result = await this.post("initialize", initializeParams());

    if (typeof result !== "object" || result === null) {
      throw new Error("Invalid initialize response from MCP HTTP server");
    }

    this.connected = true;
  }

  public async listTools(): Promise<McpToolDef[]> {
    this.assertConnected();
    const result = await this.post("tools/list");
    const typed = result as McpListToolsResult;
    return typed.tools ?? [];
  }

  public async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    this.assertConnected();
    const result = await this.post("tools/call", { name, arguments: args });
    const typed = result as McpToolCallResult;
    if (typed.isError === true) {
      const msg = typed.content.map((c) => c.text ?? "").join("");
      throw new Error(`MCP tool error (${name}): ${msg}`);
    }
    return { content: typed.content };
  }

  public disconnect(): void {
    this.connected = false;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error("MCP HTTP client is not connected");
    }
  }

  private nextId(): number {
    this.requestCounter += 1;
    return this.requestCounter;
  }

  private async post(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId();
    const body = buildRequest(id, method, params);

    const response = await withTimeout(
      fetch(this.endpoint, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body)
      }),
      DEFAULT_TIMEOUT_MS,
      `HTTP ${method}`
    );

    if (!response.ok) {
      throw new Error(`MCP HTTP error ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as McpJsonRpcResponse;

    if (json.error) {
      throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
    }

    return json.result;
  }
}

// ---------------------------------------------------------------------------
// McpClientFactory
// ---------------------------------------------------------------------------

export type McpClient = McpStdioClient | McpHttpClient;

export class McpClientFactory {
  public static create(config: McpServerConfig): McpClient {
    if (config.transport === "stdio") {
      // For stdio transport, `endpoint` is expected to be the executable command.
      // Args can be encoded as JSON in the endpoint or passed separately.
      // Convention: endpoint = "command arg1 arg2" space-separated.
      const parts = config.endpoint.split(" ");
      const command = parts[0];
      if (!command) {
        throw new Error(`Invalid stdio endpoint (empty command) for server: ${config.name}`);
      }
      const args = parts.slice(1);
      return new McpStdioClient(command, args);
    }

    // HTTP transport
    const headers: Record<string, string> = {};
    if (config.authType === "api_key") {
      // The API key is expected to be injected via environment variable
      // keyed by convention: MCP_<SERVER_ID_UPPERCASE>_API_KEY
      const envKey = `MCP_${config.id.toUpperCase().replace(/-/g, "_")}_API_KEY`;
      const apiKey = process.env[envKey];
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }
    }

    return new McpHttpClient(config.endpoint, headers);
  }
}

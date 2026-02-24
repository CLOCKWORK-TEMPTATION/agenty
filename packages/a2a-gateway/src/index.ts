import type {
  A2ATaskRequest,
  A2ATaskResult,
  AgentCard,
} from "@repo/types";

// ============================================================================
// A2A Federation Gateway - Real Implementation
// ============================================================================

export interface A2AGatewayConfig {
  /** Timeout for agent requests in milliseconds (default: 30000) */
  requestTimeoutMs?: number;
  /** Maximum retries for failed requests (default: 3) */
  maxRetries?: number;
  /** Enable health checking for remote agents (default: true) */
  enableHealthCheck?: boolean;
  /** Health check interval in milliseconds (default: 60000) */
  healthCheckIntervalMs?: number;
  /** Callback for task status updates */
  onTaskStatusChange?: (taskId: string, status: A2ATaskStatus) => void;
}

export type A2ATaskStatus =
  | "pending"
  | "routing"
  | "accepted"
  | "in_progress"
  | "completed"
  | "failed"
  | "timeout"
  | "rejected";

export interface A2ATaskState {
  request: A2ATaskRequest;
  status: A2ATaskStatus;
  createdAt: Date;
  updatedAt: Date;
  attempts: number;
  result?: A2ATaskResult;
  error?: string;
  routedTo?: string;
  completedAt?: Date;
}

export interface A2AAgentHealth {
  agentId: string;
  healthy: boolean;
  lastChecked: Date;
  latencyMs: number;
  error?: string;
  consecutiveFailures: number;
}

export interface A2ARoutingDecision {
  targetAgent: string;
  endpoint: string;
  strategy: "direct" | "round_robin" | "capability_match" | "least_load";
  reason: string;
}

export interface A2AFederationError {
  code:
    | "AGENT_UNREACHABLE"
    | "AGENT_REJECTED"
    | "TIMEOUT"
    | "INVALID_RESPONSE"
    | "ROUTING_FAILED"
    | "AGENT_UNHEALTHY"
    | "UNKNOWN_ERROR";
  message: string;
  retryable: boolean;
  targetAgent?: string;
}

export interface A2AStreamingUpdate {
  type: "status" | "progress" | "error" | "completed";
  taskId: string;
  status?: A2ATaskStatus;
  targetAgent?: string;
  result?: A2ATaskResult;
  error?: string;
  retryable?: boolean;
  timestamp: string;
  [key: string]: unknown;
}

// ============================================================================
// Remote Agent HTTP Client
// ============================================================================

interface RemoteAgentOptions {
  timeoutMs: number;
  authToken?: string | undefined;
  customHeaders?: Record<string, string> | undefined;
}

class RemoteAgentClient {
  public readonly card: AgentCard;
  private readonly options: RemoteAgentOptions;
  private abortControllers = new Map<string, AbortController>();

  public constructor(card: AgentCard, options: RemoteAgentOptions) {
    this.card = card;
    this.options = options;
  }

  public async sendTask(
    request: A2ATaskRequest,
    onStreamUpdate?: (update: Record<string, unknown>) => void
  ): Promise<A2ATaskResult> {
    const abortController = new AbortController();
    this.abortControllers.set(request.requestId, abortController);

    const timeout = setTimeout(() => {
      abortController.abort();
    }, this.options.timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...this.options.customHeaders
      };

      if (this.options.authToken) {
        headers["Authorization"] = `Bearer ${this.options.authToken}`;
      }

      const response = await fetch(this.card.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        signal: abortController.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${errorText}`
        );
      }

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        return this.handleStreamingResponse(
          response,
          request.requestId,
          onStreamUpdate
        );
      }

      const result = (await response.json()) as A2ATaskResult;
      return result;
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.options.timeoutMs}ms`);
      }
      throw error;
    } finally {
      this.abortControllers.delete(request.requestId);
    }
  }

  public async cancelTask(taskId: string): Promise<void> {
    const abortController = this.abortControllers.get(taskId);
    if (abortController) {
      abortController.abort();
    }

    try {
      const cancelEndpoint = `${this.card.endpoint}/cancel`;
      await fetch(cancelEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.options.authToken && {
            Authorization: `Bearer ${this.options.authToken}`
          })
        },
        body: JSON.stringify({ taskId })
      });
    } catch {
      // Ignore cancel errors
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const healthEndpoint = this.card.endpoint.replace(/\/tasks$/, "/health");
      const response = await fetch(healthEndpoint, {
        method: "GET",
        headers: {
          ...(this.options.authToken && {
            Authorization: `Bearer ${this.options.authToken}`
          })
        }
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private async handleStreamingResponse(
    response: Response,
    taskId: string,
    onUpdate?: (update: Record<string, unknown>) => void
  ): Promise<A2ATaskResult> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body available");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: A2ATaskResult | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const update = JSON.parse(data) as Record<string, unknown>;
              if (update.type === "completed" && update.result) {
                finalResult = update.result as A2ATaskResult;
              }
              if (onUpdate) {
                onUpdate(update);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return finalResult ?? {
      requestId: taskId,
      status: "accepted",
      output: { message: "Task accepted, streaming updates completed" }
    };
  }

  public dispose(): void {
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }
}

// ============================================================================
// A2A Gateway - Federation Implementation
// ============================================================================

export class A2AGateway {
  private readonly localCards = new Map<string, AgentCard>();
  private readonly remoteAgents = new Map<string, RemoteAgentClient>();
  private readonly taskStates = new Map<string, A2ATaskState>();
  private readonly agentHealth = new Map<string, A2AAgentHealth>();
  private readonly config: Required<A2AGatewayConfig>;
  private healthCheckTimer?: NodeJS.Timeout;
  private roundRobinIndex = 0;

  public constructor(config: A2AGatewayConfig = {}) {
    this.config = {
      requestTimeoutMs: config.requestTimeoutMs ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      enableHealthCheck: config.enableHealthCheck ?? true,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? 60000,
      onTaskStatusChange: config.onTaskStatusChange ?? (() => {})
    };

    if (this.config.enableHealthCheck) {
      this.startHealthChecks();
    }
  }

  public registerCard(card: AgentCard): void {
    this.localCards.set(card.id, card);
  }

  public unregisterCard(agentId: string): boolean {
    const removed = this.localCards.delete(agentId);
    this.remoteAgents.delete(agentId);
    this.agentHealth.delete(agentId);
    return removed;
  }

  public registerRemoteAgent(
    card: AgentCard,
    options?: {
      authToken?: string | undefined;
      customHeaders?: Record<string, string> | undefined;
    }
  ): void {
    this.remoteAgents.set(
      card.id,
      new RemoteAgentClient(card, {
        timeoutMs: this.config.requestTimeoutMs,
        authToken: options?.authToken,
        customHeaders: options?.customHeaders
      })
    );

    this.agentHealth.set(card.id, {
      agentId: card.id,
      healthy: true,
      lastChecked: new Date(),
      latencyMs: 0,
      consecutiveFailures: 0
    });
  }

  public listCards(): AgentCard[] {
    const allCards = new Map<string, AgentCard>();

    for (const [id, card] of this.localCards) {
      allCards.set(id, card);
    }

    for (const [id, client] of this.remoteAgents) {
      allCards.set(id, client.card);
    }

    return Array.from(allCards.values());
  }

  public findAgentsByCapability(capability: string): AgentCard[] {
    return this.listCards().filter(
      card => card.capabilities.includes(capability)
    );
  }

  public getAgentHealth(agentId: string): A2AAgentHealth | undefined {
    return this.agentHealth.get(agentId);
  }

  public getAllAgentHealth(): A2AAgentHealth[] {
    return Array.from(this.agentHealth.values());
  }

  public async submitTask(input: A2ATaskRequest): Promise<A2ATaskResult> {
    const taskId = input.requestId;

    const taskState: A2ATaskState = {
      request: input,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0
    };
    this.taskStates.set(taskId, taskState);

    try {
      const routing = await this.determineRouting(input);

      if (!routing) {
        const error: A2AFederationError = {
          code: "ROUTING_FAILED",
          message: `No available agent found for target: ${input.targetAgent}`,
          retryable: false
        };
        return this.createErrorResult(taskId, error);
      }

      taskState.status = "routing";
      taskState.routedTo = routing.targetAgent;
      this.updateTaskState(taskId, taskState);

      const result = await this.executeTaskWithRetries(taskId, input, routing);

      taskState.result = result;
      taskState.status = result.status === "failed" ? "failed" : "completed";
      taskState.completedAt = new Date();
      this.updateTaskState(taskId, taskState);

      return result;
    } catch (error) {
      const federationError = this.normalizeError(error);
      return this.createErrorResult(taskId, federationError);
    }
  }

  public async submitTaskStreaming(
    input: A2ATaskRequest,
    onUpdate: (update: A2AStreamingUpdate) => void
  ): Promise<A2ATaskResult> {
    const taskId = input.requestId;

    onUpdate({
      type: "status",
      taskId,
      status: "pending",
      timestamp: new Date().toISOString()
    });

    const routing = await this.determineRouting(input);

    if (!routing) {
      const error: A2AFederationError = {
        code: "ROUTING_FAILED",
        message: `No available agent found for target: ${input.targetAgent}`,
        retryable: false
      };
      onUpdate({
        type: "error",
        taskId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return this.createErrorResult(taskId, error);
    }

    onUpdate({
      type: "status",
      taskId,
      status: "routing",
      targetAgent: routing.targetAgent,
      timestamp: new Date().toISOString()
    });

    const client = this.getAgentClient(routing.targetAgent);

    if (!client) {
      const error: A2AFederationError = {
        code: "AGENT_UNREACHABLE",
        message: `Agent ${routing.targetAgent} not found`,
        retryable: false,
        targetAgent: routing.targetAgent
      };
      onUpdate({
        type: "error",
        taskId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      return this.createErrorResult(taskId, error);
    }

    try {
      onUpdate({
        type: "status",
        taskId,
        status: "in_progress",
        timestamp: new Date().toISOString()
      });

      const result = await client.sendTask(input, update => {
        onUpdate({
          type: "progress",
          taskId,
          ...update,
          timestamp: new Date().toISOString()
        });
      });

      onUpdate({
        type: "completed",
        taskId,
        result,
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      const fedError = this.normalizeError(error);
      onUpdate({
        type: "error",
        taskId,
        error: fedError.message,
        retryable: fedError.retryable,
        timestamp: new Date().toISOString()
      });
      return this.createErrorResult(taskId, fedError);
    }
  }

  public getTaskStatus(taskId: string): A2ATaskState | undefined {
    return this.taskStates.get(taskId);
  }

  public async cancelTask(taskId: string): Promise<boolean> {
    const task = this.taskStates.get(taskId);
    if (!task) return false;

    if (task.status === "completed" || task.status === "failed") {
      return false;
    }

    task.status = "rejected";
    task.updatedAt = new Date();
    task.error = "Cancelled by user";
    this.taskStates.set(taskId, task);

    if (task.routedTo && this.remoteAgents.has(task.routedTo)) {
      const client = this.remoteAgents.get(task.routedTo)!;
      try {
        await client.cancelTask(taskId);
      } catch {
        // Ignore
      }
    }

    return true;
  }

  private async determineRouting(
    input: A2ATaskRequest
  ): Promise<A2ARoutingDecision | null> {
    const targetId = input.targetAgent;

    const directAgent = this.getAgentClient(targetId);
    if (directAgent && this.isAgentHealthy(targetId)) {
      return {
        targetAgent: targetId,
        endpoint: directAgent.card.endpoint,
        strategy: "direct",
        reason: "Direct target match"
      };
    }

    const payloadCapabilities = this.extractCapabilities(input.payload);
    const matchingAgents = this.findAgentsByCapabilities(
      payloadCapabilities
    ).filter(id => this.isAgentHealthy(id));

    if (matchingAgents.length > 0) {
      const selected = matchingAgents[this.roundRobinIndex % matchingAgents.length]!;
      this.roundRobinIndex++;

      const client = this.getAgentClient(selected)!;
      return {
        targetAgent: selected,
        endpoint: client.card.endpoint,
        strategy: "capability_match",
        reason: `Capability match: ${payloadCapabilities.join(", ")}`
      };
    }

    const healthyAgents = this.listHealthyAgents();
    if (healthyAgents.length > 0) {
      const fallback = healthyAgents[0]!;
      const client = this.getAgentClient(fallback)!;
      return {
        targetAgent: fallback,
        endpoint: client.card.endpoint,
        strategy: "least_load",
        reason: "Fallback to available agent"
      };
    }

    return null;
  }

  private extractCapabilities(payload: Record<string, unknown>): string[] {
    const capabilities: string[] = [];

    if (payload.domain) {
      capabilities.push(String(payload.domain));
    }
    if (payload.taskType) {
      capabilities.push(String(payload.taskType));
    }
    if (payload.requiredSkills && Array.isArray(payload.requiredSkills)) {
      capabilities.push(...payload.requiredSkills.map(String));
    }

    return capabilities.length > 0 ? capabilities : ["general"];
  }

  private findAgentsByCapabilities(capabilities: string[]): string[] {
    const matches: string[] = [];

    for (const [id, card] of this.localCards) {
      if (capabilities.some(c => card.capabilities.includes(c))) {
        matches.push(id);
      }
    }

    for (const [id, client] of this.remoteAgents) {
      if (capabilities.some(c => client.card.capabilities.includes(c))) {
        matches.push(id);
      }
    }

    return matches;
  }

  private listHealthyAgents(): string[] {
    const healthy: string[] = [];

    for (const [id, health] of this.agentHealth) {
      if (health.healthy) {
        healthy.push(id);
      }
    }

    for (const id of this.localCards.keys()) {
      if (!this.agentHealth.has(id)) {
        healthy.push(id);
      }
    }

    return healthy;
  }

  private isAgentHealthy(agentId: string): boolean {
    if (this.localCards.has(agentId) && !this.remoteAgents.has(agentId)) {
      return true;
    }

    const health = this.agentHealth.get(agentId);
    return health?.healthy ?? false;
  }

  private getAgentClient(agentId: string): RemoteAgentClient | undefined {
    if (this.remoteAgents.has(agentId)) {
      return this.remoteAgents.get(agentId);
    }
    return undefined;
  }

  private async executeTaskWithRetries(
    taskId: string,
    input: A2ATaskRequest,
    routing: A2ARoutingDecision
  ): Promise<A2ATaskResult> {
    let lastError: A2AFederationError | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      const taskState = this.taskStates.get(taskId)!;
      taskState.attempts = attempt + 1;
      taskState.status = attempt === 0 ? "accepted" : "in_progress";
      this.updateTaskState(taskId, taskState);

      try {
        if ((taskState.status as string) === "rejected") {
          return {
            requestId: taskId,
            status: "failed",
            error: "Task was cancelled"
          };
        }

        if (this.localCards.has(routing.targetAgent)) {
          return await this.executeLocalTask(input, routing.targetAgent);
        } else {
          const client = this.remoteAgents.get(routing.targetAgent);
          if (!client) {
            throw new Error(`Remote agent ${routing.targetAgent} not found`);
          }

          const result = await client.sendTask(input);

          if (result.status !== "failed") {
            return result;
          }

          lastError = {
            code: "AGENT_REJECTED",
            message: result.error ?? "Agent returned failure",
            retryable: attempt < this.config.maxRetries - 1,
            targetAgent: routing.targetAgent
          };
        }
      } catch (error) {
        lastError = this.normalizeError(error);
        lastError.targetAgent = routing.targetAgent;

        if (!lastError.retryable) {
          break;
        }

        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await this.sleep(delay);
      }
    }

    return this.createErrorResult(
      taskId,
      lastError ?? {
        code: "UNKNOWN_ERROR",
        message: "Task failed after all retries",
        retryable: false,
        targetAgent: routing.targetAgent
      }
    );
  }

  private async executeLocalTask(
    input: A2ATaskRequest,
    agentId: string
  ): Promise<A2ATaskResult> {
    return {
      requestId: input.requestId,
      status: "accepted",
      output: {
        message: `Task accepted by local agent ${agentId}`,
        agentId,
        requiresLocalExecution: true
      }
    };
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.runHealthChecks();
    }, this.config.healthCheckIntervalMs);
  }

  private async runHealthChecks(): Promise<void> {
    for (const [agentId, client] of this.remoteAgents) {
      const startTime = Date.now();

      try {
        const healthy = await client.healthCheck();
        const latency = Date.now() - startTime;

        const currentHealth = this.agentHealth.get(agentId);
        const consecutiveFailures = healthy
          ? 0
          : (currentHealth?.consecutiveFailures ?? 0) + 1;

        this.agentHealth.set(agentId, {
          agentId,
          healthy,
          lastChecked: new Date(),
          latencyMs: latency,
          consecutiveFailures
        });
      } catch {
        const currentHealth = this.agentHealth.get(agentId);
        this.agentHealth.set(agentId, {
          agentId,
          healthy: false,
          lastChecked: new Date(),
          latencyMs: Date.now() - startTime,
          consecutiveFailures: (currentHealth?.consecutiveFailures ?? 0) + 1,
          error: "Health check failed"
        });
      }
    }
  }

  private updateTaskState(taskId: string, state: A2ATaskState): void {
    state.updatedAt = new Date();
    this.taskStates.set(taskId, state);
    this.config.onTaskStatusChange(taskId, state.status);
  }

  private normalizeError(error: unknown): A2AFederationError {
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        return {
          code: "TIMEOUT",
          message: error.message,
          retryable: true
        };
      }
      if (error.message.includes("ECONNREFUSED")) {
        return {
          code: "AGENT_UNREACHABLE",
          message: error.message,
          retryable: true
        };
      }
      return {
        code: "UNKNOWN_ERROR",
        message: error.message,
        retryable: false
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      message: String(error),
      retryable: false
    };
  }

  private createErrorResult(
    taskId: string,
    error: A2AFederationError
  ): A2ATaskResult {
    return {
      requestId: taskId,
      status: "failed",
      error: `[${error.code}] ${error.message}`
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    for (const client of this.remoteAgents.values()) {
      client.dispose();
    }

    this.remoteAgents.clear();
    this.localCards.clear();
    this.taskStates.clear();
    this.agentHealth.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export interface CreateA2AGatewayOptions {
  config?: A2AGatewayConfig;
  remoteAgents?: Array<{
    card: AgentCard;
    authToken?: string | undefined;
    customHeaders?: Record<string, string> | undefined;
  }>;
}

export function createA2AGateway(options: CreateA2AGatewayOptions = {}): A2AGateway {
  const gateway = new A2AGateway(options.config);

  if (options.remoteAgents) {
    for (const agent of options.remoteAgents) {
      gateway.registerRemoteAgent(agent.card, {
        authToken: agent.authToken,
        customHeaders: agent.customHeaders
      });
    }
  }

  return gateway;
}

export function createDefaultGateway(): A2AGateway {
  return createA2AGateway({
    config: {
      requestTimeoutMs: 30000,
      maxRetries: 3,
      enableHealthCheck: true,
      healthCheckIntervalMs: 60000
    }
  });
}

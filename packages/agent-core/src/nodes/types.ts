export interface ExecutionPlan {
  steps: ExecutionStep[];
  parallelGroups: string[][];
  estimatedDuration: number;
}

export interface ExecutionStep {
  id: string;
  roleId: string;
  action: string;
  requiredTools: string[];
  dependencies: string[];
}

export interface SpecialistResult {
  roleId: string;
  agentId: string;
  output: Record<string, unknown>;
  toolsUsed: string[];
  completedAt: string;
}

export interface ToolExecutionResult {
  roleId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: "completed" | "failed";
  executedAt: string;
}

export interface NodeDependencies {
  modelCatalog: import("@repo/types").ModelProfile[];
  skillRegistry: import("@repo/skills-engine").SkillRegistry;
  toolBroker: import("@repo/tool-broker").ToolBroker;
}

export interface LiteLLMClient {
  chat: (params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
  }) => Promise<{ content: string }>;
}

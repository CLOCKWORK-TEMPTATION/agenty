export type TaskDomain = "coding" | "research" | "content" | "data" | "operations";
export type RunStatus = "draft" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";
export type ApprovalMode = "approval" | "auto";
export type RbacRole = "owner" | "admin" | "operator" | "viewer";

export interface TaskRequest {
  projectId: string;
  userId: string;
  title: string;
  description: string;
  domain: TaskDomain;
  language?: string;
  approvalMode: ApprovalMode;
  metadata?: Record<string, unknown>;
}

export interface TaskProfile {
  complexity: "low" | "medium" | "high";
  requiredCapabilities: string[];
  riskLevel: "low" | "medium" | "high";
}

export interface TeamTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  domains: TaskDomain[];
  roles: RoleBlueprint[];
}

export interface RoleBlueprint {
  id: string;
  name: string;
  objective: string;
  requiredCapabilities: string[];
  sensitiveTools?: boolean;
}

export interface RoleAssignment {
  roleId: string;
  agentId: string;
  model: string;
  tools: string[];
  skills: string[];
}

export interface TeamDesign {
  id?: string;
  template_id?: string;
  name?: string;
  description?: string;
  domain?: TaskDomain;
  roles: Array<{
    name: string;
    description: string;
    model_id: string;
    tools: string[];
    skills: string[];
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface ModelProfile {
  id: string;
  provider: string;
  quality: number;
  toolReliability: number;
  capabilityFit: number;
  latencyReliability: number;
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  maxContextTokens: number;
  languages: string[];
}

export interface ModelDecision {
  roleId: string;
  selectedModel: string;
  score: number;
  candidates: Array<{ model: string; score: number }>;
  fallbackChain: string[];
}

export interface ToolPolicy {
  toolName: string;
  sensitive: boolean;
  requiresApproval: boolean;
  allowedRoles: RbacRole[];
}

export interface SkillActivation {
  skillId: string;
  roleId: string;
  reason: string;
  loadedFullDefinition: boolean;
}

export interface VerificationResult {
  passed: boolean;
  issues: string[];
  score: number;
}

export interface RevisionDecision {
  shouldRevise: boolean;
  reason: string;
  iteration: number;
}

export interface ArtifactMeta {
  id: string;
  runId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "http";
  endpoint: string;
  authType: "none" | "api_key" | "oauth";
  enabled: boolean;
}

export interface McpToolDescriptor {
  id: string;
  serverId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  sensitive: boolean;
}

export interface ToolExecutionTrace {
  runId: string;
  roleId: string;
  toolName: string;
  status: "started" | "completed" | "failed";
  startedAt: string;
  endedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface A2ATaskRequest {
  requestId: string;
  sourceAgent: string;
  targetAgent: string;
  objective: string;
  payload: Record<string, unknown>;
}

export interface A2ATaskResult {
  requestId: string;
  status: "accepted" | "completed" | "failed";
  output?: Record<string, unknown>;
  error?: string;
}

export interface AgentCard {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  endpoint: string;
}

export interface SecurityContext {
  userId: string;
  roles: RbacRole[];
  projectId: string;
  ipAddress?: string;
}

export interface PermissionMatrix {
  action: string;
  roles: RbacRole[];
}

export interface AuditEvent {
  eventId: string;
  actorId: string;
  action: string;
  resource: string;
  outcome: "allow" | "deny";
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationThread {
  id: string;
  runId: string;
  title: string;
  createdAt: string;
}

export interface MessageEnvelope {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ContextSnapshot {
  runId: string;
  state: Record<string, unknown>;
  checkpointAt: string;
}

export interface RunState {
  runId: string;
  status: RunStatus;
  request: TaskRequest;
  profile?: TaskProfile;
  assignments: RoleAssignment[];
  events: string[];
  revisionCount: number;
  verification?: VerificationResult;
  artifacts: ArtifactMeta[];
  updatedAt: string;
}

export interface ApiErrorShape {
  error_code: string;
  message: string;
  retryable: boolean;
  trace_id: string;
  details?: Record<string, unknown> | undefined;
}

export class AppError extends Error {
  public readonly errorCode: string;
  public readonly retryable: boolean;
  public readonly traceId: string;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(args: {
    message: string;
    errorCode: string;
    retryable: boolean;
    traceId: string;
    statusCode?: number;
    details?: Record<string, unknown>;
  }) {
    super(args.message);
    this.name = "AppError";
    this.errorCode = args.errorCode;
    this.retryable = args.retryable;
    this.traceId = args.traceId;
    this.statusCode = args.statusCode ?? 500;
    this.details = args.details;
  }

  public toApiError(): ApiErrorShape {
    const base: ApiErrorShape = {
      error_code: this.errorCode,
      message: this.message,
      retryable: this.retryable,
      trace_id: this.traceId
    };
    if (this.details) {
      base.details = this.details;
    }
    return base;
  }
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  trace_id: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
}

// Template Marketplace Types
export interface TemplateRating {
  id: string;
  templateId: string;
  userId: string;
  rating: number; // 1-5
  review?: string;
  createdAt: string;
}

export interface TemplateInstallation {
  id: string;
  templateId: string;
  userId: string;
  projectId: string;
  installedAt: string;
  version: string;
}

export interface TemplatePublishRequest {
  templateId: string;
  publisherId: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface MarketplaceTemplate extends TeamTemplate {
  publisherId: string;
  publisherName: string;
  isPublished: boolean;
  isApproved: boolean;
  averageRating: number;
  ratingCount: number;
  installCount: number;
  publishedAt?: string;
}

// MCP Server Onboarding Types
export interface McpServerOnboardingStep {
  id: string;
  title: string;
  description: string;
  fields: McpOnboardingField[];
}

export interface McpOnboardingField {
  name: string;
  label: string;
  type: "text" | "password" | "select" | "checkbox" | "url";
  required: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  helpText?: string;
}

export interface McpServerWizardState {
  step: number;
  config: Partial<McpServerConfig>;
  testResult?: McpTestResult;
}

export interface McpTestResult {
  success: boolean;
  message: string;
  toolsDetected?: number;
  errors?: string[];
}

// Hierarchical Orchestration Types
export interface HierarchicalTeam {
  id: string;
  parentTeamId?: string;
  childTeamIds: string[];
  level: number;
  delegationRules: DelegationRule[];
}

export interface DelegationRule {
  id: string;
  condition: string;
  targetTeamId: string;
  priority: number;
  enabled: boolean;
}

export interface SubTaskRequest {
  parentTaskId: string;
  subTask: TaskRequest;
  assignedToTeamId: string;
}

export interface TeamHierarchyResult {
  teamId: string;
  subTasks: SubTaskRequest[];
  aggregatedResults: Record<string, unknown>;
}

// Notion Integration Types
export interface NotionOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name?: string;
  workspace_icon?: string;
  owner?: {
    type: "user";
    user: {
      id: string;
      name?: string;
      avatar_url?: string;
      type: "person" | "bot";
    };
  };
}

export interface NotionPage {
  id: string;
  url: string;
  title: string;
  created_time: string;
  last_edited_time: string;
  parent?: {
    type: string;
    database_id?: string;
    page_id?: string;
  };
}

export interface NotionDatabase {
  id: string;
  url: string;
  title: string;
  description?: string;
  properties: Record<string, unknown>;
}

// Jira Integration Types
export interface JiraOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  cloudId?: string;
}

export interface JiraTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      id: string;
      name: string;
    };
    issuetype: {
      id: string;
      name: string;
    };
    priority?: {
      id: string;
      name: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
    };
    created: string;
    updated: string;
  };
}

export interface JiraCreateIssueRequest {
  projectKey: string;
  summary: string;
  description?: string;
  issueType: string;
  priority?: string;
  assignee?: string;
}

export interface JiraStatusTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

// LiteLLM Client Types
export type LiteLLMProvider = "anthropic" | "openai" | "google" | "azure" | "bedrock";

export interface LiteLLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
  name?: string;
  tool_calls?: LiteLLMToolCall[];
  tool_call_id?: string;
}

export interface LiteLLMToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LiteLLMTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LiteLLMRequestOptions {
  model: string;
  messages: LiteLLMMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: LiteLLMTool[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  response_format?: { type: "json_object" | "text" };
  user?: string;
  metadata?: Record<string, unknown>;
}

export interface LiteLLMResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: LiteLLMMessage;
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LiteLLMStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
}

export interface LiteLLMRoutingPool {
  poolId: string;
  models: string[];
  routingStrategy: "round-robin" | "quality-first" | "latency-based";
  fallbackEnabled: boolean;
  maxRetries: number;
}

export interface LiteLLMClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  defaultRoutingPool?: LiteLLMRoutingPool;
}

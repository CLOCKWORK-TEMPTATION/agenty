import type {
  ModelDecision,
  RoleAssignment,
  RoleBlueprint,
  RunState,
  TaskProfile,
  TaskRequest,
  TeamTemplate,
  VerificationResult
} from "@repo/types";
import type { ModelProfile } from "@repo/types";
import {
  Annotation,
  Command,
  END,
  MemorySaver,
  START,
  StateGraph,
  isInterrupted
} from "@langchain/langgraph";
import type { SkillRegistry } from "@repo/skills-engine";
import type { ToolBroker } from "@repo/tool-broker";
import {
  intakeNode,
  profileNode,
  templateSelectNode,
  teamDesignNode,
  createModelRouteNode,
  createToolsAllocateNode,
  createSkillsLoadNode,
  approvalGateNode,
  createPlannerNode,
  createSpecialistsParallelNode,
  createToolExecutorNode,
  createAggregateNode,
  createVerifierNode,
  createHumanFeedbackNode,
  finalizerNode
} from "./nodes/index.js";
import type {
  ExecutionPlan,
  SpecialistResult,
  ToolExecutionResult
} from "./nodes/index.js";

export const EXECUTION_GRAPH = [
  "START",
  "intake",
  "profile",
  "template_select",
  "team_design",
  "model_route",
  "tools_allocate",
  "skills_load",
  "approval_gate",
  "planner",
  "specialists_parallel",
  "tool_executor",
  "aggregate",
  "verifier",
  "human_feedback(optional)",
  "finalizer",
  "END"
] as const;

export interface OrchestratorDependencies {
  modelCatalog: ModelProfile[];
  skillRegistry: SkillRegistry;
  toolBroker: ToolBroker;
}

export interface RunResult {
  state: RunState;
  workflow: string[];
}

const OrchestratorState = Annotation.Root({
  runId: Annotation<string>(),
  request: Annotation<TaskRequest>(),
  template: Annotation<TeamTemplate>(),
  roles: Annotation<RoleBlueprint[]>(),
  profile: Annotation<TaskProfile | undefined>(),
  modelDecisions: Annotation<ModelDecision[]>(),
  assignments: Annotation<RoleAssignment[]>(),
  events: Annotation<string[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  revisionCount: Annotation<number>(),
  verification: Annotation<VerificationResult | undefined>(),
  status: Annotation<RunState["status"]>(),
  approvalGranted: Annotation<boolean>(),
  executionPlan: Annotation<ExecutionPlan | undefined>(),
  specialistResults: Annotation<SpecialistResult[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  toolExecutionResults: Annotation<ToolExecutionResult[]>({
    reducer: (left, right) => left.concat(right),
    default: () => []
  }),
  aggregatedOutput: Annotation<Record<string, unknown> | undefined>()
});

type OrchestratorStateShape = typeof OrchestratorState.State;

interface CompiledOrchestratorGraph {
  invoke(input: unknown, options?: { configurable?: Record<string, unknown> }): Promise<unknown>;
}

export class AgentOrchestrator {
  private readonly modelCatalog: ModelProfile[];
  private readonly skillRegistry: SkillRegistry;
  private readonly toolBroker: ToolBroker;
  private readonly graph: CompiledOrchestratorGraph;

  public constructor(deps: OrchestratorDependencies) {
    this.modelCatalog = deps.modelCatalog;
    this.skillRegistry = deps.skillRegistry;
    this.toolBroker = deps.toolBroker;
    this.graph = this.buildGraph();
  }

  public async run(request: TaskRequest, template: TeamTemplate): Promise<RunResult> {
    const runId = `run_${Date.now()}`;
    const result = await this.graph.invoke(
      {
        runId,
        request,
        template,
        roles: [],
        profile: undefined,
        modelDecisions: [],
        assignments: [],
        events: [],
        revisionCount: 0,
        verification: undefined,
        status: "running",
        approvalGranted: request.approvalMode === "auto",
        executionPlan: undefined,
        specialistResults: [],
        toolExecutionResults: [],
        aggregatedOutput: undefined
      },
      {
        configurable: {
          thread_id: runId
        }
      }
    );

    const state = this.toRunState(result, runId, request);
    if (isInterrupted(result)) {
      state.status = "waiting_approval";
      state.events.push("human_feedback.interrupted");
      state.updatedAt = new Date().toISOString();
    }

    return { state, workflow: [...EXECUTION_GRAPH] };
  }

  public async resume(
    runId: string,
    resumeValue: { approved: boolean; feedback?: string },
    requestFallback: TaskRequest
  ): Promise<RunResult> {
    const result = await this.graph.invoke(new Command({ resume: resumeValue }), {
      configurable: {
        thread_id: runId
      }
    });
    const state = this.toRunState(result, runId, requestFallback);
    return {
      state,
      workflow: [...EXECUTION_GRAPH]
    };
  }


  private buildGraph() {
    const modelRouteNode = createModelRouteNode({ modelCatalog: this.modelCatalog });
    const toolsAllocateNode = createToolsAllocateNode({ toolBroker: this.toolBroker });
    const skillsLoadNode = createSkillsLoadNode({ skillRegistry: this.skillRegistry });
    const plannerNode = createPlannerNode();
    const specialistsParallelNode = createSpecialistsParallelNode();
    const toolExecutorNode = createToolExecutorNode({ toolBroker: this.toolBroker });
    const aggregateNode = createAggregateNode();
    const verifierNode = createVerifierNode();
    const humanFeedbackNode = createHumanFeedbackNode({ toolBroker: this.toolBroker });

    return new StateGraph(OrchestratorState)
      .addNode("intake", intakeNode)
      .addNode("profile_step", profileNode)
      .addNode("template_select", templateSelectNode)
      .addNode("team_design", teamDesignNode)
      .addNode("model_route", modelRouteNode)
      .addNode("tools_allocate", toolsAllocateNode)
      .addNode("skills_load", skillsLoadNode)
      .addNode("approval_gate", approvalGateNode)
      .addNode("human_feedback", humanFeedbackNode)
      .addNode("planner", plannerNode)
      .addNode("specialists_parallel", specialistsParallelNode)
      .addNode("tool_executor", toolExecutorNode)
      .addNode("aggregate", aggregateNode)
      .addNode("verifier", verifierNode)
      .addNode("finalizer", finalizerNode)
      .addEdge(START, "intake")
      .addEdge("intake", "profile_step")
      .addEdge("profile_step", "template_select")
      .addEdge("template_select", "team_design")
      .addEdge("team_design", "model_route")
      .addEdge("model_route", "tools_allocate")
      .addEdge("tools_allocate", "skills_load")
      .addEdge("skills_load", "approval_gate")
      .addConditionalEdges("approval_gate", this.routeAfterApprovalGate.bind(this), [
        "planner",
        "human_feedback"
      ])
      .addConditionalEdges("human_feedback", this.routeAfterHumanFeedback.bind(this), [
        "planner",
        "finalizer"
      ])
      .addEdge("planner", "specialists_parallel")
      .addEdge("specialists_parallel", "tool_executor")
      .addEdge("tool_executor", "aggregate")
      .addEdge("aggregate", "verifier")
      .addConditionalEdges("verifier", this.routeAfterVerifier.bind(this), ["planner", "finalizer"])
      .addEdge("finalizer", END)
      .compile({
        checkpointer: new MemorySaver()
      });
  }


  private routeAfterApprovalGate(state: OrchestratorStateShape): "planner" | "human_feedback" {
    return state.request.approvalMode === "approval" ? "human_feedback" : "planner";
  }

  private routeAfterHumanFeedback(state: OrchestratorStateShape): "planner" | "finalizer" {
    return state.approvalGranted ? "planner" : "finalizer";
  }

  private routeAfterVerifier(state: OrchestratorStateShape): "planner" | "finalizer" {
    if (state.verification?.passed) {
      return "finalizer";
    }
    if (state.revisionCount >= 2) {
      return "finalizer";
    }
    return "planner";
  }

  private toRunState(rawState: unknown, runIdFallback: string, requestFallback: TaskRequest): RunState {
    const state = rawState as Partial<OrchestratorStateShape>;
    const result: RunState = {
      runId: typeof state.runId === "string" ? state.runId : runIdFallback,
      status: this.normalizeRunStatus(state.status),
      request: state.request ?? requestFallback,
      assignments: Array.isArray(state.assignments) ? state.assignments : [],
      events: Array.isArray(state.events) ? state.events : [],
      revisionCount: typeof state.revisionCount === "number" ? state.revisionCount : 0,
      artifacts: [],
      updatedAt: new Date().toISOString()
    };
    if (state.profile) {
      result.profile = state.profile;
    }
    if (state.verification) {
      result.verification = state.verification;
    }
    return result;
  }

  private normalizeRunStatus(status: unknown): RunState["status"] {
    if (
      status === "draft" ||
      status === "running" ||
      status === "waiting_approval" ||
      status === "completed" ||
      status === "failed" ||
      status === "cancelled"
    ) {
      return status;
    }
    return "failed";
  }

}

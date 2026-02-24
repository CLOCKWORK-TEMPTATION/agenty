import { interrupt } from "@langchain/langgraph";
import type { RunState, TaskRequest } from "@repo/types";
import type { ToolBroker } from "@repo/tool-broker";

export interface HumanFeedbackState {
  runId: string;
  request: TaskRequest;
  approvalGranted: boolean;
  status: RunState["status"];
  events: string[];
}

export interface HumanFeedbackUpdate {
  approvalGranted?: boolean;
  status?: RunState["status"];
  events?: string[];
}

export interface HumanFeedbackDependencies {
  toolBroker: ToolBroker;
}

export function createHumanFeedbackNode(deps: HumanFeedbackDependencies) {
  return function humanFeedbackNode(state: HumanFeedbackState): HumanFeedbackUpdate {
    if (state.request.approvalMode !== "approval") {
      return {
        approvalGranted: true,
        events: ["human_feedback.skipped"]
      };
    }

    const sensitiveTools = deps.toolBroker
      .listCatalog()
      .filter((tool) => tool.sensitive)
      .map((tool) => tool.name);

    const resumedApproval = interrupt<
      { runId: string; sensitiveTools: string[] },
      { approved?: boolean } | boolean
    >({
      runId: state.runId,
      sensitiveTools
    });

    const approved = parseApproval(resumedApproval);

    return {
      approvalGranted: approved,
      status: approved ? "running" : "failed",
      events: [`approval.${approved ? "approved" : "rejected"}`]
    };
  };
}

function parseApproval(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "object" && value !== null && "approved" in value) {
    const approved = (value as { approved?: unknown }).approved;
    return approved === true;
  }
  return false;
}

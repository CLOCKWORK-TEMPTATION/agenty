import type { RunState, TaskRequest } from "@repo/types";

export interface ApprovalGateState {
  request: TaskRequest;
  approvalGranted: boolean;
  status: RunState["status"];
  events: string[];
}

export interface ApprovalGateUpdate {
  approvalGranted?: boolean;
  status?: RunState["status"];
  events?: string[];
}

export function approvalGateNode(state: ApprovalGateState): ApprovalGateUpdate {
  if (state.request.approvalMode === "approval") {
    return {
      approvalGranted: false,
      status: "waiting_approval",
      events: ["approval_gate.interrupt"]
    };
  }

  return {
    approvalGranted: true,
    status: "running",
    events: ["approval_gate.auto"]
  };
}

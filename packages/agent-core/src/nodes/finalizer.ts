import type { RunState, VerificationResult } from "@repo/types";

export interface FinalizerState {
  verification?: VerificationResult;
  status: RunState["status"];
  events: string[];
}

export interface FinalizerUpdate {
  status?: RunState["status"];
  events?: string[];
}

export function finalizerNode(state: FinalizerState): FinalizerUpdate {
  const finalStatus = state.verification?.passed ? "completed" : "failed";

  return {
    status: finalStatus,
    events: ["finalizer.completed"]
  };
}

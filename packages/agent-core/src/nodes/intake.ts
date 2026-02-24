import type { AppError } from "@repo/types";

export interface IntakeState {
  runId: string;
  request: {
    projectId: string;
    userId: string;
    title: string;
    description: string;
    domain: string;
    language?: string;
    approvalMode: string;
  };
  status: string;
  events: string[];
}

export interface IntakeUpdate {
  status?: "draft" | "running" | "waiting_approval" | "completed" | "failed";
  events?: string[];
}

export function intakeNode(state: IntakeState): IntakeUpdate {
  const errors: string[] = [];

  if (!state.request.projectId?.trim()) {
    errors.push("Missing required field: projectId");
  }

  if (!state.request.userId?.trim()) {
    errors.push("Missing required field: userId");
  }

  if (!state.request.title?.trim()) {
    errors.push("Missing required field: title");
  }

  if (!state.request.description?.trim()) {
    errors.push("Missing required field: description");
  }

  if (!state.request.domain?.trim()) {
    errors.push("Missing required field: domain");
  }

  const validDomains = ["coding", "research", "content", "data", "operations"];
  if (!validDomains.includes(state.request.domain)) {
    errors.push(`Invalid domain: ${state.request.domain}. Must be one of: ${validDomains.join(", ")}`);
  }

  const validApprovalModes = ["approval", "auto"];
  if (!validApprovalModes.includes(state.request.approvalMode)) {
    errors.push(
      `Invalid approvalMode: ${state.request.approvalMode}. Must be one of: ${validApprovalModes.join(", ")}`
    );
  }

  if (state.request.title.length > 200) {
    errors.push("Title too long: maximum 200 characters");
  }

  if (state.request.description.length > 10000) {
    errors.push("Description too long: maximum 10000 characters");
  }

  if (errors.length > 0) {
    const error: Partial<AppError> = {
      message: `Intake validation failed: ${errors.join("; ")}`,
      errorCode: "INTAKE_VALIDATION_FAILED"
    };
    throw error;
  }

  return {
    status: "running",
    events: [`intake.completed.${state.runId}`]
  };
}

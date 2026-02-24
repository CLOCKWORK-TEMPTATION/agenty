import type { RunStatus } from '@repo/types';
import { apiClient } from './client';

export interface StartRunRequest {
  team_id: string;
  input: {
    user_request: string;
    context?: Record<string, unknown>;
  };
}

export interface RunResponse {
  run_id: string;
  team_id: string;
  status: RunStatus;
  created_at: string;
  updated_at: string;
  input: {
    user_request: string;
    context?: Record<string, unknown>;
  };
  current_step?: string;
  result?: {
    output: unknown;
    artifacts: Array<{
      id: string;
      type: string;
      name: string;
      url: string;
      size?: number;
    }>;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface RunListResponse {
  runs: RunResponse[];
  total: number;
  page: number;
  limit: number;
}

export async function startRun(request: StartRunRequest): Promise<RunResponse> {
  return apiClient<RunResponse>('/api/v1/runs', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getRun(runId: string): Promise<RunResponse> {
  return apiClient<RunResponse>(`/api/v1/runs/${runId}`);
}

export async function listRuns(
  params?: {
    status?: RunStatus;
    team_id?: string;
    page?: number;
    limit?: number;
  }
): Promise<RunListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.team_id) searchParams.set('team_id', params.team_id);
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());

  const query = searchParams.toString();
  return apiClient<RunListResponse>(
    `/api/v1/runs${query ? `?${query}` : ''}`
  );
}

export async function approveRun(
  runId: string,
  decision: 'approve' | 'reject',
  feedback?: string
): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(
    `/api/v1/runs/${runId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, feedback }),
    }
  );
}

export async function cancelRun(runId: string): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(
    `/api/v1/runs/${runId}/cancel`,
    {
      method: 'POST',
    }
  );
}

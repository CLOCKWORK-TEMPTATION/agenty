import type {
  TeamDesign,
} from '@repo/types';
import { apiClient } from './client';

export interface CreateTeamRequest {
  template_id?: string;
  custom_design?: Partial<TeamDesign>;
  user_request: string;
}

export interface CreateTeamResponse {
  team_id: string;
  design: TeamDesign;
  status: 'draft' | 'approved';
}

export interface ApproveTeamRequest {
  team_id: string;
  modifications?: Partial<TeamDesign>;
}

export async function createTeam(
  request: CreateTeamRequest
): Promise<CreateTeamResponse> {
  return apiClient<CreateTeamResponse>('/api/v1/teams', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getTeam(teamId: string): Promise<TeamDesign> {
  return apiClient<TeamDesign>(`/api/v1/teams/${teamId}`);
}

export async function approveTeam(
  request: ApproveTeamRequest
): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(
    `/api/v1/teams/${request.team_id}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ modifications: request.modifications }),
    }
  );
}

export async function listTeams(): Promise<TeamDesign[]> {
  return apiClient<TeamDesign[]>('/api/v1/teams');
}

import { apiClient } from './client';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

export interface SkillListResponse {
  skills: Skill[];
  total: number;
}

export async function listSkills(params?: {
  category?: string;
  enabled?: boolean;
}): Promise<SkillListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.enabled !== undefined)
    searchParams.set('enabled', params.enabled.toString());

  const query = searchParams.toString();
  return apiClient<SkillListResponse>(
    `/api/v1/skills${query ? `?${query}` : ''}`
  );
}

export async function getSkill(skillId: string): Promise<Skill> {
  return apiClient<Skill>(`/api/v1/skills/${skillId}`);
}

export async function toggleSkill(
  skillId: string,
  enabled: boolean
): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(
    `/api/v1/skills/${skillId}/toggle`,
    {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }
  );
}

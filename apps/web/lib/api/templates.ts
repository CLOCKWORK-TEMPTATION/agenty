import type { TeamTemplate } from '@repo/types';
import { apiClient } from './client';

export interface TemplateListResponse {
  templates: TeamTemplate[];
  total: number;
}

export async function listTemplates(params?: {
  domain?: string;
  search?: string;
}): Promise<TemplateListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.domain) searchParams.set('domain', params.domain);
  if (params?.search) searchParams.set('search', params.search);

  const query = searchParams.toString();
  return apiClient<TemplateListResponse>(
    `/api/v1/templates${query ? `?${query}` : ''}`
  );
}

export async function getTemplate(templateId: string): Promise<TeamTemplate> {
  return apiClient<TeamTemplate>(`/api/v1/templates/${templateId}`);
}

export async function createTemplate(
  template: Omit<TeamTemplate, 'id' | 'created_at' | 'updated_at'>
): Promise<TeamTemplate> {
  return apiClient<TeamTemplate>('/api/v1/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

export async function updateTemplate(
  templateId: string,
  template: Partial<TeamTemplate>
): Promise<TeamTemplate> {
  return apiClient<TeamTemplate>(`/api/v1/templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(template),
  });
}

export async function deleteTemplate(
  templateId: string
): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(
    `/api/v1/templates/${templateId}`,
    {
      method: 'DELETE',
    }
  );
}

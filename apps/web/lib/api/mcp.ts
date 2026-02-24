import { apiClient } from './client';

export interface MCPServer {
  id: string;
  name: string;
  transport: 'stdio' | 'sse';
  endpoint?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  tools_count?: number;
  status?: 'connected' | 'disconnected' | 'error';
}

export interface MCPServerListResponse {
  servers: MCPServer[];
  total: number;
}

export async function listMCPServers(): Promise<MCPServerListResponse> {
  return apiClient<MCPServerListResponse>('/api/v1/mcp/servers');
}

export async function getMCPServer(serverId: string): Promise<MCPServer> {
  return apiClient<MCPServer>(`/api/v1/mcp/servers/${serverId}`);
}

export async function createMCPServer(
  server: Omit<MCPServer, 'id' | 'tools_count' | 'status'>
): Promise<MCPServer> {
  return apiClient<MCPServer>('/api/v1/mcp/servers', {
    method: 'POST',
    body: JSON.stringify(server),
  });
}

export async function updateMCPServer(
  serverId: string,
  server: Partial<MCPServer>
): Promise<MCPServer> {
  return apiClient<MCPServer>(`/api/v1/mcp/servers/${serverId}`, {
    method: 'PATCH',
    body: JSON.stringify(server),
  });
}

export async function deleteMCPServer(
  serverId: string
): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(
    `/api/v1/mcp/servers/${serverId}`,
    {
      method: 'DELETE',
    }
  );
}

export async function testMCPServer(
  serverId: string
): Promise<{ success: boolean; message?: string }> {
  return apiClient<{ success: boolean; message?: string }>(
    `/api/v1/mcp/servers/${serverId}/test`,
    {
      method: 'POST',
    }
  );
}

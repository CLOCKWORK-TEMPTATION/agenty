/**
 * Jira Integration
 * Issue creation + Status sync
 */

import type {
  JiraOAuthConfig,
  JiraTokenResponse,
  JiraIssue,
  JiraCreateIssueRequest,
  JiraStatusTransition
} from "@repo/types";

export interface JiraIntegrationConfig {
  oauth: JiraOAuthConfig;
  baseUrl?: string;
  cloudId?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  avatarUrls?: Record<string, string>;
}

export interface JiraIssueType {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  subtask: boolean;
}

export interface JiraPriority {
  id: string;
  name: string;
  iconUrl?: string;
}

export interface JiraStatus {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  category: "new" | "indeterminate" | "done";
}

export interface JiraComment {
  id: string;
  body: string;
  author: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
  };
  created: string;
  updated: string;
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

/**
 * JiraClient - OAuth and API client for Jira
 */
export class JiraClient {
  private readonly config: JiraIntegrationConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(config: JiraIntegrationConfig) {
    this.config = config;
  }

  /**
   * Set access token after OAuth flow
   */
  public setAccessToken(token: string, refreshToken?: string, expiresIn?: number): void {
    this.accessToken = token;
    this.refreshToken = refreshToken ?? null;
    if (expiresIn) {
      this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
    }
  }

  /**
   * Build OAuth authorization URL
   */
  public getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      audience: "api.atlassian.com",
      client_id: this.config.oauth.clientId,
      scope: "read:jira-work write:jira-work read:jira-user offline_access",
      redirect_uri: this.config.oauth.redirectUri,
      response_type: "code",
      prompt: "consent"
    });

    if (state) {
      params.append("state", state);
    }

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access token
   */
  public async exchangeCode(code: string): Promise<JiraTokenResponse> {
    const response = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: this.config.oauth.clientId,
        client_secret: this.config.oauth.clientSecret,
        code,
        redirect_uri: this.config.oauth.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira OAuth failed: ${error}`);
    }

    const data = await response.json() as JiraTokenResponse;
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token ?? null;
    this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    return data;
  }

  /**
   * Refresh access token
   */
  public async refreshAccessToken(): Promise<JiraTokenResponse> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: this.config.oauth.clientId,
        client_secret: this.config.oauth.clientSecret,
        refresh_token: this.refreshToken
      })
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${await response.text()}`);
    }

    const data = await response.json() as JiraTokenResponse;
    this.accessToken = data.access_token;
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
    }
    this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);
    return data;
  }

  /**
   * Get accessible Jira cloud instances
   */
  public async getCloudInstances(): Promise<Array<{ id: string; url: string; name: string }>> {
    this.ensureAuthenticated();

    const response = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get cloud instances: ${await response.text()}`);
    }

    return await response.json() as Array<{ id: string; url: string; name: string }>;
  }

  /**
   * Get all projects
   */
  public async getProjects(cloudId?: string): Promise<JiraProject[]> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/project`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Failed to get projects: ${await response.text()}`);
    }

    const data = await response.json() as Array<{
      id: string;
      key: string;
      name: string;
      avatarUrls?: Record<string, string>;
    }>;

    return data.map(p => ({
      id: p.id,
      key: p.key,
      name: p.name,
      avatarUrls: p.avatarUrls
    }));
  }

  /**
   * Get issue types for a project
   */
  public async getIssueTypes(cloudId?: string): Promise<JiraIssueType[]> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/issuetype`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Failed to get issue types: ${await response.text()}`);
    }

    const data = await response.json() as Array<{
      id: string;
      name: string;
      description?: string;
      iconUrl?: string;
      subtask: boolean;
    }>;

    return data.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      iconUrl: t.iconUrl,
      subtask: t.subtask
    }));
  }

  /**
   * Get priorities
   */
  public async getPriorities(cloudId?: string): Promise<JiraPriority[]> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/priority`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Failed to get priorities: ${await response.text()}`);
    }

    const data = await response.json() as Array<{
      id: string;
      name: string;
      iconUrl?: string;
    }>;

    return data.map(p => ({
      id: p.id,
      name: p.name,
      iconUrl: p.iconUrl
    }));
  }

  /**
   * Get an issue by key
   */
  public async getIssue(issueKey: string, cloudId?: string): Promise<JiraIssue> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/issue/${issueKey}`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Failed to get issue: ${await response.text()}`);
    }

    const data = await response.json() as {
      id: string;
      key: string;
      self: string;
      fields: {
        summary: string;
        description?: string;
        status: { id: string; name: string };
        issuetype: { id: string; name: string };
        priority?: { id: string; name: string };
        assignee?: { accountId: string; displayName: string };
        created: string;
        updated: string;
      };
    };

    return this.transformIssue(data);
  }

  /**
   * Create a new issue
   */
  public async createIssue(request: JiraCreateIssueRequest, cloudId?: string): Promise<JiraIssue> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const body: Record<string, unknown> = {
      fields: {
        project: { key: request.projectKey },
        summary: request.summary,
        issuetype: { id: request.issueType }
      }
    };

    if (request.description) {
      body.fields.description = {
        type: "doc",
        version: 1,
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: request.description }]
        }]
      };
    }

    if (request.priority) {
      (body.fields as Record<string, unknown>).priority = { id: request.priority };
    }

    if (request.assignee) {
      (body.fields as Record<string, unknown>).assignee = { accountId: request.assignee };
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/issue`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create issue: ${await response.text()}`);
    }

    const result = await response.json() as { id: string; key: string; self: string };

    // Fetch the full issue details
    return this.getIssue(result.key, targetCloudId);
  }

  /**
   * Update an issue
   */
  public async updateIssue(
    issueKey: string,
    updates: Partial<JiraCreateIssueRequest>,
    cloudId?: string
  ): Promise<JiraIssue> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const body: { fields: Record<string, unknown> } = { fields: {} };

    if (updates.summary) body.fields.summary = updates.summary;
    if (updates.description) {
      body.fields.description = {
        type: "doc",
        version: 1,
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: updates.description }]
        }]
      };
    }
    if (updates.priority) body.fields.priority = { id: updates.priority };
    if (updates.assignee) body.fields.assignee = { accountId: updates.assignee };
    if (updates.issueType) body.fields.issuetype = { id: updates.issueType };

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/issue/${issueKey}`,
      {
        method: "PUT",
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update issue: ${await response.text()}`);
    }

    return this.getIssue(issueKey, targetCloudId);
  }

  /**
   * Get available status transitions for an issue
   */
  public async getTransitions(issueKey: string, cloudId?: string): Promise<JiraStatusTransition[]> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/issue/${issueKey}/transitions`,
      { headers: this.getHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Failed to get transitions: ${await response.text()}`);
    }

    const data = await response.json() as {
      transitions: Array<{
        id: string;
        name: string;
        to: { id: string; name: string };
      }>;
    };

    return data.transitions.map(t => ({
      id: t.id,
      name: t.name,
      to: t.to
    }));
  }

  /**
   * Transition an issue to a new status
   */
  public async transitionIssue(
    issueKey: string,
    transitionId: string,
    cloudId?: string
  ): Promise<JiraIssue> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/issue/${issueKey}/transitions`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({ transition: { id: transitionId } })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to transition issue: ${await response.text()}`);
    }

    return this.getIssue(issueKey, targetCloudId);
  }

  /**
   * Add a comment to an issue
   */
  public async addComment(issueKey: string, body: string, cloudId?: string): Promise<JiraComment> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/issue/${issueKey}/comment`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify({
          body: {
            type: "doc",
            version: 1,
            content: [{
              type: "paragraph",
              content: [{ type: "text", text: body }]
            }]
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to add comment: ${await response.text()}`);
    }

    const data = await response.json() as {
      id: string;
      body: string;
      author: {
        accountId: string;
        displayName: string;
        emailAddress?: string;
      };
      created: string;
      updated: string;
    };

    return {
      id: data.id,
      body: data.body,
      author: data.author,
      created: data.created,
      updated: data.updated
    };
  }

  /**
   * Search for issues using JQL
   */
  public async searchIssues(
    jql: string,
    options?: { startAt?: number; maxResults?: number; fields?: string[] },
    cloudId?: string
  ): Promise<JiraSearchResult> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const body: Record<string, unknown> = {
      jql,
      startAt: options?.startAt ?? 0,
      maxResults: options?.maxResults ?? 50
    };

    if (options?.fields) {
      body.fields = options.fields;
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/search`,
      {
        method: "POST",
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search issues: ${await response.text()}`);
    }

    const data = await response.json() as {
      issues: Array<{
        id: string;
        key: string;
        self: string;
        fields: {
          summary: string;
          description?: string;
          status: { id: string; name: string };
          issuetype: { id: string; name: string };
          priority?: { id: string; name: string };
          assignee?: { accountId: string; displayName: string };
          created: string;
          updated: string;
        };
      }>;
      total: number;
      startAt: number;
      maxResults: number;
    };

    return {
      issues: data.issues.map(i => this.transformIssue(i)),
      total: data.total,
      startAt: data.startAt,
      maxResults: data.maxResults
    };
  }

  /**
   * Delete an issue
   */
  public async deleteIssue(issueKey: string, cloudId?: string): Promise<void> {
    this.ensureAuthenticated();

    const targetCloudId = cloudId ?? this.config.cloudId;
    if (!targetCloudId) {
      throw new Error("Cloud ID required");
    }

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${targetCloudId}/rest/api/3/issue/${issueKey}`,
      {
        method: "DELETE",
        headers: this.getHeaders()
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete issue: ${await response.text()}`);
    }
  }

  /**
   * Check if token needs refresh and refresh if needed
   */
  public async ensureValidToken(): Promise<void> {
    if (!this.tokenExpiresAt || Date.now() >= this.tokenExpiresAt.getTime() - 60000) {
      // Token expired or expires within 1 minute
      if (this.refreshToken) {
        await this.refreshAccessToken();
      }
    }
  }

  // Private methods

  private getHeaders(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.accessToken}`,
      "Accept": "application/json",
      "Content-Type": "application/json"
    };
  }

  private ensureAuthenticated(): void {
    if (!this.accessToken) {
      throw new Error("Not authenticated. Call setAccessToken or exchangeCode first.");
    }
  }

  private transformIssue(data: {
    id: string;
    key: string;
    self: string;
    fields: {
      summary: string;
      description?: string;
      status: { id: string; name: string };
      issuetype: { id: string; name: string };
      priority?: { id: string; name: string };
      assignee?: { accountId: string; displayName: string };
      created: string;
      updated: string;
    };
  }): JiraIssue {
    return {
      id: data.id,
      key: data.key,
      self: data.self,
      fields: {
        summary: data.fields.summary,
        description: data.fields.description,
        status: data.fields.status,
        issuetype: data.fields.issuetype,
        priority: data.fields.priority,
        assignee: data.fields.assignee,
        created: data.fields.created,
        updated: data.fields.updated
      }
    };
  }
}

// Factory function
export function createJiraClient(config: JiraIntegrationConfig): JiraClient {
  return new JiraClient(config);
}

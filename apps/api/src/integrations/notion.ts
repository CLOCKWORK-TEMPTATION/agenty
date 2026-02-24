/**
 * Notion Integration
 * OAuth + Page/Database access
 */

import type {
  NotionOAuthConfig,
  NotionTokenResponse,
  NotionPage,
  NotionDatabase
} from "@repo/types";

export interface NotionIntegrationConfig {
  oauth: NotionOAuthConfig;
  baseUrl?: string;
}

export interface NotionSearchResult {
  object: "page" | "database";
  id: string;
  url: string;
  title: string;
  last_edited_time: string;
}

export interface NotionCreatePageRequest {
  parent: { database_id: string } | { page_id: string };
  properties: Record<string, unknown>;
  children?: Array<{
    object: "block";
    type: string;
    [key: string]: unknown;
  }>;
}

export interface NotionUpdatePageRequest {
  pageId: string;
  properties: Record<string, unknown>;
}

export interface NotionQueryDatabaseRequest {
  databaseId: string;
  filter?: Record<string, unknown>;
  sorts?: Array<{
    property: string;
    direction: "ascending" | "descending";
  }>;
  pageSize?: number;
}

/**
 * NotionClient - OAuth and API client for Notion
 */
export class NotionClient {
  private readonly config: NotionIntegrationConfig;
  private accessToken: string | null = null;
  private baseUrl = "https://api.notion.com/v1";

  constructor(config: NotionIntegrationConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? this.baseUrl;
  }

  /**
   * Set access token after OAuth flow
   */
  public setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Build OAuth authorization URL
   */
  public getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.oauth.clientId,
      redirect_uri: this.config.oauth.redirectUri,
      response_type: "code",
      owner: "user"
    });

    if (state) {
      params.append("state", state);
    }

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for access token
   */
  public async exchangeCode(code: string): Promise<NotionTokenResponse> {
    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${this.encodeBasicAuth()}`
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.oauth.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion OAuth failed: ${error}`);
    }

    const data = await response.json() as NotionTokenResponse;
    this.accessToken = data.access_token;
    return data;
  }

  /**
   * Search pages and databases
   */
  public async search(query?: string, pageSize = 10): Promise<NotionSearchResult[]> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.baseUrl}/search`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        query,
        page_size: pageSize
      })
    });

    if (!response.ok) {
      throw new Error(`Notion search failed: ${await response.text()}`);
    }

    const data = await response.json() as {
      results: Array<{
        object: "page" | "database";
        id: string;
        url: string;
        title?: Array<{ plain_text: string }>;
        last_edited_time: string;
      }>;
    };

    return data.results.map(item => ({
      object: item.object,
      id: item.id,
      url: item.url,
      title: this.extractTitle(item),
      last_edited_time: item.last_edited_time
    }));
  }

  /**
   * Get a page by ID
   */
  public async getPage(pageId: string): Promise<NotionPage> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.baseUrl}/pages/${pageId}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get Notion page: ${await response.text()}`);
    }

    const data = await response.json() as {
      id: string;
      url: string;
      properties: Record<string, unknown>;
      created_time: string;
      last_edited_time: string;
      parent: {
        type: string;
        database_id?: string;
        page_id?: string;
      };
    };

    return {
      id: data.id,
      url: data.url,
      title: this.extractTitleFromProperties(data.properties),
      created_time: data.created_time,
      last_edited_time: data.last_edited_time,
      parent: data.parent
    };
  }

  /**
   * Get page content (blocks)
   */
  public async getPageContent(pageId: string): Promise<unknown[]> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.baseUrl}/blocks/${pageId}/children`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get page content: ${await response.text()}`);
    }

    const data = await response.json() as { results: unknown[] };
    return data.results;
  }

  /**
   * Get a database by ID
   */
  public async getDatabase(databaseId: string): Promise<NotionDatabase> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.baseUrl}/databases/${databaseId}`, {
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to get Notion database: ${await response.text()}`);
    }

    const data = await response.json() as {
      id: string;
      url: string;
      title: Array<{ plain_text: string }>;
      description?: Array<{ plain_text: string }>;
      properties: Record<string, unknown>;
    };

    return {
      id: data.id,
      url: data.url,
      title: data.title.map(t => t.plain_text).join(""),
      description: data.description?.map(d => d.plain_text).join(""),
      properties: data.properties
    };
  }

  /**
   * Query a database
   */
  public async queryDatabase(request: NotionQueryDatabaseRequest): Promise<NotionPage[]> {
    this.ensureAuthenticated();

    const { databaseId, filter, sorts, pageSize = 100 } = request;

    const response = await fetch(`${this.baseUrl}/databases/${databaseId}/query`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        filter,
        sorts,
        page_size: pageSize
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to query database: ${await response.text()}`);
    }

    const data = await response.json() as {
      results: Array<{
        id: string;
        url: string;
        properties: Record<string, unknown>;
        created_time: string;
        last_edited_time: string;
      }>;
    };

    return data.results.map(item => ({
      id: item.id,
      url: item.url,
      title: this.extractTitleFromProperties(item.properties),
      created_time: item.created_time,
      last_edited_time: item.last_edited_time
    }));
  }

  /**
   * Create a new page
   */
  public async createPage(request: NotionCreatePageRequest): Promise<NotionPage> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.baseUrl}/pages`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Failed to create Notion page: ${await response.text()}`);
    }

    const data = await response.json() as {
      id: string;
      url: string;
      properties: Record<string, unknown>;
      created_time: string;
      last_edited_time: string;
    };

    return {
      id: data.id,
      url: data.url,
      title: this.extractTitleFromProperties(data.properties),
      created_time: data.created_time,
      last_edited_time: data.last_edited_time
    };
  }

  /**
   * Update a page
   */
  public async updatePage(request: NotionUpdatePageRequest): Promise<NotionPage> {
    this.ensureAuthenticated();

    const { pageId, properties } = request;

    const response = await fetch(`${this.baseUrl}/pages/${pageId}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify({ properties })
    });

    if (!response.ok) {
      throw new Error(`Failed to update Notion page: ${await response.text()}`);
    }

    const data = await response.json() as {
      id: string;
      url: string;
      properties: Record<string, unknown>;
      created_time: string;
      last_edited_time: string;
    };

    return {
      id: data.id,
      url: data.url,
      title: this.extractTitleFromProperties(data.properties),
      created_time: data.created_time,
      last_edited_time: data.last_edited_time
    };
  }

  /**
   * Create a database
   */
  public async createDatabase(
    parentPageId: string,
    title: string,
    properties: Record<string, unknown>
  ): Promise<NotionDatabase> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.baseUrl}/databases`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        parent: { page_id: parentPageId },
        title: [{ type: "text", text: { content: title } }],
        properties
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create database: ${await response.text()}`);
    }

    const data = await response.json() as {
      id: string;
      url: string;
      title: Array<{ plain_text: string }>;
      description?: Array<{ plain_text: string }>;
      properties: Record<string, unknown>;
    };

    return {
      id: data.id,
      url: data.url,
      title: data.title.map(t => t.plain_text).join(""),
      description: data.description?.map(d => d.plain_text).join(""),
      properties: data.properties
    };
  }

  /**
   * Append blocks to a page or block
   */
  public async appendBlocks(
    parentId: string,
    blocks: Array<{ object: "block"; type: string; [key: string]: unknown }>
  ): Promise<void> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.baseUrl}/blocks/${parentId}/children`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify({ children: blocks })
    });

    if (!response.ok) {
      throw new Error(`Failed to append blocks: ${await response.text()}`);
    }
  }

  /**
   * Delete a block
   */
  public async deleteBlock(blockId: string): Promise<void> {
    this.ensureAuthenticated();

    const response = await fetch(`${this.baseUrl}/blocks/${blockId}`, {
      method: "DELETE",
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to delete block: ${await response.text()}`);
    }
  }

  // Private methods

  private getHeaders(): Record<string, string> {
    return {
      "Authorization": `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    };
  }

  private encodeBasicAuth(): string {
    const credentials = `${this.config.oauth.clientId}:${this.config.oauth.clientSecret}`;
    return Buffer.from(credentials).toString("base64");
  }

  private ensureAuthenticated(): void {
    if (!this.accessToken) {
      throw new Error("Not authenticated. Call setAccessToken or exchangeCode first.");
    }
  }

  private extractTitle(item: { title?: Array<{ plain_text: string }> }): string {
    if (item.title && item.title.length > 0) {
      return item.title.map(t => t.plain_text).join("");
    }
    return "Untitled";
  }

  private extractTitleFromProperties(properties: Record<string, unknown>): string {
    // Try to find a title property
    const titleProp = Object.values(properties).find(
      (p: unknown) => (p as { type?: string }).type === "title"
    ) as { title?: Array<{ plain_text: string }> } | undefined;

    if (titleProp?.title && titleProp.title.length > 0) {
      return titleProp.title.map(t => t.plain_text).join("");
    }

    return "Untitled";
  }
}

// Factory function
export function createNotionClient(config: NotionIntegrationConfig): NotionClient {
  return new NotionClient(config);
}

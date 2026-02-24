export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface FetchOptions extends RequestInit {
  timeout?: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiClient<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error_code: 'UNKNOWN_ERROR',
        message: response.statusText,
      }));

      throw new APIError(
        response.status,
        error.error_code || 'UNKNOWN_ERROR',
        error.message || response.statusText,
        response.status >= 500 || response.status === 429
      );
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof APIError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError(408, 'TIMEOUT', 'Request timeout', true);
    }

    throw new APIError(
      0,
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network error',
      true
    );
  }
}

export function getAPIBaseURL(): string {
  return API_BASE_URL;
}

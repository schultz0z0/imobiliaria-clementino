const CSRF_COOKIE_NAME = 'clementino_admin_csrf';

export type SessionState = { authenticated: boolean; mustChangePassword: boolean };
export type AuthResult = { mustChangePassword: boolean };

export type AuthApi = {
  getSession: () => Promise<SessionState>;
  login: (username: string, password: string) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  onUnauthorized?: (handler: () => void) => () => void;
};

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code?: string) {
    super('A solicitação não pôde ser concluída.');
    this.name = 'ApiError';
  }
}

const readCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie.split(';').map((entry) => entry.trim()).find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
};

const getErrorCode = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null || !('error' in value)) return undefined;
  const error = (value as { error: unknown }).error;
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code : undefined;
};

export class AdminApiClient implements AuthApi {
  private readonly unauthorizedHandlers = new Set<() => void>();

  constructor(private readonly baseUrl = '/api/admin') {}

  onUnauthorized = (handler: () => void) => {
    this.unauthorizedHandlers.add(handler);
    return () => this.unauthorizedHandlers.delete(handler);
  };

  private async request<T>(path: string, init: RequestInit = {}, notifyUnauthorized = true): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const method = (init.method ?? 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrf = readCookie(CSRF_COOKIE_NAME);
      if (csrf) headers.set('x-csrf-token', csrf);
    }
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, credentials: 'include' });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      if (response.status === 401 && notifyUnauthorized) this.unauthorizedHandlers.forEach((handler) => handler());
      throw new ApiError(response.status, getErrorCode(body));
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async getSession(): Promise<SessionState> {
    try {
      const result = await this.request<AuthResult>('/auth/session', {}, false);
      return { authenticated: true, mustChangePassword: result.mustChangePassword };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return { authenticated: false, mustChangePassword: false };
      throw error;
    }
  }

  login(username: string, password: string): Promise<AuthResult> {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }, false);
  }

  changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
    return this.request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
  }

  logout(): Promise<void> {
    return this.request('/auth/logout', { method: 'POST' });
  }
}

export const adminApi = new AdminApiClient();

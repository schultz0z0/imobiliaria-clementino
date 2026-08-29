const CSRF_COOKIE_NAME = 'clementino_admin_csrf';

export type SessionState = { authenticated: boolean; mustChangePassword: boolean };
export type AuthResult = { mustChangePassword: boolean };

export type PropertyStatus = 'draft' | 'published' | 'inactive';
export type PropertyOperation = 'sale' | 'rent' | 'seasonal' | 'auction';
export type PropertyType = 'apartment' | 'house' | 'commercial' | 'rural' | 'land';

export type AdminPropertyDraftDto = {
  classification?: { operations?: PropertyOperation[]; type?: PropertyType; subtype?: string };
  privateAddress?: {
    postalCode?: string;
    state?: string;
    city?: string;
    district?: string;
    street?: string;
    number?: string;
    complement?: string;
  };
  editorial?: { title?: string; reference?: string; featured?: boolean };
  pricing?: Partial<Record<PropertyOperation | 'condominium' | 'iptu', number>>;
  media?: { orderedPhotoIds?: string[]; coverPhotoId?: string };
};

export type PropertyAdminDto = {
  id: string;
  publicId: string;
  commercialReference: string;
  slug: string;
  status: PropertyStatus;
  revisionNumber: number;
  draftRevisionId: number;
  publishedRevisionId: number | null;
  draft: AdminPropertyDraftDto;
  published: unknown | null;
  createdAt: string;
  updatedAt: string;
  inactivatedAt: string | null;
};

export type PropertyListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: PropertyStatus;
  operation?: PropertyOperation;
  type?: PropertyType;
  state?: string;
  city?: string;
  district?: string;
};

export type PropertyListResponse = {
  items: PropertyAdminDto[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export type PublicationJobSummary = {
  id: number;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  queuedAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};
export type PropertyLifecycleResponse = { property: PropertyAdminDto; job: PublicationJobSummary | null };

export type PropertyAdminApi = {
  listProperties: (query?: PropertyListQuery) => Promise<PropertyListResponse>;
  getLatestPublication: () => Promise<{ publication: PublicationJobSummary | null }>;
  publishProperty: (id: string) => Promise<{ job: PublicationJobSummary }>;
  inactivateProperty: (id: string) => Promise<PropertyLifecycleResponse>;
  reactivateProperty: (id: string) => Promise<PropertyLifecycleResponse>;
  duplicateProperty: (id: string) => Promise<{ property: PropertyAdminDto }>;
};

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

export class AdminApiClient implements AuthApi, PropertyAdminApi {
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

  listProperties(query: PropertyListQuery = {}): Promise<PropertyListResponse> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const suffix = search.size ? `?${search.toString()}` : '';
    return this.request(`/properties${suffix}`);
  }

  getLatestPublication(): Promise<{ publication: PublicationJobSummary | null }> {
    return this.request('/publications/latest');
  }

  publishProperty(id: string): Promise<{ job: PublicationJobSummary }> {
    return this.request(`/properties/${encodeURIComponent(id)}/publish`, { method: 'POST', body: '{}' });
  }

  inactivateProperty(id: string): Promise<PropertyLifecycleResponse> {
    return this.request(`/properties/${encodeURIComponent(id)}/inactivate`, { method: 'POST', body: '{}' });
  }

  reactivateProperty(id: string): Promise<PropertyLifecycleResponse> {
    return this.request(`/properties/${encodeURIComponent(id)}/reactivate`, { method: 'POST', body: '{}' });
  }

  duplicateProperty(id: string): Promise<{ property: PropertyAdminDto }> {
    return this.request(`/properties/${encodeURIComponent(id)}/duplicate`, { method: 'POST', body: '{}' });
  }
}

export const adminApi = new AdminApiClient();

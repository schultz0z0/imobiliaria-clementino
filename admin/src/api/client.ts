import type { ApiFieldIssue } from '../../../shared/apiContract.ts';
import type { PropertyDraft } from '../../../shared/propertySchema.ts';

const CSRF_COOKIE_NAME = 'clementino_admin_csrf';

export type SessionState = { authenticated: boolean; mustChangePassword: boolean };
export type AuthResult = { mustChangePassword: boolean };

export type PropertyStatus = 'draft' | 'published' | 'inactive';
export type PropertyOperation = 'sale' | 'rent' | 'seasonal' | 'auction';
export type PropertyType = 'apartment' | 'house' | 'commercial' | 'rural' | 'land';

export type DeepPartial<T> = T extends readonly (infer Item)[]
  ? Item[]
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> | null }
    : T;

export type AdminPropertyDraftDto = DeepPartial<PropertyDraft>;

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

export type AdminPropertySummaryDto = {
  id: string;
  publicId: string;
  reference: string;
  slug: string;
  status: PropertyStatus;
  title: string;
  location: { district: string; city: string; state: string };
  classification: { operations: PropertyOperation[] };
  firstPrice: number | null;
  updatedAt: string;
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
  sort?: 'updated-desc' | 'updated-asc' | 'title-asc' | 'title-desc' | 'price-asc' | 'price-desc';
};

export type PropertyListResponse = {
  items: AdminPropertySummaryDto[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export type PublicationJobSummary = {
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  queuedAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  property: { publicId: string; reference: string; slug: string; title: string; status: PropertyStatus };
};
export type PublicationMutationJob = { id: number; status: 'queued' | 'running' | 'succeeded' | 'failed' };
export type PropertyLifecycleResponse = { property: PropertyAdminDto; job: PublicationMutationJob | null };

export type PropertyAdminApi = {
  listProperties: (query?: PropertyListQuery) => Promise<PropertyListResponse>;
  getLatestPublication: () => Promise<{ publication: PublicationJobSummary | null }>;
  publishProperty: (id: string) => Promise<{ job: PublicationMutationJob }>;
  inactivateProperty: (id: string) => Promise<PropertyLifecycleResponse>;
  reactivateProperty: (id: string) => Promise<PropertyLifecycleResponse>;
  duplicateProperty: (id: string) => Promise<{ property: PropertyAdminDto }>;
};

export type MediaPhotoDto = {
  id: string; mimeType: string; byteSize: number; width: number; height: number;
  checksumSha256: string; altText: string; position: number;
  thumbnailUrl: string;
};

export type CepLookupResponse =
  | { ok: true; address: NonNullable<AdminPropertyDraftDto['privateAddress']> }
  | { ok: false; error: { code: string; message: string } };

export type PropertyEditorApi = {
  createProperty: (draft?: AdminPropertyDraftDto, signal?: AbortSignal) => Promise<{ property: PropertyAdminDto }>;
  getProperty: (id: string, signal?: AbortSignal) => Promise<{ property: PropertyAdminDto }>;
  patchProperty: (id: string, revision: number, patch: AdminPropertyDraftDto, signal?: AbortSignal) => Promise<{ property: PropertyAdminDto }>;
  lookupCep: (cep: string, signal?: AbortSignal) => Promise<CepLookupResponse>;
  previewLocation: (input: { publicId: string; privateAddress: NonNullable<AdminPropertyDraftDto['privateAddress']>; manualCoordinates?: { latitude: number; longitude: number } }, signal?: AbortSignal) => Promise<{ publicLocation: NonNullable<AdminPropertyDraftDto['publicLocation']> }>;
  uploadPhoto: (id: string, revision: number, file: File, altText: string, signal?: AbortSignal) => Promise<{ photo: MediaPhotoDto; property: PropertyAdminDto }>;
  reorderPhotos: (id: string, revision: number, orderedPhotoIds: string[], coverPhotoId: string, signal?: AbortSignal) => Promise<{ property: PropertyAdminDto }>;
  editPhoto: (id: string, photoId: string, revision: number, altText: string, signal?: AbortSignal) => Promise<{ photo: MediaPhotoDto; property: PropertyAdminDto }>;
  deletePhoto: (id: string, photoId: string, revision: number, signal?: AbortSignal) => Promise<{ property: PropertyAdminDto; deletion: { state: string; retainedForPublication: boolean } }>;
  listPhotos: (id: string, signal?: AbortSignal) => Promise<{ photos: MediaPhotoDto[] }>;
};

export type AuthApi = {
  getSession: () => Promise<SessionState>;
  login: (username: string, password: string) => Promise<AuthResult>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  onUnauthorized?: (handler: () => void) => () => void;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: string,
    public readonly issues: ApiFieldIssue[] = [],
    message?: string,
  ) {
    super('A solicitação não pôde ser concluída.');
    this.name = 'ApiError';
    if (message) this.message = message;
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

const getErrorDetails = (value: unknown): { code?: string; message?: string; issues?: ApiFieldIssue[] } => {
  if (typeof value !== 'object' || value === null || !('error' in value)) return {};
  const error = (value as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) return {};
  const details = error as { code?: unknown; message?: unknown; issues?: unknown };
  return {
    code: typeof details.code === 'string' ? details.code : undefined,
    message: typeof details.message === 'string' ? details.message : undefined,
    issues: Array.isArray(details.issues) ? details.issues as ApiFieldIssue[] : undefined,
  };
};

export class AdminApiClient implements AuthApi, PropertyAdminApi, PropertyEditorApi {
  private readonly unauthorizedHandlers = new Set<() => void>();

  constructor(private readonly baseUrl = '/api/admin') {}

  onUnauthorized = (handler: () => void) => {
    this.unauthorizedHandlers.add(handler);
    return () => this.unauthorizedHandlers.delete(handler);
  };

  private async request<T>(path: string, init: RequestInit = {}, notifyUnauthorized = true): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const method = (init.method ?? 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrf = readCookie(CSRF_COOKIE_NAME);
      if (csrf) headers.set('x-csrf-token', csrf);
    }
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, credentials: 'include' });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      if (response.status === 401 && notifyUnauthorized) this.unauthorizedHandlers.forEach((handler) => handler());
      const details = getErrorDetails(body);
      throw new ApiError(response.status, details.code ?? getErrorCode(body), details.issues, details.message);
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

  publishProperty(id: string): Promise<{ job: PublicationMutationJob }> {
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

  createProperty(draft: AdminPropertyDraftDto = {}, signal?: AbortSignal): Promise<{ property: PropertyAdminDto }> {
    return this.request('/properties', { method: 'POST', body: JSON.stringify({ draft }), signal });
  }

  getProperty(id: string, signal?: AbortSignal): Promise<{ property: PropertyAdminDto }> {
    return this.request(`/properties/${encodeURIComponent(id)}`, { signal });
  }

  patchProperty(id: string, revision: number, patch: AdminPropertyDraftDto, signal?: AbortSignal): Promise<{ property: PropertyAdminDto }> {
    return this.request(`/properties/${encodeURIComponent(id)}/draft`, {
      method: 'PATCH', headers: { 'if-match': String(revision) }, body: JSON.stringify(patch), signal,
    });
  }

  lookupCep(cep: string, signal?: AbortSignal): Promise<CepLookupResponse> {
    return this.request(`/location/cep/${encodeURIComponent(cep)}`, { signal });
  }

  previewLocation(input: Parameters<PropertyEditorApi['previewLocation']>[0], signal?: AbortSignal): ReturnType<PropertyEditorApi['previewLocation']> {
    return this.request('/location/preview', { method: 'POST', body: JSON.stringify(input), signal });
  }

  uploadPhoto(id: string, revision: number, file: File, altText: string, signal?: AbortSignal): ReturnType<PropertyEditorApi['uploadPhoto']> {
    const body = new FormData();
    body.append('file', file);
    body.append('altText', altText);
    return this.request(`/properties/${encodeURIComponent(id)}/photos`, {
      method: 'POST', headers: { 'if-match': String(revision) }, body, signal,
    });
  }

  reorderPhotos(id: string, revision: number, orderedPhotoIds: string[], coverPhotoId: string, signal?: AbortSignal): ReturnType<PropertyEditorApi['reorderPhotos']> {
    return this.request(`/properties/${encodeURIComponent(id)}/photos/order`, {
      method: 'PATCH', headers: { 'if-match': String(revision) }, body: JSON.stringify({ orderedPhotoIds, coverPhotoId }), signal,
    });
  }

  editPhoto(id: string, photoId: string, revision: number, altText: string, signal?: AbortSignal): ReturnType<PropertyEditorApi['editPhoto']> {
    return this.request(`/properties/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`, {
      method: 'PATCH', headers: { 'if-match': String(revision) }, body: JSON.stringify({ altText }), signal,
    });
  }

  deletePhoto(id: string, photoId: string, revision: number, signal?: AbortSignal): ReturnType<PropertyEditorApi['deletePhoto']> {
    return this.request(`/properties/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}`, {
      method: 'DELETE', headers: { 'if-match': String(revision) }, signal,
    });
  }

  listPhotos(id: string, signal?: AbortSignal): Promise<{ photos: MediaPhotoDto[] }> {
    return this.request(`/properties/${encodeURIComponent(id)}/photos`, { signal });
  }
}

export const adminApi = new AdminApiClient();

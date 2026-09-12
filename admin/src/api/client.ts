import type { ApiFieldIssue } from '../../../shared/apiContract.ts';
import type { PropertyDraft } from '../../../shared/propertySchema.ts';
import type {
  ContractDocumentDto,
  ContractStatus,
  CreatePersonInput,
  CreateRentalContractInput,
  DocumentCategory,
  PaymentCategory,
  PaymentRecordDto,
  PersonDto,
  RegisterForwardingInput,
  RegisterPaymentInput,
  RentalContractDto,
} from '../../../shared/rentalSchema.ts';

const CSRF_COOKIE_NAME = 'clementino_admin_csrf';

export type SessionState = { authenticated: boolean; mustChangePassword: boolean };
export type AuthResult = { mustChangePassword: boolean };

export type PropertyStatus = 'draft' | 'published' | 'inactive' | 'rented';
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
  featured?: boolean;
  featuredAt?: string | null;
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
  featured?: boolean;
  featuredAt?: string | null;
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
  validateProperty: (id: string) => Promise<{ publishable: boolean; issues: ApiFieldIssue[] }>;
  createPropertyPreview: (id: string) => Promise<{ token: string; expiresAt: string; previewPath: string }>;
  publishProperty: (id: string) => Promise<{ job: PublicationMutationJob }>;
  inactivateProperty: (id: string) => Promise<PropertyLifecycleResponse>;
  reactivateProperty: (id: string) => Promise<PropertyLifecycleResponse>;
  duplicateProperty: (id: string) => Promise<{ property: PropertyAdminDto }>;
  featureProperty?: (id: string) => Promise<{ property: PropertyAdminDto }>;
  unfeatureProperty?: (id: string) => Promise<{ property: PropertyAdminDto }>;
  getPropertyQuality?: (id: string) => Promise<{ score: number; checks: Array<{ id: string; label: string; points: number; passed: boolean; recommendation?: string }>; recommendations: string[]; publishable: boolean; blockingIssues: ApiFieldIssue[] }>;
};

export type MediaPhotoDto = {
  id: string; mimeType: string; byteSize: number; width: number; height: number;
  checksumSha256: string; altText: string; position: number;
  thumbnailUrl: string;
};

export type CepLookupResponse =
  | { ok: true; address: NonNullable<AdminPropertyDraftDto['privateAddress']> }
  | { ok: false; error: { code: string; message: string } };

export type GeocodeLocationInput = {
  postalCode: string; state: string; city: string; district: string; street: string; number?: string; complement?: string;
};
export type GeocodeLocationResponse =
  | { ok: true; location: { latitude: number; longitude: number; label: string } }
  | { ok: false; error: { code: string; message: string } };


export type PropertyEditorApi = {
  createProperty: (draft?: AdminPropertyDraftDto, signal?: AbortSignal) => Promise<{ property: PropertyAdminDto }>;
  getProperty: (id: string, signal?: AbortSignal) => Promise<{ property: PropertyAdminDto }>;
  patchProperty: (id: string, revision: number, patch: AdminPropertyDraftDto, signal?: AbortSignal) => Promise<{ property: PropertyAdminDto }>;
  lookupCep: (cep: string, signal?: AbortSignal) => Promise<CepLookupResponse>;
  geocodeLocation: (input: GeocodeLocationInput, signal?: AbortSignal) => Promise<GeocodeLocationResponse>;
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

export type DerivedPaymentStatus = 'pending' | 'paid' | 'forwarded' | 'overdue';

export interface PeopleAdminApi {
  listPeople: (query?: { search?: string; page?: number; limit?: number }) => Promise<{
    items: PersonDto[];
    pagination: { total: number; page: number; limit: number };
  }>;
  createPerson: (input: CreatePersonInput) => Promise<{ person: PersonDto }>;
  getPerson: (id: string) => Promise<{ person: PersonDto }>;
  updatePerson: (id: string, input: Partial<CreatePersonInput>) => Promise<{ person: PersonDto }>;
  deletePerson: (id: string) => Promise<void>;
}

export interface RentalAdminApi {
  listContracts: (query?: {
    status?: ContractStatus;
    propertyId?: string;
    landlordId?: string;
    tenantId?: string;
    page?: number;
    limit?: number;
  }) => Promise<{
    items: RentalContractDto[];
    pagination: { total: number; page: number; limit: number };
  }>;
  createContract: (input: CreateRentalContractInput) => Promise<{ contract: RentalContractDto }>;
  getContract: (id: string) => Promise<{ contract: RentalContractDto }>;
  terminateContract: (
    id: string,
    returnPropertyToStatus?: 'draft' | 'published' | 'inactive',
  ) => Promise<{ contract: RentalContractDto }>;
  listContractDocuments: (contractId: string) => Promise<{ documents: ContractDocumentDto[] }>;
  createContractDocument: (
    contractId: string,
    input: {
      category: DocumentCategory;
      filename: string;
      storageKey: string;
      mimeType: string;
      byteSize: number;
      description?: string;
    },
  ) => Promise<{ document: ContractDocumentDto }>;
  deleteContractDocument: (id: string) => Promise<void>;
}

export interface PaymentAdminApi {
  listPayments: (query?: {
    contractId?: string;
    category?: PaymentCategory;
    referenceMonth?: string;
    page?: number;
    limit?: number;
  }) => Promise<{
    items: (PaymentRecordDto & { derivedStatus?: DerivedPaymentStatus })[];
    pagination: { total: number; page: number; limit: number };
  }>;
  generateContractPayments: (
    contractId: string,
    referenceMonth: string,
  ) => Promise<{ payments: (PaymentRecordDto & { derivedStatus?: DerivedPaymentStatus })[] }>;
  recordPayment: (
    paymentId: string,
    input: RegisterPaymentInput,
  ) => Promise<{ payment: PaymentRecordDto & { derivedStatus?: DerivedPaymentStatus } }>;
  recordForwarding: (
    paymentId: string,
    input: RegisterForwardingInput,
  ) => Promise<{ payment: PaymentRecordDto & { derivedStatus?: DerivedPaymentStatus } }>;
}

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

export class AdminApiClient implements AuthApi, PropertyAdminApi, PropertyEditorApi, PeopleAdminApi, RentalAdminApi, PaymentAdminApi {
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

  validateProperty(id: string): Promise<{ publishable: boolean; issues: ApiFieldIssue[] }> {
    return this.request(`/properties/${encodeURIComponent(id)}/validation`);
  }

  createPropertyPreview(id: string): Promise<{ token: string; expiresAt: string; previewPath: string }> {
    return this.request(`/properties/${encodeURIComponent(id)}/preview-token`, { method: 'POST', body: '{}' });
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

  featureProperty(id: string): Promise<{ property: PropertyAdminDto }> {
    return this.request(`/properties/${encodeURIComponent(id)}/feature`, { method: 'POST', body: '{}' });
  }

  unfeatureProperty(id: string): Promise<{ property: PropertyAdminDto }> {
    return this.request(`/properties/${encodeURIComponent(id)}/feature`, { method: 'DELETE' });
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

  geocodeLocation(input: GeocodeLocationInput, signal?: AbortSignal): Promise<GeocodeLocationResponse> {
    return this.request('/location/geocode', { method: 'POST', body: JSON.stringify(input), signal });
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

  // People
  listPeople(query: { search?: string; page?: number; limit?: number } = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const suffix = search.size ? `?${search.toString()}` : '';
    return this.request<{ items: PersonDto[]; pagination: { total: number; page: number; limit: number } }>(`/people${suffix}`);
  }

  createPerson(input: CreatePersonInput) {
    return this.request<{ person: PersonDto }>('/people', { method: 'POST', body: JSON.stringify(input) });
  }

  getPerson(id: string) {
    return this.request<{ person: PersonDto }>(`/people/${encodeURIComponent(id)}`);
  }

  updatePerson(id: string, input: Partial<CreatePersonInput>) {
    return this.request<{ person: PersonDto }>(`/people/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
  }

  deletePerson(id: string) {
    return this.request<void>(`/people/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // Rentals
  listContracts(query: { status?: ContractStatus; propertyId?: string; landlordId?: string; tenantId?: string; page?: number; limit?: number } = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const suffix = search.size ? `?${search.toString()}` : '';
    return this.request<{ items: RentalContractDto[]; pagination: { total: number; page: number; limit: number } }>(`/rentals/contracts${suffix}`);
  }

  createContract(input: CreateRentalContractInput) {
    return this.request<{ contract: RentalContractDto }>('/rentals/contracts', { method: 'POST', body: JSON.stringify(input) });
  }

  getContract(id: string) {
    return this.request<{ contract: RentalContractDto }>(`/rentals/contracts/${encodeURIComponent(id)}`);
  }

  terminateContract(id: string, returnPropertyToStatus: 'draft' | 'published' | 'inactive' = 'published') {
    return this.request<{ contract: RentalContractDto }>(`/rentals/contracts/${encodeURIComponent(id)}/terminate`, {
      method: 'POST',
      body: JSON.stringify({ returnPropertyToStatus }),
    });
  }

  listContractDocuments(contractId: string) {
    return this.request<{ documents: ContractDocumentDto[] }>(`/rentals/contracts/${encodeURIComponent(contractId)}/documents`);
  }

  createContractDocument(contractId: string, input: { category: DocumentCategory; filename: string; storageKey: string; mimeType: string; byteSize: number; description?: string }) {
    return this.request<{ document: ContractDocumentDto }>(`/rentals/contracts/${encodeURIComponent(contractId)}/documents`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  deleteContractDocument(id: string) {
    return this.request<void>(`/rentals/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  // Payments
  listPayments(query: { contractId?: string; category?: PaymentCategory; referenceMonth?: string; page?: number; limit?: number } = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const suffix = search.size ? `?${search.toString()}` : '';
    return this.request<{ items: (PaymentRecordDto & { derivedStatus?: DerivedPaymentStatus })[]; pagination: { total: number; page: number; limit: number } }>(`/payments${suffix}`);
  }

  generateContractPayments(contractId: string, referenceMonth: string) {
    return this.request<{ payments: (PaymentRecordDto & { derivedStatus?: DerivedPaymentStatus })[] }>(`/rentals/contracts/${encodeURIComponent(contractId)}/payments/generate`, {
      method: 'POST',
      body: JSON.stringify({ referenceMonth }),
    });
  }

  recordPayment(paymentId: string, input: RegisterPaymentInput) {
    return this.request<{ payment: PaymentRecordDto & { derivedStatus?: DerivedPaymentStatus } }>(`/payments/${encodeURIComponent(paymentId)}/pay`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  recordForwarding(paymentId: string, input: RegisterForwardingInput) {
    return this.request<{ payment: PaymentRecordDto & { derivedStatus?: DerivedPaymentStatus } }>(`/payments/${encodeURIComponent(paymentId)}/forward`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }
}

export const adminApi = new AdminApiClient();

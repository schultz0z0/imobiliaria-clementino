export const CONSENT_VERSION = 1;
export const CONSENT_STORAGE_KEY = 'clementino.cookie-consent';

export type OptionalConsentCategory = 'functionality' | 'analytics' | 'advertising';

export interface ConsentCategories {
  necessary: true;
  functionality: boolean;
  analytics: boolean;
  advertising: boolean;
}

export interface StoredConsent {
  version: number;
  updatedAt: string;
  categories: ConsentCategories;
}

export interface ConsentStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type OptionalPreferences = Partial<Record<OptionalConsentCategory, boolean>>;

export const createConsent = (
  preferences: OptionalPreferences,
  updatedAt = new Date().toISOString(),
): StoredConsent => ({
  version: CONSENT_VERSION,
  updatedAt,
  categories: {
    necessary: true,
    functionality: preferences.functionality ?? false,
    analytics: preferences.analytics ?? false,
    advertising: preferences.advertising ?? false,
  },
});

export const acceptAllConsent = (updatedAt?: string): StoredConsent => createConsent({
  functionality: true,
  analytics: true,
  advertising: true,
}, updatedAt);

export const rejectNonEssentialConsent = (updatedAt?: string): StoredConsent => createConsent({}, updatedAt);

const isStoredConsent = (value: unknown): value is StoredConsent => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredConsent>;
  const categories = candidate.categories as Partial<ConsentCategories> | undefined;

  const hasValidTimestamp = typeof candidate.updatedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(candidate.updatedAt)
    && !Number.isNaN(Date.parse(candidate.updatedAt));

  return candidate.version === CONSENT_VERSION
    && hasValidTimestamp
    && Boolean(categories)
    && categories?.necessary === true
    && typeof categories.functionality === 'boolean'
    && typeof categories.analytics === 'boolean'
    && typeof categories.advertising === 'boolean';
};

export const readStoredConsent = (storage: ConsentStorage): StoredConsent | null => {
  try {
    const value = storage.getItem(CONSENT_STORAGE_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    return isStoredConsent(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const writeStoredConsent = (storage: ConsentStorage, consent: StoredConsent): void => {
  try {
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // The in-memory choice still applies when storage is unavailable.
  }
};

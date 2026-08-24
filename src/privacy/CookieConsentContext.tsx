import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CONSENT_STORAGE_KEY,
  acceptAllConsent,
  createConsent,
  readStoredConsent,
  rejectNonEssentialConsent,
  writeStoredConsent,
  type OptionalConsentCategory,
  type StoredConsent,
} from './consent';

type OptionalPreferences = Record<OptionalConsentCategory, boolean>;

interface CookieConsentContextValue {
  consent: StoredConsent | null;
  hasDecision: boolean;
  preferencesOpen: boolean;
  optionalPreferences: OptionalPreferences;
  accepts: (category: OptionalConsentCategory) => boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (preferences: OptionalPreferences) => void;
  enableCategory: (category: OptionalConsentCategory) => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

const disabledPreferences: OptionalPreferences = {
  functionality: false,
  analytics: false,
  advertising: false,
};

const CookieConsentContext = createContext<CookieConsentContextValue>({
  consent: null,
  hasDecision: false,
  preferencesOpen: false,
  optionalPreferences: disabledPreferences,
  accepts: () => false,
  acceptAll: () => undefined,
  rejectNonEssential: () => undefined,
  savePreferences: () => undefined,
  enableCategory: () => undefined,
  openPreferences: () => undefined,
  closePreferences: () => undefined,
});

interface CookieConsentProviderProps {
  children: ReactNode;
  initialConsent?: StoredConsent | null;
}

const readBrowserConsent = (): StoredConsent | null => {
  if (typeof window === 'undefined') return null;
  try {
    return readStoredConsent(window.localStorage);
  } catch {
    return null;
  }
};

export const CookieConsentProvider = ({ children, initialConsent }: CookieConsentProviderProps) => {
  const [consent, setConsent] = useState<StoredConsent | null>(() => (
    initialConsent === undefined ? readBrowserConsent() : initialConsent
  ));
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const lastPreferencesTrigger = useRef<HTMLElement | null>(null);

  const restorePreferencesTrigger = useCallback(() => {
    const trigger = lastPreferencesTrigger.current;
    lastPreferencesTrigger.current = null;
    if (typeof window === 'undefined' || !trigger) return;
    window.setTimeout(() => {
      if (trigger.isConnected) trigger.focus();
    }, 0);
  }, []);

  const persist = useCallback((nextConsent: StoredConsent) => {
    setConsent(nextConsent);
    if (typeof window !== 'undefined') {
      try {
        writeStoredConsent(window.localStorage, nextConsent);
      } catch {
        // Keep the choice in memory when the browser blocks local storage.
      }
    }
    setPreferencesOpen(false);
    restorePreferencesTrigger();
  }, [restorePreferencesTrigger]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const synchronize = (event: StorageEvent) => {
      if (event.key === CONSENT_STORAGE_KEY || event.key === null) setConsent(readBrowserConsent());
    };
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, []);

  const openPreferences = useCallback(() => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      lastPreferencesTrigger.current = document.activeElement;
    }
    setPreferencesOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setPreferencesOpen(false);
    restorePreferencesTrigger();
  }, [restorePreferencesTrigger]);

  const optionalPreferences = useMemo<OptionalPreferences>(() => consent ? {
    functionality: consent.categories.functionality,
    analytics: consent.categories.analytics,
    advertising: consent.categories.advertising,
  } : disabledPreferences, [consent]);

  const value = useMemo<CookieConsentContextValue>(() => ({
    consent,
    hasDecision: consent !== null,
    preferencesOpen,
    optionalPreferences,
    accepts: (category) => consent?.categories[category] ?? false,
    acceptAll: () => persist(acceptAllConsent()),
    rejectNonEssential: () => persist(rejectNonEssentialConsent()),
    savePreferences: (preferences) => persist(createConsent(preferences)),
    enableCategory: (category) => persist(createConsent({ ...optionalPreferences, [category]: true })),
    openPreferences,
    closePreferences,
  }), [closePreferences, consent, openPreferences, optionalPreferences, persist, preferencesOpen]);

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
};

export const useCookieConsent = (): CookieConsentContextValue => useContext(CookieConsentContext);

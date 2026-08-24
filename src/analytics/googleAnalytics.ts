import type { ConsentCategories } from '../privacy/consent';

type ConsentState = 'granted' | 'denied';
type GtagCommand = unknown[];

export interface AnalyticsWindow {
  dataLayer?: GtagCommand[];
  gtag?: (...args: unknown[]) => void;
}

interface AnalyticsScript {
  id?: string;
  async?: boolean;
  src?: string;
}

export interface AnalyticsDocument {
  head: { append: (node: AnalyticsScript) => void };
  createElement: (tagName: 'script') => AnalyticsScript;
  getElementById: (id: string) => unknown;
}

export interface AnalyticsEnvironment {
  analyticsWindow: AnalyticsWindow;
  analyticsDocument: AnalyticsDocument;
}

const tagId = 'clementino-google-analytics';

export const isValidGaMeasurementId = (measurementId: string | undefined): measurementId is string => (
  typeof measurementId === 'string'
  && /^G-(?!X+$)[A-Z0-9]{6,}$/i.test(measurementId.trim())
);

export const getDefaultConsentCommand = () => ({
  ad_storage: 'denied' as ConsentState,
  ad_user_data: 'denied' as ConsentState,
  ad_personalization: 'denied' as ConsentState,
  analytics_storage: 'denied' as ConsentState,
  functionality_storage: 'denied' as ConsentState,
  security_storage: 'granted' as ConsentState,
  wait_for_update: 500,
});

export const getConsentUpdate = (categories: ConsentCategories) => ({
  ad_storage: (categories.advertising ? 'granted' : 'denied') as ConsentState,
  ad_user_data: (categories.advertising ? 'granted' : 'denied') as ConsentState,
  ad_personalization: (categories.advertising ? 'granted' : 'denied') as ConsentState,
  analytics_storage: (categories.analytics ? 'granted' : 'denied') as ConsentState,
  functionality_storage: (categories.functionality ? 'granted' : 'denied') as ConsentState,
  security_storage: 'granted' as ConsentState,
});

export const createGoogleAnalyticsController = (
  measurementId: string | undefined,
  environment: AnalyticsEnvironment,
) => {
  const normalizedId = measurementId?.trim();
  let analyticsAllowed = false;
  let defaultsConfigured = false;
  let tagConfigured = false;

  const ensureGtag = () => {
    const target = environment.analyticsWindow;
    target.dataLayer ??= [];
    target.gtag ??= (...args: unknown[]) => target.dataLayer?.push(args);
    if (!defaultsConfigured) {
      target.gtag('consent', 'default', getDefaultConsentCommand());
      defaultsConfigured = true;
    }
    return target.gtag;
  };

  const loadTag = () => {
    if (!isValidGaMeasurementId(normalizedId) || tagConfigured) return false;
    const gtag = ensureGtag();
    if (!environment.analyticsDocument.getElementById(tagId)) {
      const script = environment.analyticsDocument.createElement('script');
      script.id = tagId;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${normalizedId}`;
      environment.analyticsDocument.head.append(script);
    }
    gtag('js', new Date());
    gtag('config', normalizedId, { send_page_view: false });
    tagConfigured = true;
    return true;
  };

  return {
    updateConsent(categories: ConsentCategories) {
      const gtag = ensureGtag();
      analyticsAllowed = categories.analytics && isValidGaMeasurementId(normalizedId);
      gtag('consent', 'update', getConsentUpdate(categories));
      if (analyticsAllowed) loadTag();
    },
    track(eventName: string, parameters: Record<string, string | number | boolean> = {}) {
      if (!analyticsAllowed || !isValidGaMeasurementId(normalizedId)) return false;
      ensureGtag()('event', eventName, parameters);
      return true;
    },
  };
};

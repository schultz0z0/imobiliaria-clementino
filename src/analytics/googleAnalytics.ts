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

export const isValidGoogleAdsId = (adsId: string | undefined): adsId is string => (
  typeof adsId === 'string'
  && /^AW-[0-9]{6,}$/i.test(adsId.trim())
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

export interface GoogleAnalyticsControllerOptions {
  adsId?: string;
}

export const createGoogleAnalyticsController = (
  measurementId: string | undefined,
  environment: AnalyticsEnvironment,
  options?: GoogleAnalyticsControllerOptions,
) => {
  const normalizedGaId = measurementId?.trim();
  const normalizedAdsId = options?.adsId?.trim();
  const primaryId = isValidGaMeasurementId(normalizedGaId)
    ? normalizedGaId
    : (isValidGoogleAdsId(normalizedAdsId) ? normalizedAdsId : undefined);

  let analyticsAllowed = false;
  let advertisingAllowed = false;
  let defaultsConfigured = false;
  let tagConfigured = false;
  let adsConfigured = false;

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
    if (!primaryId || tagConfigured) return false;
    const gtag = ensureGtag();
    if (!environment.analyticsDocument.getElementById(tagId)) {
      const script = environment.analyticsDocument.createElement('script');
      script.id = tagId;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${primaryId}`;
      environment.analyticsDocument.head.append(script);
    }
    gtag('js', new Date());
    if (isValidGaMeasurementId(normalizedGaId)) {
      gtag('config', normalizedGaId, { send_page_view: false });
    }
    tagConfigured = true;
    return true;
  };

  const configureAds = () => {
    if (!isValidGoogleAdsId(normalizedAdsId) || adsConfigured || !advertisingAllowed) return false;
    const gtag = ensureGtag();
    gtag('config', normalizedAdsId);
    adsConfigured = true;
    return true;
  };

  return {
    updateConsent(categories: ConsentCategories) {
      const gtag = ensureGtag();
      analyticsAllowed = Boolean(categories.analytics && isValidGaMeasurementId(normalizedGaId));
      advertisingAllowed = Boolean(categories.advertising && isValidGoogleAdsId(normalizedAdsId));
      gtag('consent', 'update', getConsentUpdate(categories));
      if (analyticsAllowed || advertisingAllowed) {
        loadTag();
        if (advertisingAllowed) {
          configureAds();
        }
      }
    },
    track(eventName: string, parameters: Record<string, string | number | boolean> = {}) {
      if ((!analyticsAllowed && !advertisingAllowed) || !primaryId) return false;
      ensureGtag()('event', eventName, parameters);
      return true;
    },
  };
};

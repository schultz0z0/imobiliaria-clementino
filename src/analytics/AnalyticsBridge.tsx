import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useCookieConsent } from '../privacy/CookieConsentContext';
import { createConsent } from '../privacy/consent';
import { createGoogleAnalyticsController, type AnalyticsEnvironment } from './googleAnalytics';

const disabledCategories = createConsent({}).categories;

const browserEnvironment = (): AnalyticsEnvironment => ({
  analyticsWindow: window as unknown as AnalyticsEnvironment['analyticsWindow'],
  analyticsDocument: document as unknown as AnalyticsEnvironment['analyticsDocument'],
});

export const AnalyticsBridge = () => {
  const location = useLocation();
  const { consent } = useCookieConsent();
  const controller = useMemo(() => createGoogleAnalyticsController(
    import.meta.env.VITE_GA_MEASUREMENT_ID,
    browserEnvironment(),
  ), []);
  const categories = consent?.categories ?? disabledCategories;

  useEffect(() => {
    controller.updateConsent(categories);
  }, [categories.advertising, categories.analytics, categories.functionality, controller]);

  useEffect(() => {
    controller.track('page_view', {
      page_path: location.pathname,
      page_title: document.title,
    });
  }, [controller, location.pathname]);

  useEffect(() => {
    const trackInteraction = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return;
      const taggedElement = target.closest<HTMLElement>('[data-analytics-event]');
      const whatsappLink = target.closest<HTMLAnchorElement>('a[href^="https://wa.me/"]');
      const eventName = taggedElement?.dataset.analyticsEvent ?? (whatsappLink ? 'whatsapp_click' : undefined);
      if (!eventName) return;
      controller.track(eventName, {
        page_path: window.location.pathname,
        ...(taggedElement?.dataset.analyticsLabel ? { item_label: taggedElement.dataset.analyticsLabel } : {}),
      });
    };

    const click = (event: MouseEvent) => trackInteraction(event.target);
    const submit = (event: SubmitEvent) => trackInteraction(event.target);
    document.addEventListener('click', click);
    document.addEventListener('submit', submit);
    return () => {
      document.removeEventListener('click', click);
      document.removeEventListener('submit', submit);
    };
  }, [controller]);

  return null;
};

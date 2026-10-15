import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { marketingConfig } from '../config/marketingConfig';
import { useCookieConsent } from '../privacy/CookieConsentContext';
import type { WebsiteProperty } from '../types/property';
import { createMetaPixelController, isPropertyTrackingPath, isPublicTrackingPath, normalizeTrackingPath, type MetaPixelWindow } from './metaPixel';

type Controller = ReturnType<typeof createMetaPixelController>;
type TrackingContext = { controller: Controller; synchronize: () => void; allowed: boolean; path: string; visit: string };
const MetaPixelContext = createContext<TrackingContext | null>(null);
const preparedRequestEvent = 'clementino:request-prepared';

// Only a fixed event name crosses this boundary. Form values never do.
export const notifyPreparedRequest = (event: 'VisitRequest' | 'ContactRequest'): void => {
  window.dispatchEvent(new window.CustomEvent(preparedRequestEvent, { detail: event }));
};

export const MetaPixelProvider = ({ children }: { children: ReactNode }) => {
  const { pathname, key: visit } = useLocation();
  const path = normalizeTrackingPath(pathname);
  const { consent } = useCookieConsent();
  const allowed = Boolean(consent?.categories.advertising) && isPublicTrackingPath(path);
  const controller = useMemo(() => createMetaPixelController(
    import.meta.env.VITE_META_PIXEL_ID ?? marketingConfig.metaPixelId,
    { window: window as unknown as MetaPixelWindow, document },
  ), []);
  const synchronize = useCallback(() => {
    controller.beginRoute(path, visit);
    controller.setConsent(allowed);
    // A property is counted only after its published record is resolved below.
    if (!isPropertyTrackingPath(path)) controller.pageView(path, visit);
  }, [allowed, controller, path, visit]);

  useEffect(synchronize, [synchronize]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const whatsapp = event.target.closest('a[href^="https://wa.me/"]');
      const visitForm = event.target.closest('button[data-meta-cta="visit"]');
      if (!whatsapp && !visitForm) return;
      synchronize();
      if (whatsapp) controller.contact();
      else controller.openVisitForm();
    };
    const request = (event: Event) => {
      const name: unknown = (event as CustomEvent).detail;
      if (name !== 'VisitRequest' && name !== 'ContactRequest') return;
      synchronize();
      controller.requestPrepared(name);
    };
    document.addEventListener('click', click);
    window.addEventListener(preparedRequestEvent, request);
    return () => {
      document.removeEventListener('click', click);
      window.removeEventListener(preparedRequestEvent, request);
    };
  }, [controller, synchronize]);

  const value = useMemo(() => ({ controller, synchronize, allowed, path, visit }), [controller, synchronize, allowed, path, visit]);
  return <MetaPixelContext.Provider value={value}>{children}</MetaPixelContext.Provider>;
};

export const useMetaPropertyView = (property: WebsiteProperty | null | undefined, enabled: boolean): void => {
  const context = useContext(MetaPixelContext);
  useEffect(() => {
    if (!context) return;
    context.synchronize();
    if (property && enabled && context.allowed) context.controller.viewProperty(property, context.path, context.visit);
  }, [context, enabled, property]);
};

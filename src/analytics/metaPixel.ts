import type { WebsiteProperty } from '../types/property';
import type { MetaCta } from './metaCtas';

type MetaQuery = ((...args: unknown[]) => void) & {
  queue?: unknown[][];
  callMethod?: (...args: unknown[]) => void;
  push?: MetaQuery;
  loaded?: boolean;
  version?: string;
  disablePushState?: boolean;
};
export type MetaPixelWindow = { fbq?: MetaQuery; _fbq?: MetaQuery };
type PixelState = { allowed: boolean; initialized: boolean; pageKey?: string; viewKey?: string; path?: string; routeKey?: string; property?: Pick<WebsiteProperty, 'id' | 'reference'> };
const states = new WeakMap<MetaPixelWindow, Map<string, PixelState>>();
const staticPaths = new Set(['/', '/imoveis', '/sobre', '/servicos', '/contato', '/aviso-de-privacidade', '/politica-de-cookies']);
export const normalizeTrackingPath = (path: string): string => path.replace(/\/+$/, '') || '/';
export const isPropertyTrackingPath = (path: string): boolean => /^\/imoveis\/[a-zA-Z0-9-]{1,200}$/.test(normalizeTrackingPath(path));
export const isPublicTrackingPath = (path: string): boolean => staticPaths.has(normalizeTrackingPath(path)) || isPropertyTrackingPath(path);

export const createMetaPixelController = (pixelId: string, environment: { window: MetaPixelWindow; document: Document }) => {
  const id = pixelId.trim();
  const valid = /^[0-9]{5,25}$/.test(id);
  let pixels = states.get(environment.window);
  if (!pixels) { pixels = new Map(); states.set(environment.window, pixels); }
  let state = pixels.get(id);
  if (!state) { state = { allowed: false, initialized: false }; pixels.set(id, state); }

  const command = (...args: unknown[]): boolean => {
    try { environment.window.fbq?.(...args); return true; }
    catch { return false; } // A tracker blocker must never break site navigation.
  };
  const initialize = (): boolean => {
    if (!valid || !state.allowed) return false;
    if (state.initialized) return true;
    const target = environment.window;
    if (!target.fbq) {
      const query: MetaQuery = (...args) => {
        if (query.callMethod) query.callMethod(...args);
        else query.queue!.push(args);
      };
      query.queue = []; query.push = query; query.loaded = true; query.version = '2.0';
      target.fbq = query;
      target._fbq ??= query;
    }
    // fbevents.js otherwise wraps pushState/replaceState and emits automatic
    // PageViews in addition to our router events. Verified in Meta's SDK.
    target.fbq.disablePushState = true;
    command('set', 'autoConfig', false, id);
    command('init', id);
    command('consent', 'grant');
    state.initialized = true;
    if (!environment.document.getElementById('clementino-meta-pixel')) {
      const script = environment.document.createElement('script');
      script.id = 'clementino-meta-pixel'; script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      environment.document.head.append(script);
    }
    return true;
  };
  const beginRoute = (path: string, visit: string) => {
    path = normalizeTrackingPath(path);
    const key = `${visit}:${path}`;
    if (state.routeKey === key) return;
    state.routeKey = key;
    state.path = undefined;
    state.property = undefined;
  };
  const pageView = (path: string, visit: string): boolean => {
    path = normalizeTrackingPath(path);
    beginRoute(path, visit);
    if (!isPublicTrackingPath(path) || !initialize()) return false;
    const key = `${visit}:${path}`;
    state.path = path;
    if (state.pageKey === key) return false;
    state.pageKey = key;
    return command('trackSingle', id, 'PageView');
  };
  const actionParameters = (cta: string) => ({
    ...(state.property ? { content_ids: [state.property.id], content_type: 'product', content_name: state.property.reference } : {}),
    cta_type: cta,
  });
  const ctaParameters = (cta: MetaCta) => {
    // Even when card data is missing, never attribute a destination click to
    // the listing whose page contains that card.
    const property = cta.kind === 'property_open' ? cta.property : state.property;
    return {
      ...(property ? { content_ids: [property.id], content_type: 'product', ...(property.reference ? { content_name: property.reference } : {}) } : {}),
      cta_type: cta.kind,
      cta_id: cta.cta_id, cta_location: cta.cta_location, cta_position: cta.cta_position,
      page_path: state.path,
      ...(cta.target_path ? { target_path: cta.target_path } : {}),
    };
  };
  return {
    beginRoute,
    setConsent(allowed: boolean) {
      if (state.allowed === allowed) return;
      state.allowed = allowed;
      if (!allowed) {
        // If the SDK download has not finished, discard unsent events rather
        // than flushing them after consent was withdrawn.
        const queue = environment.window.fbq?.queue;
        if (queue && !environment.window.fbq?.callMethod) {
          queue.splice(0, queue.length, ['consent', 'revoke'], ...queue.filter((entry) => !String(entry[0]).startsWith('track') && entry[0] !== 'consent'));
        } else if (state.initialized) command('consent', 'revoke');
        state.pageKey = undefined; state.viewKey = undefined; state.path = undefined; state.property = undefined;
      } else if (state.initialized) {
        const query = environment.window.fbq;
        if (query?.queue && !query.callMethod) {
          query.queue.splice(0, query.queue.length, ['consent', 'grant'], ...query.queue.filter((entry) => entry[0] !== 'consent'));
        } else command('consent', 'grant');
      }
    },
    pageView,
    viewProperty(property: WebsiteProperty, path: string, visit: string): boolean {
      path = normalizeTrackingPath(path);
      if (path !== `/imoveis/${property.slug}` || !isPropertyTrackingPath(path) || !initialize()) return false;
      pageView(path, visit);
      state.property = { id: property.id, reference: property.reference };
      const key = `${visit}:${path}:${property.id}`;
      if (state.viewKey === key) return false;
      state.viewKey = key;
      return command('trackSingle', id, 'ViewContent', {
        content_ids: [property.id], content_type: 'product', content_name: property.reference,
        content_category: property.propertyType, listing_type: property.type,
      });
    },
    contact(): boolean {
      return state.allowed && Boolean(state.path) && initialize() && command('trackSingle', id, 'Contact', actionParameters('whatsapp'));
    },
    trackCta(cta: MetaCta): boolean {
      if (!state.allowed || !state.path || !initialize()) return false;
      const parameters = ctaParameters(cta);
      // Contact and CtaClick are separate funnel stages, never two Contacts.
      if (['whatsapp', 'phone', 'email'].includes(cta.kind)) command('trackSingle', id, 'Contact', parameters);
      if (cta.kind === 'visit') command('trackSingleCustom', id, 'VisitFormOpen', { ...parameters, cta_type: 'visit_form' });
      if (cta.kind === 'map') command('trackSingle', id, 'FindLocation', parameters);
      return command('trackSingleCustom', id, 'CtaClick', parameters);
    },
    search(cta: MetaCta): boolean {
      return cta.kind === 'search' && state.allowed && Boolean(state.path) && initialize() && command('trackSingle', id, 'Search', ctaParameters(cta));
    },
    openVisitForm(): boolean {
      return state.allowed && Boolean(state.path) && initialize() && command('trackSingleCustom', id, 'VisitFormOpen', actionParameters('visit_form'));
    },
    requestPrepared(event: 'VisitRequest' | 'ContactRequest'): boolean {
      if (event !== 'VisitRequest' && event !== 'ContactRequest') return false;
      return state.allowed && Boolean(state.path) && initialize() && command('trackSingleCustom', id, event, actionParameters(event === 'VisitRequest' ? 'visit_request' : 'contact_request'));
    },
  };
};

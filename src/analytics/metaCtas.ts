import { isPublicTrackingPath, normalizeTrackingPath } from './metaPixel';

export type MetaCta = {
  kind: 'whatsapp' | 'phone' | 'email' | 'navigate' | 'property_open' | 'anchor' | 'map' | 'visit' | 'search' | 'button' | 'external';
  cta_id: string;
  cta_location: string;
  cta_position: number;
  target_path?: string;
  property?: { id: string; reference?: string };
};
const actions = 'a[href],button,[role="button"],[role="option"],form[data-meta-search]';
const identifier = (value: string | null): string | undefined => value && /^[a-z][a-z0-9_]{0,63}$/.test(value) ? value : undefined;

/** Read only technical attributes. Never collect textContent, form values,
 * search terms, contact destinations or URLs containing a prepared message. */
export const getMetaCta = (target: Element, origin: string): MetaCta | null => {
  const element = target.closest(actions);
  if (!element || element.closest('[data-meta-ignore]') || element.matches(':disabled,[aria-disabled="true"]')) return null;
  if (element.matches('form[data-meta-search]') && target !== element) return null;
  const region = element.closest('[data-meta-location]');
  const scope = region ?? element.closest('nav,footer,section,main') ?? element.ownerDocument.body;
  const location = identifier(region?.getAttribute('data-meta-location') ?? null)
    ?? (element.closest('footer') ? 'footer' : element.closest('nav') ? 'navbar' : scope.tagName === 'SECTION' ? `section_${[...element.ownerDocument.querySelectorAll<Element>('section')].indexOf(scope) + 1}` : 'main');
  let kind: MetaCta['kind'] = element.getAttribute('data-meta-cta') === 'visit' ? 'visit' : 'button';
  let path: string | undefined;
  const href = element.getAttribute('href');
  if (href !== null) {
    let url: URL;
    try { url = new URL(href, origin); } catch { return null; }
    if (url.protocol === 'tel:') kind = 'phone';
    else if (url.protocol === 'mailto:') kind = 'email';
    else if (!['https:', 'http:'].includes(url.protocol)) return null;
    else if (['wa.me', 'api.whatsapp.com', 'web.whatsapp.com'].includes(url.hostname)) kind = 'whatsapp';
    else if (['www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl'].includes(url.hostname) && (url.pathname.startsWith('/maps') || url.hostname === 'maps.app.goo.gl')) kind = 'map';
    else if (url.origin === origin) {
      if (!isPublicTrackingPath(url.pathname)) return null;
      kind = href.startsWith('#') ? 'anchor' : element.hasAttribute('data-meta-property-id') ? 'property_open' : 'navigate';
      path = normalizeTrackingPath(url.pathname);
    } else kind = 'external';
  }
  if (element.matches('form[data-meta-search]') || (element.matches('button[type="submit"]') && element.closest('form[data-meta-search]'))) kind = 'search';
  const id = identifier(element.getAttribute('data-meta-id'))
    ?? (kind === 'search' ? identifier(element.closest('form[data-meta-search]')?.getAttribute('data-meta-id') ?? null) : undefined)
    ?? (kind === 'navigate' ? `navigate_${path === '/' ? 'home' : path!.slice(1).replaceAll('/', '_')}` : kind === 'property_open' ? 'open_property' : kind === 'visit' ? 'open_visit_form' : kind);
  const result: MetaCta = { kind, cta_id: id, cta_location: location, cta_position: Math.max(1, [...scope.querySelectorAll(actions)].indexOf(element) + 1) };
  if (path && !href?.startsWith('#')) result.target_path = path;
  if (kind === 'property_open') {
    const propertyId = element.getAttribute('data-meta-property-id');
    const reference = element.getAttribute('data-meta-property-reference');
    if (propertyId && /^[a-zA-Z0-9_-]{1,100}$/.test(propertyId)) {
      // References are public listing data; the admin permits spaces, accents
      // and punctuation. A missing reference must not discard the stable id.
      result.property = { id: propertyId };
      if (reference?.trim() && reference.length <= 64 && !/[\x00-\x1f\x7f]/.test(reference)) result.property.reference = reference;
    }
  }
  return result;
};

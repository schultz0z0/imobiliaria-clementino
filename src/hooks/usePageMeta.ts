import { useEffect } from 'react';
import type { PageMetadata } from '../config/pageMetadata';

const ensureMeta = (selector: string, attributes: Record<string, string>): HTMLMetaElement => {
  let meta = document.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement('meta');
    Object.entries(attributes).forEach(([name, value]) => meta?.setAttribute(name, value));
    document.head.append(meta);
  }
  return meta;
};

const ensureCanonical = (): HTMLLinkElement => {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.append(link);
  }
  return link;
};

export const usePageMeta = (metadata: PageMetadata): void => {
  useEffect(() => {
    document.title = metadata.title;
    ensureMeta('meta[name="description"]', { name: 'description' }).content = metadata.description;
    ensureMeta('meta[name="robots"]', { name: 'robots' }).content = metadata.robots;
    ensureCanonical().href = metadata.canonical;

    const openGraph: Record<string, string> = {
      'og:locale': 'pt_BR',
      'og:site_name': 'Imobiliária Clementino',
      'og:type': metadata.openGraphType,
      'og:title': metadata.title,
      'og:description': metadata.description,
      'og:url': metadata.canonical,
      'og:image': metadata.image,
      'og:image:alt': metadata.imageAlt,
    };
    Object.entries(openGraph).forEach(([property, content]) => {
      ensureMeta(`meta[property="${property}"]`, { property }).content = content;
    });

    const twitter: Record<string, string> = {
      'twitter:card': 'summary_large_image',
      'twitter:title': metadata.title,
      'twitter:description': metadata.description,
      'twitter:image': metadata.image,
      'twitter:image:alt': metadata.imageAlt,
    };
    Object.entries(twitter).forEach(([name, content]) => {
      ensureMeta(`meta[name="${name}"]`, { name }).content = content;
    });
  }, [metadata]);
};

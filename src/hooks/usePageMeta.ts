import { useEffect } from 'react';
import type { PageMetadata } from '../config/pageMetadata';

export const usePageMeta = ({ title, description }: PageMetadata): void => {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.append(meta);
    }
    meta.content = description;
  }, [description, title]);
};

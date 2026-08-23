import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { shouldResetScroll } from '../navigation/scrollPolicy';

export const ScrollToTop = () => {
  const { hash, pathname } = useLocation();
  const previousPath = useRef(pathname);

  useLayoutEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;

    if (shouldResetScroll(previous, pathname, hash)) {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
  }, [hash, pathname]);

  return null;
};

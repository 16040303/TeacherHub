import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const getWindowScrollY = (): number => {
  if (typeof window === 'undefined') {
    return 0;
  }

  return window.scrollY || document.documentElement.scrollTop || 0;
};

const scrollWindowTo = (top: number): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.scrollTo({ left: 0, top, behavior: 'auto' });
};

const scrollToHashTarget = (hash: string): boolean => {
  if (!hash || typeof document === 'undefined') {
    return false;
  }

  const decodedId = decodeURIComponent(hash.replace(/^#/, ''));

  if (!decodedId) {
    return false;
  }

  const target = document.getElementById(decodedId);

  if (!target) {
    return false;
  }

  target.scrollIntoView();
  return true;
};

export const ScrollManager = (): null => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const previousLocationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) {
      return;
    }

    const { scrollRestoration } = window.history;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = scrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    const previousLocationKey = previousLocationKeyRef.current;

    if (previousLocationKey) {
      scrollPositionsRef.current[previousLocationKey] = getWindowScrollY();
    }

    if (!scrollToHashTarget(location.hash)) {
      if (navigationType === 'POP') {
        const savedPosition = scrollPositionsRef.current[location.key] ?? 0;
        scrollWindowTo(savedPosition);
      } else {
        scrollWindowTo(0);
      }
    }

    previousLocationKeyRef.current = location.key;
  }, [location.hash, location.key, navigationType]);

  return null;
};

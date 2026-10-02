import { useSyncExternalStore } from 'react';

/** Whether a CSS media query currently matches, kept in sync with resizes. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Same breakpoint as $breakpoint-tablet in styles/_mixins.scss. */
export const FROM_TABLET = '(min-width: 640px)';

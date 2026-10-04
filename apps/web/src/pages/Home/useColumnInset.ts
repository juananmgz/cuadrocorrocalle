import { type RefObject, useLayoutEffect, useState } from 'react';

import { FROM_TABLET, useMediaQuery } from '../../hooks';

/**
 * Right edge of the left column on tablets and PCs, so the grid centres on the space beside it:
 * (W - wl) / 2 + wl. On phones the column is in the page flow and nothing is covered.
 */
export function useColumnInset(columnRef: RefObject<HTMLElement | null>) {
  const [inset, setInset] = useState(0);
  const wide = useMediaQuery(FROM_TABLET);

  useLayoutEffect(() => {
    const column = columnRef.current;
    if (!column || !wide) return setInset(0);

    const measure = () => setInset(column.getBoundingClientRect().right);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(column);
    return () => observer.disconnect();
  }, [columnRef, wide]);

  return inset;
}

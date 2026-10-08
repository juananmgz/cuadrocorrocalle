import { useEffect, useRef } from 'react';

/**
 * On a keyboard, Space pauses (or goes on) and the left and right arrows go back and on, unless
 * something else wants the key: a field being typed in, a focused button, a dialog or a menu.
 */
export function useCycleKeys(
  enabled: boolean,
  actions: { onPrevious: () => void; onToggle: () => void; onNext: () => void },
) {
  // The latest actions, so the listener does not change with every render.
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      const typing = target?.closest('input, textarea, select, [contenteditable], [role=combobox]');
      if (typing || document.querySelector('[role=dialog], [role=menu]')) return;
      if (event.key === ' ') {
        // A focused button keeps its own Space.
        if (target?.closest('button, a')) return;
        event.preventDefault();
        latest.current.onToggle();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (event.key === 'ArrowLeft') latest.current.onPrevious();
        else latest.current.onNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

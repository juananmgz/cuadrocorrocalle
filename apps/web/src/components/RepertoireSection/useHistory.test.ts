import { act, renderHook } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { useHistory } from './useHistory';

test('undoes and redoes steps, and changes close together go back as one', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useHistory<string>());

  act(() => result.current.record('a'));
  vi.advanceTimersByTime(1000);
  act(() => result.current.record('b'));
  // Typing on: one step with the change just before.
  vi.advanceTimersByTime(100);
  act(() => result.current.record('bc'));
  expect(result.current.canUndo).toBe(true);

  let step: string | null = null;
  act(() => {
    step = result.current.undo('bcd');
  });
  expect(step).toBe('b');
  act(() => {
    step = result.current.undo('b');
  });
  expect(step).toBe('a');
  expect(result.current.canUndo).toBe(false);

  act(() => {
    step = result.current.redo('a');
  });
  expect(step).toBe('b');
  act(() => {
    step = result.current.redo('b');
  });
  expect(step).toBe('bcd');
  expect(result.current.canRedo).toBe(false);

  // A new change after undoing forgets what could be redone.
  act(() => {
    result.current.undo('bcd');
  });
  act(() => result.current.record('b'));
  expect(result.current.canRedo).toBe(false);
  vi.useRealTimers();
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

import { ToastProvider } from '../ui/Toast/Toast';
import { useStageEditing } from './useStageEditing';

// 10 × 8 m, half-metre squares, drawn 40 px a square with its centre at (500, 400).
const stage = { width: 10, depth: 8, squareSize: 0.5, edgeDistance: 0.25 };
const view = { originX: 500, originY: 400, cell: 40, left: 0 };
const pair = (id: string, x: number) => ({
  id,
  kind: 'pair' as const,
  x,
  y: 0,
  rotation: 0 as const,
  width: 2,
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

function setup() {
  const onChange = vi.fn();
  const hook = renderHook(
    () =>
      useStageEditing({
        content: { participants: [], figures: [pair('a', -2), pair('b', 2)] },
        pieceType: 'dance',
        stage,
        view,
        people: new Map(),
        groupId: 'g1',
        figureDefaults: {},
        onChange,
      }),
    { wrapper },
  );
  return { ...hook, onChange };
}

/** A press, a drag and a release of the pointer on the floor, in screen px. */
function drawBox(from: { x: number; y: number }, to: { x: number; y: number }) {
  const floor = document.createElement('div');
  floor.dataset.gridFloor = '';
  document.body.append(floor);
  act(() => {
    floor.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX: from.x, clientY: from.y }),
    );
  });
  act(() => {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: to.x, clientY: to.y }));
  });
  act(() => {
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: to.x, clientY: to.y }));
  });
  floor.remove();
}

test('picks one figure, or several, with a box, a click or Shift + click', () => {
  const { result } = setup();
  // A box round the pair on the left only (2 m left of the centre is 160 px).
  drawBox({ x: 300, y: 360 }, { x: 380, y: 440 });
  expect([...result.current.layer.groupIds!]).toEqual(['a']);

  act(() => result.current.layer.onToggleInGroup!('b', true));
  expect([...result.current.layer.groupIds!]).toEqual(['a', 'b']);
  act(() => result.current.layer.onToggleInGroup!('a', true));
  expect([...result.current.layer.groupIds!]).toEqual(['b']);

  // A plain click on a figure picks it alone.
  act(() => result.current.layer.onToggleInGroup!('a', false));
  expect([...result.current.layer.groupIds!]).toEqual(['a']);

  // A click on the empty floor lets go.
  drawBox({ x: 900, y: 700 }, { x: 900, y: 700 });
  expect(result.current.layer.groupIds!.size).toBe(0);
});

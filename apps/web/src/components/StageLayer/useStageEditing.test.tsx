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

test('copies several figures with Ctrl+C and pastes them beside, as they stand, with Ctrl+V', () => {
  const { result, onChange } = setup();
  // A box round both pairs.
  drawBox({ x: 300, y: 360 }, { x: 700, y: 440 });
  expect(result.current.layer.groupIds!.size).toBe(2);

  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
  });
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
  });

  const pasted = onChange.mock.lastCall![0].figures as { id: string; x: number; y: number }[];
  expect(pasted).toHaveLength(4);
  const [a, b, copyA, copyB] = pasted;
  expect([a!.id, b!.id]).toEqual(['a', 'b']);
  // Moved together: the copies keep the 4 m between them.
  expect(copyB!.x - copyA!.x).toBe(4);
  expect(copyA!.y - a!.y).toBe(copyB!.y - b!.y);
  expect(copyA!.x !== a!.x || copyA!.y !== a!.y).toBe(true);
});

test('pastes into another piece with the people who are not there yet; the rest leave holes', () => {
  const onChange = vi.fn();
  const person = (personId: string, figureId: string, slot: number) => ({
    personId,
    roles: ['dance' as const],
    x: 0,
    y: 0,
    figureId,
    slot,
  });
  const usePiece = (content: {
    participants: ReturnType<typeof person>[];
    figures: ReturnType<typeof pair>[];
  }) =>
    useStageEditing({
      content,
      pieceType: 'dance',
      stage,
      view,
      people: new Map(),
      groupId: 'g1',
      figureDefaults: {},
      onChange,
    });
  const first = {
    participants: [person('ana', 'a', 0), person('luis', 'a', 1)],
    figures: [pair('a', -2)],
  };
  // The next piece has Luis already, in a pair of its own on the right.
  const second = { participants: [person('luis', 'z', 0)], figures: [pair('z', 3)] };
  const { result, rerender } = renderHook((content) => usePiece(content), {
    wrapper,
    initialProps: first,
  });

  drawBox({ x: 300, y: 360 }, { x: 380, y: 440 });
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }));
  });
  rerender(second);
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true }));
  });

  const pasted = onChange.mock.lastCall![0];
  const copy = pasted.figures.find((figure: { id: string }) => figure.id !== 'z');
  // Where it was in the first piece, as there is room.
  expect(copy).toMatchObject({ kind: 'pair', x: -2, y: 0 });
  expect(pasted.participants).toEqual([
    expect.objectContaining({ personId: 'luis', figureId: 'z' }),
    expect.objectContaining({ personId: 'ana', figureId: copy.id, slot: 0 }),
  ]);
  expect(result.current).toBeTruthy();
});

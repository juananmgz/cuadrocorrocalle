import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { PIECE_SECONDS, PieceCycle } from './PieceCycle';

const piece = (id: string, title: string, encore = false) => ({
  id,
  title,
  type: 'dance' as const,
  durationSeconds: null,
  structure: null,
  optional: false,
  encore,
  instruments: [],
  participants: [],
  figures: [],
});
const pieces = [piece('b', 'Bis final', true), piece('a', 'Cibanal'), piece('c', 'Jota')];
vi.mock('../../pieces/repertoireApi', () => ({ useRepertoire: () => ({ data: pieces }) }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('shows each piece in turn, the encores last, and jumps to one clicked', () => {
  const onPiece = vi.fn();
  render(<PieceCycle performanceId="p1" onPiece={onPiece} />);

  expect(screen.getByText('Cibanal')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(PIECE_SECONDS * 1000));
  expect(screen.getByText('Jota')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(PIECE_SECONDS * 1000));
  expect(screen.getByText('Bis final')).toBeInTheDocument();
  expect(onPiece).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Bis final' }));

  act(() => screen.getByRole('button', { name: 'Ver Cibanal' }).click());
  expect(screen.getByText('Cibanal')).toBeInTheDocument();

  // Paused, it stays.
  act(() => screen.getByRole('button', { name: 'Pausar' }).click());
  act(() => vi.advanceTimersByTime(PIECE_SECONDS * 3000));
  expect(screen.getByText('Cibanal')).toBeInTheDocument();
});

test('goes back and on with its buttons and the arrows, and Space pauses', () => {
  render(<PieceCycle performanceId="p1" onPiece={vi.fn()} />);

  act(() => screen.getByRole('button', { name: 'Pieza anterior' }).click());
  // From the first, back goes round to the last.
  expect(screen.getByText('Bis final')).toBeInTheDocument();
  act(() => screen.getByRole('button', { name: 'Pieza siguiente' }).click());
  expect(screen.getByText('Cibanal')).toBeInTheDocument();

  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  });
  expect(screen.getByText('Jota')).toBeInTheDocument();
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  });
  expect(screen.getByText('Cibanal')).toBeInTheDocument();

  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  });
  expect(screen.getByRole('button', { name: 'Seguir pasando las piezas' })).toBeInTheDocument();
});

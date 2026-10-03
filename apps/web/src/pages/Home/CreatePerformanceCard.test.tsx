import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { CreatePerformanceCard } from './CreatePerformanceCard';

// Many typed steps: a longer timeout keeps it stable on a busy machine.
test('previews the stage when leaving each field', { timeout: 20_000 }, async () => {
  const user = userEvent.setup();
  const onStageChange = vi.fn();

  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreatePerformanceCard
        groupId="group-1"
        onCancel={() => {}}
        onCreated={() => {}}
        onStageChange={onStageChange}
      />
    </QueryClientProvider>,
  );
  const last = () => onStageChange.mock.lastCall;

  // A new performance starts with a 10 × 8 m stage at 0,5 m per square.
  expect(last()).toEqual([{ cols: 20, rows: 16, edge: 0.5 }]);

  await user.clear(screen.getByLabelText('Ancho (m)'));
  // Only whole metres can be typed.
  await user.type(screen.getByLabelText('Ancho (m)'), '9,5e');
  await user.clear(screen.getByLabelText('Fondo (m)'));
  await user.type(screen.getByLabelText('Fondo (m)'), '6');
  expect(screen.getByLabelText('Ancho (m)')).toHaveValue('95');
  await user.clear(screen.getByLabelText('Ancho (m)'));
  await user.type(screen.getByLabelText('Ancho (m)'), '9');
  // Still typing the new width: the grid keeps the sizes applied on leaving each field (95 × 6 m).
  expect(last()).toEqual([{ cols: 190, rows: 12, edge: 0.5 }]);

  await user.click(screen.getByLabelText('Lugar (opcional)'));
  expect(last()).toEqual([{ cols: 18, rows: 12, edge: 0.5 }]);

  // Below the minimum sizes, the width goes to 4 m and the depth to 2 m.
  await user.clear(screen.getByLabelText('Ancho (m)'));
  await user.type(screen.getByLabelText('Ancho (m)'), '2');
  await user.clear(screen.getByLabelText('Fondo (m)'));
  await user.type(screen.getByLabelText('Fondo (m)'), '1');
  await user.click(screen.getByLabelText('Lugar (opcional)'));
  expect(last()).toEqual([{ cols: 8, rows: 4, edge: 0.5 }]);
  await user.clear(screen.getByLabelText('Ancho (m)'));
  await user.type(screen.getByLabelText('Ancho (m)'), '9');
  await user.clear(screen.getByLabelText('Fondo (m)'));
  await user.type(screen.getByLabelText('Fondo (m)'), '6');
  await user.click(screen.getByLabelText('Lugar (opcional)'));

  // The edge distance cannot go below 0,25 m.
  await user.clear(screen.getByLabelText('Borde (m)'));
  await user.type(screen.getByLabelText('Borde (m)'), '0,1');
  await user.click(screen.getByLabelText('Lugar (opcional)'));
  expect(screen.getByLabelText('Borde (m)')).toHaveValue('0,25');
  await user.clear(screen.getByLabelText('Borde (m)'));
  await user.type(screen.getByLabelText('Borde (m)'), '1');
  await user.click(screen.getByLabelText('Lugar (opcional)'));

  // With 2 m per square, the 9 × 6 m stage covers 4,5 × 3 squares.
  await user.click(screen.getByRole('button', { name: 'Cambiar' }));
  await user.clear(screen.getByLabelText('Metros por cuadrado'));
  await user.type(screen.getByLabelText('Metros por cuadrado'), '2');
  await user.click(screen.getByLabelText('Lugar (opcional)'));
  expect(last()).toEqual([{ cols: 4.5, rows: 3, edge: 0.5 }]);
  expect(screen.getByText('1 cuadrado = 2 m')).toBeInTheDocument();
});

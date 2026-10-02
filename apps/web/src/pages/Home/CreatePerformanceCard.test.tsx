import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { CreatePerformanceCard } from './CreatePerformanceCard';

test('previews the stage and settles the centre cross when leaving its fields', async () => {
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

  // A new performance starts with a 10 × 8 m stage.
  expect(last()).toEqual([{ cols: 10, rows: 8 }, true]);

  await user.clear(screen.getByLabelText('Ancho (m)'));
  await user.type(screen.getByLabelText('Ancho (m)'), '9');
  await user.clear(screen.getByLabelText('Fondo (m)'));
  await user.type(screen.getByLabelText('Fondo (m)'), '6');
  // Still editing: the previous cross is hidden.
  expect(last()).toEqual([{ cols: 9, rows: 6 }, false]);

  await user.click(screen.getByLabelText('Lugar'));
  expect(last()).toEqual([{ cols: 9, rows: 6 }, true]);

  // With 2 m per square the same stage covers half the squares.
  await user.click(screen.getByRole('button', { name: 'Cambiar' }));
  await user.clear(screen.getByLabelText('Metros por cuadrado'));
  await user.type(screen.getByLabelText('Metros por cuadrado'), '2');
  await user.click(screen.getByLabelText('Lugar'));
  expect(last()).toEqual([{ cols: 4.5, rows: 3 }, true]);
  expect(screen.getByText('1 cuadrado = 2 m')).toBeInTheDocument();
});

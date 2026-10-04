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

  await user.clear(screen.getByLabelText(/^Ancho/));
  // Only whole metres can be typed.
  await user.type(screen.getByLabelText(/^Ancho/), '9,5e');
  await user.clear(screen.getByLabelText(/^Fondo/));
  await user.type(screen.getByLabelText(/^Fondo/), '6');
  // Leaving the width applies it, capped at 32 m.
  expect(screen.getByLabelText(/^Ancho/)).toHaveValue('32');
  await user.clear(screen.getByLabelText(/^Ancho/));
  await user.type(screen.getByLabelText(/^Ancho/), '9');
  // Still typing the new width: the grid keeps the sizes applied on leaving each field (32 × 6 m).
  expect(last()).toEqual([{ cols: 64, rows: 12, edge: 0.5 }]);

  await user.click(screen.getByLabelText('Lugar (opcional)'));
  expect(last()).toEqual([{ cols: 18, rows: 12, edge: 0.5 }]);

  // Below the minimum sizes, the width goes to 4 m and the depth to 2 m.
  await user.clear(screen.getByLabelText(/^Ancho/));
  await user.type(screen.getByLabelText(/^Ancho/), '2');
  await user.clear(screen.getByLabelText(/^Fondo/));
  await user.type(screen.getByLabelText(/^Fondo/), '1');
  await user.click(screen.getByLabelText('Lugar (opcional)'));
  expect(last()).toEqual([{ cols: 8, rows: 4, edge: 0.5 }]);
  await user.clear(screen.getByLabelText(/^Ancho/));
  await user.type(screen.getByLabelText(/^Ancho/), '9');
  await user.clear(screen.getByLabelText(/^Fondo/));
  await user.type(screen.getByLabelText(/^Fondo/), '6');
  await user.click(screen.getByLabelText('Lugar (opcional)'));

  // The edge distance cannot go below 0,25 m.
  await user.clear(screen.getByLabelText('Borde (m)'));
  await user.type(screen.getByLabelText('Borde (m)'), '0,1');
  await user.click(screen.getByLabelText('Lugar (opcional)'));
  expect(screen.getByLabelText('Borde (m)')).toHaveValue('0,25');
  await user.clear(screen.getByLabelText('Borde (m)'));
  await user.type(screen.getByLabelText('Borde (m)'), '1');
  await user.click(screen.getByLabelText('Lugar (opcional)'));

  // Nor can the depth go above 20 m or the edge above 2 m.
  await user.clear(screen.getByLabelText(/^Fondo/));
  await user.type(screen.getByLabelText(/^Fondo/), '25');
  await user.clear(screen.getByLabelText('Borde (m)'));
  await user.type(screen.getByLabelText('Borde (m)'), '3');
  await user.click(screen.getByLabelText('Lugar (opcional)'));
  expect(screen.getByLabelText(/^Fondo/)).toHaveValue('20');
  expect(screen.getByLabelText('Borde (m)')).toHaveValue('2');
  await user.clear(screen.getByLabelText(/^Fondo/));
  await user.type(screen.getByLabelText(/^Fondo/), '6');
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

test('asks before leaving without creating, and Enter does not create', async () => {
  const user = userEvent.setup();
  const onCancel = vi.fn();
  const onCreated = vi.fn();

  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreatePerformanceCard
        groupId="group-1"
        onCancel={onCancel}
        onCreated={onCreated}
        onStageChange={() => {}}
      />
    </QueryClientProvider>,
  );

  // Enter applies the field and moves on to the next one.
  await user.type(screen.getByLabelText('Lugar (opcional)'), 'Plaza Mayor{Enter}');
  expect(screen.getByLabelText('Fecha')).toHaveFocus();
  expect(onCreated).not.toHaveBeenCalled();

  // The default title and a required field left blank block "Crear actuación" and say what is missing.
  const create = screen.getByRole('button', { name: 'Crear actuación' });
  expect(create).toBeDisabled();
  expect(screen.getByText(/Falta ponerle título/)).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Título de la actuación'));
  await user.type(screen.getByLabelText('Título de la actuación'), 'Pasarón de la Vera');
  expect(create).toBeEnabled();
  await user.clear(screen.getByLabelText(/^Ancho/));
  expect(create).toBeDisabled();
  expect(screen.getByText(/Falta el ancho del escenario/)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByText('Los cambios no se guardarán. ¿Quieres continuar?')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(onCancel).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  await user.click(screen.getByRole('button', { name: 'Salir sin guardar' }));
  expect(onCancel).toHaveBeenCalledOnce();
});

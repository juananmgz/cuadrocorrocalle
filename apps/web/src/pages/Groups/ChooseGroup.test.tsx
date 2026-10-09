import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, test, vi } from 'vitest';

import { readActiveGroupId } from '../../groups/activeGroup';

const group = (id: string, name: string, isTrial = false) => ({
  id,
  name,
  gridColor: 'azul',
  isTrial,
  figureDefaults: {},
  instruments: [],
  createdAt: '2026-10-01T00:00:00.000Z',
});

vi.mock('../../groups/groupsApi', () => ({
  useGroups: () => ({
    data: {
      groups: [group('g1', 'Grupo de Prueba', true), group('g2', 'Coros y Danzas')],
      licenses: { groupsAvailable: 0 },
    },
  }),
}));

const { ChooseGroup } = await import('./ChooseGroup');

test('picks a group from its square, with "Prueba" over the trial one and "Modificar" last', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/grupos']}>
      <Routes>
        <Route path="/grupos" element={<ChooseGroup />} />
        <Route path="/inicio" element={<p>Inicio</p>} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByRole('button', { name: /Grupo de Prueba/ })).toHaveTextContent(
    /^Prueba.*Grupo de Prueba$/,
  );
  expect(screen.getByRole('link', { name: 'Modificar' })).toHaveAttribute('href', '/grupos/editar');

  await user.click(screen.getByRole('button', { name: /Coros y Danzas/ }));

  expect(readActiveGroupId()).toBe('g2');
  expect(screen.getByText('Inicio')).toBeInTheDocument();
});

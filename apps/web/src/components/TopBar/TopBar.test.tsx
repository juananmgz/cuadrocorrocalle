import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';

import { TopBar } from './TopBar';

test('the mobile menu shows the user, the group and the sections', async () => {
  const user = userEvent.setup();
  const onGroupClick = vi.fn();
  const signOut = vi.fn();

  render(
    <MemoryRouter>
      <TopBar
        groupName="Coros de Pasarón"
        onGroupClick={onGroupClick}
        userName="Juanan"
        userEmail="juanan@example.com"
        userMenuItems={[{ label: 'Cerrar sesión', onSelect: signOut, danger: true }]}
      />
    </MemoryRouter>,
  );

  expect(screen.getByRole('link', { name: 'CuadroCorroCalle' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

  const menu = screen.getByRole('dialog', { name: 'Menú' });
  expect(menu).toHaveTextContent('Juanan');
  expect(menu).toHaveTextContent('juanan@example.com');
  expect(menu).not.toHaveTextContent('Usuario');
  // The open panel hides the rest of the page, so only its links remain.
  expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
    'Actuaciones',
    'Ajustes',
    'Mi cuenta',
  ]);

  await user.click(screen.getAllByRole('button', { name: /Coros de Pasarón/ }).at(-1)!);
  expect(onGroupClick).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog', { name: 'Menú' })).not.toBeInTheDocument();
});

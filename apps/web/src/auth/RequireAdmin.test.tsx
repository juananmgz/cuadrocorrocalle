import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, test, vi } from 'vitest';

import { RequireAdmin } from './RequireAdmin';

const useSession = vi.fn();
vi.mock('./authClient', () => ({ authClient: { useSession: () => useSession() } }));

function renderStatus() {
  render(
    <MemoryRouter initialEntries={['/status']}>
      <Routes>
        <Route path="/inicio" element={<p>Inicio</p>} />
        <Route
          path="/status"
          element={
            <RequireAdmin>
              <p>Estado</p>
            </RequireAdmin>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

test('shows the page to administrators', () => {
  useSession.mockReturnValue({ data: { user: { isAdmin: true } }, isPending: false });
  renderStatus();
  expect(screen.getByText('Estado')).toBeInTheDocument();
});

test('sends everyone else to /inicio', () => {
  useSession.mockReturnValue({ data: { user: { isAdmin: false } }, isPending: false });
  renderStatus();
  expect(screen.getByText('Inicio')).toBeInTheDocument();
});

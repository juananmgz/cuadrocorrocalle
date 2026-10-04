import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, test, vi } from 'vitest';

import { RequireAuth } from './RequireAuth';

const useSession = vi.fn();
vi.mock('./authClient', () => ({ authClient: { useSession: () => useSession() } }));

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/entrar" element={<p>Entrar</p>} />
        <Route
          path="/cuenta"
          element={
            <RequireAuth>
              <p>Mi cuenta</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

test('sends to /entrar without a session', () => {
  useSession.mockReturnValue({ data: null, isPending: false, error: null });
  renderAt('/cuenta');
  expect(screen.getByText('Entrar')).toBeInTheDocument();
});

test('offers to retry when the API cannot be reached, instead of signing out', () => {
  useSession.mockReturnValue({
    data: null,
    isPending: false,
    error: { status: 502 },
  });
  renderAt('/cuenta');
  expect(screen.getByRole('alert')).toHaveTextContent('No hay conexión con el servidor');
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  expect(screen.queryByText('Entrar')).not.toBeInTheDocument();
});

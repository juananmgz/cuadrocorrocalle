import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';

import { Welcome } from './Welcome';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('shows the app name as the main heading', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok', database: 'connected' })),
  );

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Welcome />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(screen.getByRole('heading', { level: 1, name: 'CuadroCorroCalle' })).toBeInTheDocument();
  expect(await screen.findByText('API conectada')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ver componentes' })).toHaveAttribute(
    'href',
    '/componentes',
  );
});

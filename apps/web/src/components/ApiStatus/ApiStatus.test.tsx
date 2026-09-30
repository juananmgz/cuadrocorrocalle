import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { ApiStatus } from './ApiStatus';

function renderApiStatus() {
  const client = new QueryClient();

  render(
    <QueryClientProvider client={client}>
      <ApiStatus />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('shows API and database connected when both answer', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok', database: 'connected' })),
  );

  renderApiStatus();

  expect(await screen.findByText('API conectada')).toBeInTheDocument();
  expect(screen.getByText('Base de datos conectada')).toBeInTheDocument();
});

test('shows the database disconnected when only the API answers', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok', database: 'disconnected' })),
  );

  renderApiStatus();

  expect(await screen.findByText('API conectada')).toBeInTheDocument();
  expect(screen.getByText('Sin conexión con la base de datos')).toBeInTheDocument();
});

test('shows everything disconnected when the API cannot be reached', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }),
  );

  renderApiStatus();

  expect(await screen.findByText('Sin conexión con la API')).toBeInTheDocument();
  expect(screen.getByText('Sin conexión con la base de datos')).toBeInTheDocument();
});

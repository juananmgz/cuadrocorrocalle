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

test('shows connected when the API answers ok', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok' })),
  );

  renderApiStatus();

  expect(await screen.findByText('API conectada')).toBeInTheDocument();
});

test('shows disconnected when the API cannot be reached', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }),
  );

  renderApiStatus();

  expect(await screen.findByText('Sin conexión con la API')).toBeInTheDocument();
});

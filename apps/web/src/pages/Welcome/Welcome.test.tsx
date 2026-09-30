import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { Welcome } from './Welcome';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('shows the app name as the main heading', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok' })),
  );

  render(
    <QueryClientProvider client={new QueryClient()}>
      <Welcome />
    </QueryClientProvider>,
  );

  expect(screen.getByRole('heading', { level: 1, name: 'CuadroCorroCalle' })).toBeInTheDocument();
  expect(await screen.findByText('API conectada')).toBeInTheDocument();
});

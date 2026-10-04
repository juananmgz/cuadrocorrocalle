import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';

import { Status } from './Status';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('shows whether the API answers and links to the components', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ status: 'ok', database: 'connected' })),
  );

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Status />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(screen.getByRole('heading', { level: 1, name: 'Estado' })).toBeInTheDocument();
  expect(await screen.findByText('API conectada')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ver componentes' })).toHaveAttribute(
    'href',
    '/componentes',
  );
});

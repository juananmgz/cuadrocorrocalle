import type { Person } from '@cuadrocorrocalle/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { CallUpSection } from './CallUpSection';

const person = (id: string, name: string, figure: Person['figure']): Person => ({
  id,
  name,
  figure,
  mainColor: 'blue',
  membership: 'member',
  roles: ['dance'],
  instruments: [],
  notes: null,
});

function renderSection() {
  const onChange = vi.fn();
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    ['people', 'group-1'],
    [person('ml', 'María Luisa Sánchez', 'girl'), person('mario', 'Mario Gil', 'boy')],
  );
  render(
    <QueryClientProvider client={queryClient}>
      <CallUpSection groupId="group-1" onChange={onChange} />
    </QueryClientProvider>,
  );
  return () => onChange.mock.lastCall;
}

// Many clicks: a longer timeout keeps it stable on a busy machine.
test('cycles each person through comes, pending and out', { timeout: 20_000 }, async () => {
  const user = userEvent.setup();
  const last = renderSection();

  await user.click(screen.getByRole('button', { name: 'Mario Gil: no convocado' }));
  expect(last()).toEqual([[{ personId: 'mario', status: 'yes' }], false]);
  await user.click(screen.getByRole('button', { name: 'Mario Gil: viene' }));
  expect(last()).toEqual([[{ personId: 'mario', status: 'maybe' }], false]);
  await user.click(screen.getByRole('button', { name: 'Mario Gil: por confirmar' }));
  expect(last()).toEqual([[], false]);
});

test(
  'imports a list, blocks while a name is missing and filters by gender',
  { timeout: 20_000 },
  async () => {
    const user = userEvent.setup();
    const last = renderSection();

    await user.click(screen.getByRole('button', { name: 'Importar' }));
    await user.click(screen.getByRole('tab', { name: 'Pegar texto' }));
    await user.type(screen.getByLabelText('Lista de nombres'), 'Malú, Rodrigo');
    await user.click(screen.getByRole('button', { name: 'Marcar en la convocatoria' }));

    // Malú is María Luisa and comes; Rodrigo is not in the group and blocks the step.
    expect(screen.getByRole('button', { name: 'María Luisa Sánchez: viene' })).toBeInTheDocument();
    expect(last()).toEqual([[{ personId: 'ml', status: 'yes' }], true]);
    await user.click(screen.getByRole('button', { name: 'No incluir' }));
    expect(last()).toEqual([[{ personId: 'ml', status: 'yes' }], false]);

    // Leaving only "Chico" hides María Luisa.
    await user.click(screen.getByRole('button', { name: 'Género' }));
    await user.click(
      within(screen.getByRole('menu')).getByRole('menuitemcheckbox', { name: 'Chica' }),
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: /María Luisa/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mario Gil: no convocado' })).toBeInTheDocument();
  },
);

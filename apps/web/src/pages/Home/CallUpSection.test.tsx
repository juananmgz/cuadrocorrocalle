import type { Person } from '@cuadrocorrocalle/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { CallUpSection } from './CallUpSection';

const person = (id: string, name: string): Person => ({
  id,
  name,
  figure: null,
  mainColor: 'blue',
  membership: 'member',
  roles: [],
  notes: null,
});

// Many clicks: a longer timeout keeps it stable on a busy machine.
test(
  'marks a pasted list by hand, blocks while a name is missing and lets you change it',
  { timeout: 20_000 },
  async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ['people', 'group-1'],
      [person('ml', 'María Luisa Sánchez'), person('julia', 'Julia Moreno')],
    );

    render(
      <QueryClientProvider client={queryClient}>
        <CallUpSection groupId="group-1" onChange={onChange} />
      </QueryClientProvider>,
    );
    const last = () => onChange.mock.lastCall;

    await user.type(screen.getByLabelText('Lista de nombres'), 'Malú, Rodrigo');
    await user.click(screen.getByRole('button', { name: 'Marcar en la convocatoria' }));

    // Malú is María Luisa and is marked as coming; Rodrigo is not in the group and blocks the step.
    expect(screen.getByRole('tab', { name: 'A mano' })).toHaveAttribute('aria-selected', 'true');
    const maria = screen.getByRole('group', { name: 'María Luisa Sánchez' });
    expect(within(maria).getByRole('button', { name: 'Viene' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Crear 1 miembro nuevo' })).toBeInTheDocument();
    expect(last()).toEqual([[{ personId: 'ml', status: 'yes' }], true]);

    await user.click(screen.getByRole('button', { name: 'No incluir' }));
    expect(last()).toEqual([[{ personId: 'ml', status: 'yes' }], false]);

    // By hand, Julia is marked as pending confirmation.
    const julia = screen.getByRole('group', { name: 'Julia Moreno' });
    await user.click(within(julia).getByRole('button', { name: 'Por confirmar' }));
    expect(last()?.[0]).toEqual([
      { personId: 'ml', status: 'yes' },
      { personId: 'julia', status: 'maybe' },
    ]);
  },
);

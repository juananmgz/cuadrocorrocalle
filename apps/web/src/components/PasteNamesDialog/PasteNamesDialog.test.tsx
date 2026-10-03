import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import type { PeopleMutations } from '../../people/peopleApi';
import { PasteNamesDialog } from './PasteNamesDialog';

test('asks for the gender and roles of everyone before adding a joint list', async () => {
  const user = userEvent.setup();
  const mutate = vi.fn();
  const mutations = {
    paste: { mutate, reset: vi.fn(), isPending: false, error: null },
  } as unknown as PeopleMutations;

  render(
    <PasteNamesDialog
      open
      onOpenChange={() => {}}
      mutations={mutations}
      groupName="Coros"
      currentCount={0}
    />,
  );

  await user.type(screen.getByLabelText('Nombres'), 'Julia, Mario');
  await user.click(screen.getByRole('button', { name: 'Siguiente' }));

  const add = screen.getByRole('button', { name: 'Añadir 2 personas' });
  expect(add).toBeDisabled();

  // Everyone dances; then each gets a gender.
  await user.click(
    within(screen.getByRole('group', { name: 'Todos' })).getByRole('button', { name: 'Baile' }),
  );
  await user.click(
    within(screen.getByRole('radiogroup', { name: 'Género de Julia' })).getByRole('radio', {
      name: 'Chica',
    }),
  );
  expect(add).toBeDisabled();
  await user.click(
    within(screen.getByRole('radiogroup', { name: 'Género de Mario' })).getByRole('radio', {
      name: 'Chico',
    }),
  );
  await user.click(
    within(screen.getByRole('group', { name: 'Roles de Mario' })).getByRole('button', {
      name: 'Música',
    }),
  );

  expect(add).toBeEnabled();
  await user.click(add);
  expect(mutate.mock.lastCall?.[0]).toEqual({
    names: [
      { name: 'Julia', figure: 'girl', roles: ['dance'] },
      { name: 'Mario', figure: 'boy', roles: ['dance', 'music'] },
    ],
  });
});

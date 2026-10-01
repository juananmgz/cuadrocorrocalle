import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { Button } from '../Button/Button';
import { Dialog } from './Dialog';

test('opens with the trigger and closes with Escape', async () => {
  const user = userEvent.setup();

  render(<Dialog trigger={<Button>Abrir</Button>} title="Borrar actuación" description="Aviso" />);

  await user.click(screen.getByRole('button', { name: 'Abrir' }));
  expect(screen.getByRole('dialog', { name: 'Borrar actuación' })).toBeInTheDocument();

  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

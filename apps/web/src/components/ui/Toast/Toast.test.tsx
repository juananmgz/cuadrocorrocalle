import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { Button } from '../Button/Button';
import { ToastProvider } from './Toast';
import { useToast } from './toastContext';

function Trigger() {
  const toast = useToast();

  return <Button onClick={() => toast.show({ title: 'Cambios guardados' })}>Guardar</Button>;
}

test('shows a toast when requested', async () => {
  const user = userEvent.setup();

  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );

  await user.click(screen.getByRole('button', { name: 'Guardar' }));

  expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
});

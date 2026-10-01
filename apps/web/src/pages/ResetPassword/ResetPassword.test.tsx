import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';

const resetPassword = vi.fn();

vi.mock('../../auth/authClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../auth/authClient')>()),
  authClient: { resetPassword: (...args: unknown[]) => resetPassword(...args) },
}));

const { ResetPassword } = await import('./ResetPassword');

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ResetPassword />
    </MemoryRouter>,
  );

test('explains an expired link and offers a new one', () => {
  renderAt('/restablecer?error=INVALID_TOKEN');

  expect(screen.getByRole('alert')).toHaveTextContent('El enlace ha caducado o ya se ha usado.');
  expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute(
    'href',
    '/recuperar',
  );
});

test('checks that both passwords match before saving', async () => {
  const user = userEvent.setup();
  renderAt('/restablecer?token=abc');

  await user.type(screen.getByLabelText('Contraseña nueva'), 'jota-de-la-vera');
  await user.type(screen.getByLabelText('Repite la contraseña'), 'jota-de-otra');
  await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Las dos contraseñas no coinciden.');
  expect(resetPassword).not.toHaveBeenCalled();
});

test('saves the new password with the token from the link', async () => {
  const user = userEvent.setup();
  resetPassword.mockResolvedValueOnce({ data: { status: true }, error: null });
  renderAt('/restablecer?token=abc');

  await user.type(screen.getByLabelText('Contraseña nueva'), 'jota-de-la-vera');
  await user.type(screen.getByLabelText('Repite la contraseña'), 'jota-de-la-vera');
  await user.click(screen.getByRole('button', { name: 'Guardar contraseña' }));

  expect(resetPassword).toHaveBeenCalledWith({ newPassword: 'jota-de-la-vera', token: 'abc' });
  expect(await screen.findByRole('status')).toHaveTextContent('Contraseña cambiada.');
});

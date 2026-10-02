import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { expect, test, vi } from 'vitest';

const signInEmail = vi.fn();
const signInSocial = vi.fn();

vi.mock('../../auth/authClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../auth/authClient')>()),
  authClient: {
    useSession: () => ({ data: null, isPending: false }),
    signIn: {
      email: (...args: unknown[]) => signInEmail(...args),
      social: (...args: unknown[]) => signInSocial(...args),
    },
  },
}));

const { SignIn } = await import('./SignIn');

function renderSignIn(url = '/entrar?volver=/inicio') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/entrar" element={<SignIn />} />
        <Route path="/inicio" element={<p>Inicio</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo electrónico'), 'julia@example.com');
  await user.type(screen.getByLabelText('Contraseña'), 'jota-de-la-vera');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

test('shows a message in Spanish for a wrong password', async () => {
  signInEmail.mockResolvedValueOnce({ error: { code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 } });
  renderSignIn();

  await fillAndSubmit();

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'El correo o la contraseña no son correctos.',
  );
});

test('goes back to the requested page after signing in', async () => {
  signInEmail.mockResolvedValueOnce({ data: {}, error: null });
  renderSignIn();

  await fillAndSubmit();

  expect(await screen.findByText('Inicio')).toBeInTheDocument();
  expect(signInEmail).toHaveBeenLastCalledWith(
    expect.objectContaining({ email: 'julia@example.com', rememberMe: true }),
  );
});

test('starts Google sign-in and returns to the requested page', async () => {
  const user = userEvent.setup();
  signInSocial.mockResolvedValueOnce({ data: { url: 'https://accounts.google.com' }, error: null });
  renderSignIn();

  await user.click(screen.getByRole('button', { name: 'Continuar con Google' }));

  expect(signInSocial).toHaveBeenCalledWith({
    provider: 'google',
    callbackURL: '/inicio',
    errorCallbackURL: '/entrar',
  });
});

test('explains why Google could not link to an unconfirmed account', () => {
  renderSignIn('/entrar?error=account_not_linked');

  expect(screen.getByRole('alert')).toHaveTextContent(
    'Ya hay una cuenta con ese correo sin confirmar.',
  );
});

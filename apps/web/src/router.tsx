import { createBrowserRouter } from 'react-router';

import { RequireAuth } from './auth/RequireAuth';
import { Welcome } from './pages/Welcome/Welcome';

export const router = createBrowserRouter([
  { path: '/', element: <Welcome /> },
  {
    path: '/componentes',
    lazy: async () => ({
      Component: (await import('./pages/Components/Components')).Components,
    }),
  },
  {
    path: '/entrar',
    lazy: async () => ({ Component: (await import('./pages/SignIn/SignIn')).SignIn }),
  },
  {
    path: '/registro',
    lazy: async () => ({ Component: (await import('./pages/SignUp/SignUp')).SignUp }),
  },
  {
    path: '/recuperar',
    lazy: async () => ({
      Component: (await import('./pages/ForgotPassword/ForgotPassword')).ForgotPassword,
    }),
  },
  {
    path: '/restablecer',
    lazy: async () => ({
      Component: (await import('./pages/ResetPassword/ResetPassword')).ResetPassword,
    }),
  },
  {
    path: '/inicio',
    lazy: async () => {
      const { Home } = await import('./pages/Home/Home');
      return {
        Component: () => (
          <RequireAuth>
            <Home />
          </RequireAuth>
        ),
      };
    },
  },
]);

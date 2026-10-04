import { createBrowserRouter, Navigate } from 'react-router';

import { RequireAdmin } from './auth/RequireAdmin';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './components/AppLayout/AppLayout';

export const router = createBrowserRouter([
  // No landing page: straight to the home page, or to sign in first.
  {
    path: '/',
    element: (
      <RequireAuth>
        <Navigate to="/inicio" replace />
      </RequireAuth>
    ),
  },
  // Component showcase, for administrators only.
  {
    path: '/componentes',
    lazy: async () => {
      const { Components } = await import('./pages/Components/Components');
      return {
        Component: () => (
          <RequireAuth>
            <RequireAdmin>
              <Components />
            </RequireAdmin>
          </RequireAuth>
        ),
      };
    },
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
  // Signed-in pages share the top bar and the active group.
  {
    element: <AppLayout />,
    children: [
      {
        path: '/status',
        lazy: async () => {
          const { Status } = await import('./pages/Status/Status');
          return {
            Component: () => (
              <RequireAdmin>
                <Status />
              </RequireAdmin>
            ),
          };
        },
      },
      {
        path: '/empezar',
        lazy: async () => ({
          Component: (await import('./pages/Onboarding/Onboarding')).Onboarding,
        }),
      },
      {
        path: '/inicio',
        lazy: async () => ({ Component: (await import('./pages/Home/Home')).Home }),
      },
      // Performances are listed and created from the home page.
      { path: '/actuaciones', element: <Navigate to="/inicio" replace /> },
      {
        path: '/actuaciones/:id',
        lazy: async () => ({
          Component: (await import('./pages/PerformanceDetail/PerformanceDetail'))
            .PerformanceDetail,
        }),
      },
      {
        path: '/grupo',
        lazy: async () => ({ Component: (await import('./pages/MyGroup/MyGroup')).MyGroup }),
      },
      {
        path: '/ajustes',
        lazy: async () => ({ Component: (await import('./pages/Settings/Settings')).Settings }),
      },
      {
        path: '/cuenta',
        lazy: async () => ({ Component: (await import('./pages/Account/Account')).Account }),
      },
    ],
  },
]);

import { createBrowserRouter } from 'react-router';

import { AppLayout } from './components/AppLayout/AppLayout';
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
  // Signed-in pages share the top bar and the active group.
  {
    element: <AppLayout />,
    children: [
      {
        path: '/inicio',
        lazy: async () => ({ Component: (await import('./pages/Home/Home')).Home }),
      },
      {
        path: '/actuaciones',
        lazy: async () => ({
          Component: (await import('./pages/Performances/Performances')).Performances,
        }),
      },
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

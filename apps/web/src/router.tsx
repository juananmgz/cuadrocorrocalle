import { createBrowserRouter } from 'react-router';

import { Welcome } from './pages/Welcome/Welcome';

export const router = createBrowserRouter([
  { path: '/', element: <Welcome /> },
  {
    path: '/componentes',
    lazy: async () => ({
      Component: (await import('./pages/Components/Components')).Components,
    }),
  },
]);

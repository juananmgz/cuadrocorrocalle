import { createBrowserRouter } from 'react-router';

import { Welcome } from './pages/Welcome/Welcome';

export const router = createBrowserRouter([{ path: '/', element: <Welcome /> }]);

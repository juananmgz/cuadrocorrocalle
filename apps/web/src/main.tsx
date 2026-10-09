import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource-variable/atkinson-hyperlegible-next';
import '@fontsource-variable/atkinson-hyperlegible-mono';
import './styles/global.scss';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { CookieBanner } from './components/CookieBanner/CookieBanner';
import { ToastProvider } from './components/ui/Toast/Toast';
import { router } from './router';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

// How wide this browser draws a scrollbar, so boxes that scroll take its room from their margin.
const probe = document.createElement('div');
probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
document.body.append(probe);
document.documentElement.style.setProperty(
  '--scrollbar-size',
  `${probe.offsetWidth - probe.clientWidth}px`,
);
probe.remove();

const queryClient = new QueryClient();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
        <CookieBanner />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);

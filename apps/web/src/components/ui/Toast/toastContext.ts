import { createContext, use } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  title: string;
  description?: string;
  tone?: ToastTone;
}

interface ToastApi {
  show: (message: ToastMessage) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast() {
  const context = use(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }

  return context;
}

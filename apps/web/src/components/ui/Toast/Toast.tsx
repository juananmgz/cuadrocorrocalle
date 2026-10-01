import { Toast as RadixToast } from 'radix-ui';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

import styles from './Toast.module.scss';
import { type ToastMessage, ToastContext } from './toastContext';

interface ToastEntry extends ToastMessage {
  id: number;
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const show = useCallback((message: ToastMessage) => {
    nextId += 1;
    setToasts((current) => [...current, { ...message, id: nextId }]);
  }, []);

  const remove = (id: number) => setToasts((current) => current.filter((t) => t.id !== id));
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext value={value}>
      <RadixToast.Provider swipeDirection="right" label="Notificación">
        {children}
        {toasts.map((toast) => (
          <RadixToast.Root
            key={toast.id}
            className={styles.root}
            data-tone={toast.tone ?? 'info'}
            onOpenChange={(open) => !open && remove(toast.id)}
          >
            <RadixToast.Title className={styles.title}>{toast.title}</RadixToast.Title>
            {toast.description && (
              <RadixToast.Description className={styles.description}>
                {toast.description}
              </RadixToast.Description>
            )}
            <RadixToast.Close className={styles.close} aria-label="Cerrar aviso">
              ✕
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className={styles.viewport} />
      </RadixToast.Provider>
    </ToastContext>
  );
}

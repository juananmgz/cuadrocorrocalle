import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactNode } from 'react';

import styles from './Dialog.module.scss';

interface DialogProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dialog({ trigger, title, description, children, footer, ...props }: DialogProps) {
  return (
    <RadixDialog.Root {...props}>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={styles.overlay} />
        <RadixDialog.Content
          className={styles.content}
          // Radix expects an explicit undefined when there is no description.
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <RadixDialog.Title className={styles.title}>{title}</RadixDialog.Title>
          {description && (
            <RadixDialog.Description className={styles.description}>
              {description}
            </RadixDialog.Description>
          )}
          {children}
          {footer && <div className={styles.footer}>{footer}</div>}
          <RadixDialog.Close className={styles.close} aria-label="Cerrar">
            ✕
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export const DialogClose = RadixDialog.Close;

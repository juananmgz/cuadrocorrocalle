import { Label } from 'radix-ui';
import { type ComponentProps, useId } from 'react';

import styles from './TextField.module.scss';

interface TextFieldProps extends ComponentProps<'input'> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, id, ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className={styles.root}>
      <Label.Root className={styles.label} htmlFor={inputId}>
        {label}
      </Label.Root>
      <input
        id={inputId}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...props}
      />
      {message && (
        <p id={messageId} className={styles.message} data-error={error ? '' : undefined}>
          {message}
        </p>
      )}
    </div>
  );
}

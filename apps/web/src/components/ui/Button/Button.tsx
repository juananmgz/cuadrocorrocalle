import type { ComponentProps } from 'react';

import styles from './Button.module.scss';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
}

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[styles.root, className].filter(Boolean).join(' ')}
      data-variant={variant}
      {...props}
    />
  );
}

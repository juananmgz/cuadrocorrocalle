import { Pencil } from 'lucide-react';
import type { ComponentProps } from 'react';

import styles from './EditButton.module.scss';

interface EditButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** What it edits, said to screen readers and on hover, e.g. "Editar la convocatoria". */
  label: string;
  /** Smaller, for rows such as the pieces of a list. */
  small?: boolean;
}

/** A pencil, like the one beside the performance's title, that opens something to edit. */
export function EditButton({ label, small = false, className, ...props }: EditButtonProps) {
  return (
    <button
      type="button"
      className={[styles.root, className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      data-small={small ? '' : undefined}
      {...props}
    >
      <Pencil size={small ? 16 : 20} aria-hidden="true" />
    </button>
  );
}

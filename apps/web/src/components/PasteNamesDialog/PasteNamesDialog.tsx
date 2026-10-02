import { MAX_PASTED_NAMES, parseNameList } from '@cuadrocorrocalle/shared';
import { type FormEvent, useState } from 'react';

import type { PeopleMutations } from '../../people/peopleApi';
import { Button } from '../ui/Button/Button';
import { Dialog } from '../ui/Dialog/Dialog';
import { TextArea } from '../ui/TextArea/TextArea';
import styles from './PasteNamesDialog.module.scss';

interface PasteNamesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: PeopleMutations;
}

/** Adds many people at once from a pasted list of names. */
export function PasteNamesDialog({ open, onOpenChange, mutations }: PasteNamesDialogProps) {
  const [text, setText] = useState('');
  const names = parseNameList(text);
  const tooMany = names.length > MAX_PASTED_NAMES;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutations.paste.mutate(names, {
      onSuccess: () => {
        setText('');
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pegar lista"
      description="Pega los nombres del grupo, uno por línea o separados por comas. Cada persona recibe un color; el muñeco lo eliges después."
    >
      <form className={styles.form} onSubmit={submit}>
        <TextArea
          label="Nombres"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'Julia Sánchez\nMario López\nAna Martín'}
          autoFocus
          error={
            tooMany
              ? `Máximo ${MAX_PASTED_NAMES} nombres de una vez.`
              : mutations.paste.error?.message
          }
        />
        <p className={styles.count} role="status">
          {names.length === 0
            ? 'Aún no hay nombres.'
            : `Se ${names.length === 1 ? 'añadirá 1 persona' : `añadirán ${names.length} personas`}.`}
        </p>
        <div className={styles.actions}>
          <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={names.length === 0 || tooMany || mutations.paste.isPending}
          >
            {mutations.paste.isPending ? 'Añadiendo…' : 'Añadir'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

import type { Performance } from '@cuadrocorrocalle/shared';
import type { FormEvent } from 'react';

import type { PerformanceMutations } from '../../performances/performancesApi';
import { Button } from '../ui/Button/Button';
import { Dialog } from '../ui/Dialog/Dialog';
import { TextArea } from '../ui/TextArea/TextArea';
import { TextField } from '../ui/TextField/TextField';
import styles from './PerformanceDialog.module.scss';

interface PerformanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Performance to edit; a new one is created in groupId without it. */
  performance?: Performance;
  groupId: string;
  mutations: PerformanceMutations;
  onSaved?: (performance: Performance) => void;
}

const toMinutes = (value: FormDataEntryValue | null) => {
  const text = String(value ?? '').trim();
  return text ? Number(text) : null;
};

/** Performance data: title, place, date, minimum and maximum duration and notes. */
export function PerformanceDialog({
  open,
  onOpenChange,
  performance,
  groupId,
  mutations,
  onSaved,
}: PerformanceDialogProps) {
  const saving = performance ? mutations.update : mutations.create;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      title: String(form.get('title')),
      place: String(form.get('place')),
      date: String(form.get('date')) || null,
      minMinutes: toMinutes(form.get('minMinutes')),
      maxMinutes: toMinutes(form.get('maxMinutes')),
      notes: String(form.get('notes')),
    };
    const done = (saved: Performance) => {
      onOpenChange(false);
      onSaved?.(saved);
    };

    if (performance) mutations.update.mutate({ id: performance.id, ...input }, { onSuccess: done });
    else mutations.create.mutate({ groupId, ...input }, { onSuccess: done });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) saving.reset();
      }}
      title={performance ? 'Editar actuación' : 'Nueva actuación'}
    >
      {open && (
        <form key={performance?.id ?? 'new'} className={styles.form} onSubmit={submit}>
          <TextField
            label="Título"
            name="title"
            defaultValue={performance?.title}
            placeholder="Pasarón de la Vera"
            maxLength={120}
            required
            autoFocus
          />
          <TextField
            label="Lugar"
            name="place"
            defaultValue={performance?.place ?? ''}
            placeholder="Plaza Mayor"
            maxLength={120}
          />
          <TextField label="Fecha" name="date" type="date" defaultValue={performance?.date ?? ''} />
          <div className={styles.durations}>
            <TextField
              label="Duración mínima"
              name="minMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              defaultValue={performance?.minMinutes ?? ''}
              hint="Minutos"
            />
            <TextField
              label="Duración máxima"
              name="maxMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              defaultValue={performance?.maxMinutes ?? ''}
              hint="Minutos"
            />
          </div>
          <TextArea
            label="Notas"
            name="notes"
            defaultValue={performance?.notes ?? ''}
            maxLength={2000}
            rows={3}
          />
          {saving.error && (
            <p className={styles.error} role="alert">
              {saving.error.message}
            </p>
          )}
          <div className={styles.actions}>
            <Button onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={saving.isPending}>
              {saving.isPending ? 'Guardando…' : performance ? 'Guardar' : 'Crear actuación'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

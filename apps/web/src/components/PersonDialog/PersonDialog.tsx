import type { Figure, Person, PersonColorId } from '@cuadrocorrocalle/shared';
import { RadioGroup } from 'radix-ui';
import { type FormEvent, useState } from 'react';

import { FIGURE_LABELS, type PeopleMutations } from '../../people/peopleApi';
import { Button } from '../ui/Button/Button';
import { ColorPicker } from '../ui/ColorPicker/ColorPicker';
import { Dialog } from '../ui/Dialog/Dialog';
import { TextField } from '../ui/TextField/TextField';
import styles from './PersonDialog.module.scss';

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Person to edit; a new one is added without it. */
  person?: Person;
  /** Colour preselected for a new person. */
  defaultColor: PersonColorId;
  mutations: PeopleMutations;
}

/** Adds or edits a person: name, puppet (boy or girl), main colour and notes. */
export function PersonDialog(props: PersonDialogProps) {
  const { open, onOpenChange, person } = props;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={person ? 'Editar persona' : 'Añadir persona'}
    >
      {/* Keyed so the form starts fresh for each person. */}
      {open && <PersonForm key={person?.id ?? 'new'} {...props} />}
    </Dialog>
  );
}

function PersonForm({ onOpenChange, person, defaultColor, mutations }: PersonDialogProps) {
  const [figure, setFigure] = useState<Figure | null>(person?.figure ?? null);
  const [color, setColor] = useState<PersonColorId>(person?.mainColor ?? defaultColor);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const saving = person ? mutations.edit : mutations.create;
  const close = () => onOpenChange(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get('name')),
      notes: String(form.get('notes')),
      figure,
      mainColor: color,
    };

    if (person) mutations.edit.mutate({ id: person.id, ...input }, { onSuccess: close });
    else mutations.create.mutate(input, { onSuccess: close });
  };

  const remove = () => {
    if (!confirmingDelete) return setConfirmingDelete(true);
    mutations.remove.mutate(person!.id, { onSuccess: close });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label="Nombre"
        name="name"
        defaultValue={person?.name}
        maxLength={80}
        autoComplete="off"
        required
        autoFocus
        error={saving.error?.message}
      />
      <div className={styles.field}>
        <span id="person-figure" className={styles.label}>
          Muñeco
        </span>
        <RadioGroup.Root
          className={styles.figures}
          aria-labelledby="person-figure"
          orientation="horizontal"
          value={figure ?? ''}
          onValueChange={(value) => setFigure(value as Figure)}
        >
          {(Object.keys(FIGURE_LABELS) as Figure[]).map((id) => (
            <RadioGroup.Item key={id} value={id} className={styles.figure}>
              {FIGURE_LABELS[id]}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </div>
      <ColorPicker label="Color principal" value={color} onValueChange={setColor} />
      <TextField
        label="Notas"
        name="notes"
        defaultValue={person?.notes ?? ''}
        maxLength={500}
        hint="Opcional: instrumento, voz, talla…"
      />
      {mutations.remove.error && (
        <p className={styles.error} role="alert">
          {mutations.remove.error.message}
        </p>
      )}
      {person && (
        <Button
          variant="danger"
          className={styles.delete}
          onClick={remove}
          disabled={mutations.remove.isPending}
        >
          {confirmingDelete ? '¿Seguro? Borrar' : 'Borrar'}
        </Button>
      )}
      <div className={styles.actions}>
        <Button onClick={close}>Cancelar</Button>
        <Button type="submit" variant="primary" disabled={saving.isPending}>
          {saving.isPending ? 'Guardando…' : person ? 'Guardar' : 'Añadir'}
        </Button>
      </div>
    </form>
  );
}

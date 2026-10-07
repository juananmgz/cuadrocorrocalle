import {
  type Figure,
  type Membership,
  MEMBERSHIP_LABELS,
  type Person,
  PERSON_COLOR_IDS,
  type PersonRole,
  rolesForInstruments,
} from '@cuadrocorrocalle/shared';
import { RadioGroup } from 'radix-ui';
import { type FormEvent, useState } from 'react';

import type { PeopleMutations } from '../../people/peopleApi';
import { GenderToggle, RoleToggles } from '../PersonFields/PersonFields';
import { Button } from '../ui/Button/Button';
import { type ColorChoice, ColorPicker, RANDOM_COLOR } from '../ui/ColorPicker/ColorPicker';
import { Dialog } from '../ui/Dialog/Dialog';
import { TagField } from '../ui/TagField/TagField';
import { TextField } from '../ui/TextField/TextField';
import styles from './PersonDialog.module.scss';

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Person to edit; a new one is added without it. */
  person?: Person;
  mutations: PeopleMutations;
  /** The group's instruments, offered for what the person plays. */
  instruments?: string[];
}

/** Adds or edits a person: name, gender, membership, roles, instruments, colour and notes. */
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

function PersonForm({ onOpenChange, person, mutations, instruments = [] }: PersonDialogProps) {
  const [figure, setFigure] = useState<Figure | null>(person?.figure ?? null);
  const [membership, setMembership] = useState<Membership>(person?.membership ?? 'member');
  const [roles, setRoles] = useState<PersonRole[]>(person?.roles ?? []);
  const [playing, setPlaying] = useState<string[]>(person?.instruments ?? []);
  // Playing something makes them a musician (or a singer) at once.
  const changePlaying = (next: string[]) => {
    setPlaying(next);
    setRoles((current) => rolesForInstruments(current, next));
  };
  // New people start with a random colour.
  const [color, setColor] = useState<ColorChoice>(person?.mainColor ?? RANDOM_COLOR);
  const [checked, setChecked] = useState(false);
  const figureError = checked && !figure ? 'Elige el género' : undefined;
  const rolesError = checked && !roles.length ? 'Elige al menos un rol' : undefined;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const saving = person ? mutations.edit : mutations.create;
  const close = () => onOpenChange(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Gender and at least one role are required.
    setChecked(true);
    if (!figure || !roles.length) return;
    const form = new FormData(event.currentTarget);
    const input = {
      name: String(form.get('name')),
      notes: String(form.get('notes')),
      figure,
      membership,
      roles,
      instruments: playing,
      mainColor:
        color === RANDOM_COLOR
          ? PERSON_COLOR_IDS[Math.floor(Math.random() * PERSON_COLOR_IDS.length)]!
          : color,
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
          Género
        </span>
        <GenderToggle value={figure} onChange={setFigure} labelledBy="person-figure" />
        {figureError && <p className={styles.error}>{figureError}</p>}
      </div>
      <div className={styles.field}>
        <span id="person-membership" className={styles.label}>
          Tipo
        </span>
        <RadioGroup.Root
          className={styles.figures}
          aria-labelledby="person-membership"
          orientation="horizontal"
          value={membership}
          onValueChange={(value) => setMembership(value as Membership)}
        >
          {(Object.keys(MEMBERSHIP_LABELS) as Membership[]).map((id) => (
            <RadioGroup.Item key={id} value={id} className={styles.figure}>
              {MEMBERSHIP_LABELS[id]}
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </div>
      <div className={styles.field}>
        <span id="person-roles" className={styles.label}>
          Roles
        </span>
        <RoleToggles value={roles} onChange={setRoles} labelledBy="person-roles" />
        {rolesError && <p className={styles.error}>{rolesError}</p>}
      </div>
      <TagField
        label="Instrumentos"
        values={playing}
        onChange={changePlaying}
        placeholder="Dulzaina, canto…"
        hint={
          instruments.length
            ? 'Los de Mi grupo que toca. Solo podrá ocupar el sitio de esos instrumentos.'
            : 'Los que toca. Añade los del grupo en su información para elegirlos de la lista.'
        }
        suggestions={instruments}
        suggestionsTitle="De Mi grupo: elige uno o escribe otro"
      />
      <ColorPicker label="Color principal" value={color} onValueChange={setColor} allowRandom />
      <TextField
        label="Notas"
        name="notes"
        defaultValue={person?.notes ?? ''}
        maxLength={500}
        hint="Opcional: voz, talla…"
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

import type { GridColor, Group } from '@cuadrocorrocalle/shared';
import { type FormEvent, useState } from 'react';

import { confirmationInput, useHasPassword } from '../../auth/confirmation';
import { useCreateGroup, useDeleteGroup, useUpdateGroup } from '../../groups/groupsApi';
import { ConfirmIdentity } from '../ConfirmIdentity/ConfirmIdentity';
import { Button } from '../ui/Button/Button';
import { TextField } from '../ui/TextField/TextField';
import { GridColorPicker } from './GridColorPicker';
import styles from './GroupForms.module.scss';

interface GroupFormProps {
  /** Group to edit; a new one is created without it. */
  group?: Group;
  submitLabel: string;
  onCancel: () => void;
  onSaved: (group: Group) => void;
  /** Offers "Borrar grupo" when editing. */
  onDelete?: () => void;
}

export function GroupForm({ group, submitLabel, onCancel, onSaved, onDelete }: GroupFormProps) {
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const mutation = group ? updateGroup : createGroup;
  const [color, setColor] = useState<GridColor>(group?.gridColor ?? 'azul');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = { name: String(new FormData(event.currentTarget).get('name')), gridColor: color };

    if (group) updateGroup.mutate({ id: group.id, ...input }, { onSuccess: onSaved });
    else createGroup.mutate(input, { onSuccess: onSaved });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <TextField
        label="Nombre del grupo"
        name="name"
        defaultValue={group?.name}
        maxLength={60}
        required
        autoFocus
        error={mutation.error?.message}
      />
      <GridColorPicker value={color} onChange={setColor} />
      <div className={styles.actions}>
        {group && onDelete && !group.isTrial && (
          <Button variant="danger" className={styles.deleteButton} onClick={onDelete}>
            Borrar grupo
          </Button>
        )}
        <Button onClick={onCancel}>Volver</Button>
        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando…' : submitLabel}
        </Button>
      </div>
      {group?.isTrial && <p className={styles.note}>El Grupo de Prueba no se puede borrar.</p>}
    </form>
  );
}

interface DeleteGroupFormProps {
  group: Group;
  onCancel: () => void;
  onDeleted: () => void;
}

/** Asks for the password again, or the group's name for accounts created with Google. */
export function DeleteGroupForm({ group, onCancel, onDeleted }: DeleteGroupFormProps) {
  const deleteGroup = useDeleteGroup();
  const withPassword = useHasPassword();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('confirm'));
    deleteGroup.mutate(
      { id: group.id, ...confirmationInput(Boolean(withPassword), value) },
      { onSuccess: onDeleted },
    );
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <ConfirmIdentity
        withPassword={withPassword}
        groupName={group.name}
        warning={
          <>
            Se borrará <strong>«{group.name}»</strong> con todas sus personas y actuaciones. No se
            puede deshacer.
          </>
        }
        error={deleteGroup.error?.message}
      />
      <div className={styles.actions}>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button
          type="submit"
          variant="danger"
          disabled={withPassword === undefined || deleteGroup.isPending}
        >
          {deleteGroup.isPending ? 'Borrando…' : 'Borrar grupo'}
        </Button>
      </div>
    </form>
  );
}

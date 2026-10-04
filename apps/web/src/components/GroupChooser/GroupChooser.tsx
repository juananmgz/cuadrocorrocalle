import type { GridColor, Group } from '@cuadrocorrocalle/shared';
import { type FormEvent, useState } from 'react';

import { gridColorVar } from '../../groups/gridColors';
import { clearActiveGroup } from '../../groups/activeGroup';
import {
  licenseQuotaText,
  useCreateGroup,
  useDeleteGroup,
  useUpdateGroup,
} from '../../groups/groupsApi';
import { confirmationInput, useHasPassword } from '../../auth/confirmation';
import { ConfirmIdentity } from '../ConfirmIdentity/ConfirmIdentity';
import { Button } from '../ui/Button/Button';
import { Dialog } from '../ui/Dialog/Dialog';
import { TextField } from '../ui/TextField/TextField';
import { useToast } from '../ui/Toast/toastContext';
import { GridColorPicker } from './GridColorPicker';
import styles from './GroupChooser.module.scss';

interface GroupChooserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
  /** How many more groups the licences allow; null means unlimited. */
  groupsAvailable: number | null;
  activeId: string | null;
  onChoose: (group: Group) => void;
  /** False on entry, when a group must be chosen before continuing. */
  dismissable: boolean;
}

type View =
  | { kind: 'choose' }
  | { kind: 'manage' }
  | { kind: 'create' }
  | { kind: 'edit'; group: Group }
  | { kind: 'delete'; group: Group };

const TITLES: Record<View['kind'], string> = {
  choose: 'Elegir grupo',
  manage: 'Editar grupos',
  create: 'Crear grupo',
  edit: 'Editar grupo',
  delete: 'Borrar grupo',
};

/** "Elegir grupo", styled after Chrome's profile picker, with a Netflix-style manage mode. */
export function GroupChooser({
  open,
  onOpenChange,
  groups,
  groupsAvailable,
  activeId,
  onChoose,
  dismissable,
}: GroupChooserProps) {
  const toast = useToast();
  const [view, setView] = useState<View>({ kind: 'choose' });
  const managing = view.kind === 'manage';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setView({ kind: 'choose' });
      }}
      dismissable={dismissable}
      title={TITLES[view.kind]}
      description={
        view.kind === 'choose'
          ? '¿Con qué grupo vas a trabajar?'
          : managing
            ? 'Elige el grupo que quieres cambiar.'
            : undefined
      }
    >
      {view.kind === 'create' && (
        <GroupForm
          submitLabel="Crear grupo"
          onCancel={() => setView({ kind: 'choose' })}
          onSaved={(group) => {
            setView({ kind: 'choose' });
            onChoose(group);
          }}
        />
      )}
      {view.kind === 'edit' && (
        <GroupForm
          group={view.group}
          submitLabel="Guardar"
          onCancel={() => setView({ kind: 'manage' })}
          onSaved={() => setView({ kind: 'manage' })}
          onDelete={() => setView({ kind: 'delete', group: view.group })}
        />
      )}
      {view.kind === 'delete' && (
        <DeleteGroupForm
          group={view.group}
          onCancel={() => setView({ kind: 'edit', group: view.group })}
          onDeleted={() => {
            if (view.group.id === activeId) clearActiveGroup();
            toast.show({ title: `«${view.group.name}» borrado`, tone: 'success' });
            setView({ kind: 'manage' });
          }}
        />
      )}
      {(view.kind === 'choose' || managing) && (
        <>
          <ul className={styles.grid}>
            {groups.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  className={styles.tile}
                  data-managing={managing ? '' : undefined}
                  aria-current={!managing && group.id === activeId ? 'true' : undefined}
                  aria-label={managing ? `Editar ${group.name}` : undefined}
                  onClick={() => (managing ? setView({ kind: 'edit', group }) : onChoose(group))}
                >
                  <span
                    className={styles.avatar}
                    style={{ background: gridColorVar(group.gridColor) }}
                    aria-hidden="true"
                  >
                    {group.name.trim().slice(0, 1).toUpperCase()}
                    {managing && <span className={styles.pencil}>✎</span>}
                  </span>
                  <span className={styles.name}>{group.name}</span>
                  {group.isTrial && <span className={styles.badge}>Prueba</span>}
                </button>
              </li>
            ))}
            {!managing && (
              <li>
                <button
                  type="button"
                  className={styles.tile}
                  onClick={() => setView({ kind: 'create' })}
                >
                  <span className={styles.add} aria-hidden="true">
                    +
                  </span>
                  <span className={styles.name}>Crear grupo</span>
                </button>
              </li>
            )}
          </ul>
          <div className={styles.footer}>
            <p className={styles.quota}>{licenseQuotaText(groupsAvailable)}</p>
            <Button
              variant={managing ? 'primary' : 'secondary'}
              onClick={() => setView({ kind: managing ? 'choose' : 'manage' })}
            >
              {managing ? 'Listo' : 'Editar grupos'}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

interface GroupFormProps {
  /** Group to edit; a new one is created without it. */
  group?: Group;
  submitLabel: string;
  onCancel: () => void;
  onSaved: (group: Group) => void;
  /** Offers "Borrar grupo" when editing. */
  onDelete?: () => void;
}

function GroupForm({ group, submitLabel, onCancel, onSaved, onDelete }: GroupFormProps) {
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
function DeleteGroupForm({ group, onCancel, onDeleted }: DeleteGroupFormProps) {
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

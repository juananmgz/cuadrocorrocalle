import { GRID_COLORS, type GridColor, type Group } from '@cuadrocorrocalle/shared';
import { RadioGroup } from 'radix-ui';
import { type FormEvent, useState } from 'react';

import { GRID_COLOR_LABELS, gridColorVar } from '../../groups/gridColors';
import { licenseQuotaText, useCreateGroup, useUpdateGroup } from '../../groups/groupsApi';
import { Button } from '../ui/Button/Button';
import { Dialog } from '../ui/Dialog/Dialog';
import { TextField } from '../ui/TextField/TextField';
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
  { kind: 'choose' } | { kind: 'manage' } | { kind: 'create' } | { kind: 'edit'; group: Group };

const TITLES: Record<View['kind'], string> = {
  choose: 'Elegir grupo',
  manage: 'Editar grupos',
  create: 'Crear grupo',
  edit: 'Editar grupo',
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
}

function GroupForm({ group, submitLabel, onCancel, onSaved }: GroupFormProps) {
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
      <div className={styles.colors}>
        <span id="grid-color-label" className={styles.label}>
          Color de la cuadrícula
        </span>
        <RadioGroup.Root
          className={styles.swatches}
          aria-labelledby="grid-color-label"
          orientation="horizontal"
          value={color}
          onValueChange={(value) => setColor(value as GridColor)}
        >
          {GRID_COLORS.map((id) => (
            <RadioGroup.Item
              key={id}
              value={id}
              className={styles.swatch}
              style={{ background: gridColorVar(id) }}
              aria-label={GRID_COLOR_LABELS[id]}
              title={GRID_COLOR_LABELS[id]}
            >
              <RadioGroup.Indicator className={styles.check}>✓</RadioGroup.Indicator>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      </div>
      <div className={styles.actions}>
        <Button onClick={onCancel}>Volver</Button>
        <Button type="submit" variant="primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

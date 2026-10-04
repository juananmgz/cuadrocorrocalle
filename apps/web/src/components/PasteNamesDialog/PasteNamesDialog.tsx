import {
  type Figure,
  MAX_PASTED_NAMES,
  parseNameList,
  PERSON_ROLES,
  type PersonRole,
} from '@cuadrocorrocalle/shared';
import { type FormEvent, useState } from 'react';

import { confirmationInput, useHasPassword } from '../../auth/confirmation';
import { FIGURE_LABELS, type PeopleMutations } from '../../people/peopleApi';
import { ConfirmIdentity } from '../ConfirmIdentity/ConfirmIdentity';
import { GenderToggle, RoleToggles } from '../PersonFields/PersonFields';
import { Button } from '../ui/Button/Button';
import { Dialog } from '../ui/Dialog/Dialog';
import { TextArea } from '../ui/TextArea/TextArea';
import styles from './PasteNamesDialog.module.scss';

interface PasteNamesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutations: PeopleMutations;
  groupName: string;
  /** People already in the group, deleted when the list replaces them. */
  currentCount: number;
}

/** One list with boys and girls together, or one list for each. */
type Mode = 'joint' | 'split';

interface Entry {
  name: string;
  figure: Figure | null;
  roles: PersonRole[];
}

const complete = (entry: Entry) => Boolean(entry.figure && entry.roles.length);

/**
 * Adds many people at once: first the pasted names, then the gender (in a joint list) and the
 * roles of each one; nobody is added until everyone has them.
 */
export function PasteNamesDialog({
  open,
  onOpenChange,
  mutations,
  groupName,
  currentCount,
}: PasteNamesDialogProps) {
  const [mode, setMode] = useState<Mode>('joint');
  const [text, setText] = useState('');
  const [boys, setBoys] = useState('');
  const [girls, setGirls] = useState('');
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [replace, setReplace] = useState(false);
  const withPassword = useHasPassword();

  const named =
    mode === 'joint'
      ? parseNameList(text).map((name) => ({ name, figure: null }))
      : [
          ...parseNameList(boys).map((name) => ({ name, figure: 'boy' as const })),
          ...parseNameList(girls).map((name) => ({ name, figure: 'girl' as const })),
        ];
  const tooMany = named.length > MAX_PASTED_NAMES;
  const missing = entries?.filter((entry) => !complete(entry)).length ?? 0;

  const reset = () => {
    setText('');
    setBoys('');
    setGirls('');
    setEntries(null);
    setReplace(false);
    mutations.paste.reset();
  };
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  // Going back and forth keeps what was already chosen for each name.
  const next = () =>
    setEntries((previous) =>
      named.map(({ name, figure }) => {
        const before = previous?.find((entry) => entry.name === name);
        return { name, figure: figure ?? before?.figure ?? null, roles: before?.roles ?? [] };
      }),
    );

  const update = (index: number, change: Partial<Entry>) =>
    setEntries((current) =>
      current!.map((entry, i) => (i === index ? { ...entry, ...change } : entry)),
    );

  // "Todos": a role is on when everyone has it; pressing it gives it to or takes it from all.
  const sharedRoles = PERSON_ROLES.filter((role) =>
    entries?.every((entry) => entry.roles.includes(role)),
  );
  const setAllRoles = (roles: PersonRole[]) => {
    const added = roles.filter((role) => !sharedRoles.includes(role));
    const removed = sharedRoles.filter((role) => !roles.includes(role));
    setEntries((current) =>
      current!.map((entry) => ({
        ...entry,
        roles: PERSON_ROLES.filter(
          (role) => !removed.includes(role) && (added.includes(role) || entry.roles.includes(role)),
        ),
      })),
    );
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!entries) return next();
    if (missing) return;
    const confirm = String(new FormData(event.currentTarget).get('confirm') ?? '');
    mutations.paste.mutate(
      replace
        ? { names: entries, replace, ...confirmationInput(Boolean(withPassword), confirm) }
        : { names: entries },
      { onSuccess: () => close(false) },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title="Pegar lista"
      description={
        entries
          ? mode === 'joint'
            ? 'Elige el género y al menos un rol para cada persona.'
            : 'Elige al menos un rol para cada persona.'
          : 'Pega los nombres uno por línea o separados por comas. Cada persona recibe un color.'
      }
    >
      <form className={styles.form} onSubmit={submit}>
        {!entries && (
          <>
            <div className={styles.modes} role="radiogroup" aria-label="Cómo es la lista">
              {(
                [
                  ['joint', 'Una lista'],
                  ['split', 'Chicos y chicas por separado'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  className={styles.mode}
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === 'joint' ? (
              <TextArea
                label="Nombres"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={'Julia Sánchez\nMario López\nAna Martín'}
                autoFocus
              />
            ) : (
              <div className={styles.split}>
                <TextArea
                  label="Chicos"
                  value={boys}
                  onChange={(event) => setBoys(event.target.value)}
                  placeholder={'Mario López\nPablo Ruiz'}
                  autoFocus
                />
                <TextArea
                  label="Chicas"
                  value={girls}
                  onChange={(event) => setGirls(event.target.value)}
                  placeholder={'Julia Sánchez\nAna Martín'}
                />
              </div>
            )}
            <p className={styles.count} role="status">
              {tooMany
                ? `Máximo ${MAX_PASTED_NAMES} nombres de una vez.`
                : named.length === 0
                  ? 'Aún no hay nombres.'
                  : `${named.length === 1 ? '1 persona' : `${named.length} personas`}.`}
            </p>
            <div className={styles.actions}>
              <Button onClick={() => close(false)}>Cancelar</Button>
              <Button type="submit" variant="primary" disabled={!named.length || tooMany}>
                Siguiente
              </Button>
            </div>
          </>
        )}

        {entries && (
          <>
            <div className={styles.all}>
              <span id="paste-all" className={styles.allLabel}>
                Todos
              </span>
              <RoleToggles
                value={sharedRoles}
                onChange={setAllRoles}
                labelledBy="paste-all"
                compact
              />
            </div>
            <ul className={styles.entries}>
              {entries.map((entry, index) => (
                <li
                  key={`${index}-${entry.name}`}
                  className={styles.entry}
                  data-missing={complete(entry) ? undefined : ''}
                >
                  <span className={styles.name}>
                    {entry.name}
                    {mode === 'split' && entry.figure && (
                      <span className={styles.fixed}>{FIGURE_LABELS[entry.figure]}</span>
                    )}
                  </span>
                  {mode === 'joint' && (
                    <GenderToggle
                      value={entry.figure}
                      onChange={(figure) => update(index, { figure })}
                      label={`Género de ${entry.name}`}
                      compact
                    />
                  )}
                  <RoleToggles
                    value={entry.roles}
                    onChange={(roles) => update(index, { roles })}
                    label={`Roles de ${entry.name}`}
                    compact
                  />
                </li>
              ))}
            </ul>
            <p className={styles.count} role="status">
              {missing
                ? `Faltan ${missing === 1 ? '1 persona' : `${missing} personas`} por completar.`
                : 'Todo listo.'}
            </p>
            {currentCount > 0 && (
              <label className={styles.replace}>
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(event) => setReplace(event.target.checked)}
                />
                Reemplazar la lista actual
              </label>
            )}
            {replace && (
              <ConfirmIdentity
                withPassword={withPassword}
                groupName={groupName}
                warning={
                  <>
                    Se borrarán las <strong>{currentCount}</strong> personas que hay ahora en «
                    {groupName}» y desaparecerán de las convocatorias. No se puede deshacer.
                  </>
                }
                error={mutations.paste.error?.message}
              />
            )}
            {mutations.paste.error && !replace && (
              <p className={styles.error} role="alert">
                {mutations.paste.error.message}
              </p>
            )}
            <div className={styles.actions}>
              <Button onClick={() => setEntries(null)}>Atrás</Button>
              <Button
                type="submit"
                variant={replace ? 'danger' : 'primary'}
                disabled={
                  missing > 0 ||
                  mutations.paste.isPending ||
                  (replace && withPassword === undefined)
                }
              >
                {mutations.paste.isPending
                  ? 'Guardando…'
                  : `${replace ? 'Reemplazar con' : 'Añadir'} ${
                      entries.length === 1 ? '1 persona' : `${entries.length} personas`
                    }`}
              </Button>
            </div>
          </>
        )}
      </form>
    </Dialog>
  );
}

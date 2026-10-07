import {
  type CallUpEntry,
  type CallUpStatus,
  type Figure,
  type Membership,
  MEMBERSHIP_LABELS,
  PERSON_ROLES,
  type Person,
  type PersonRole,
  ROLE_LABELS,
} from '@cuadrocorrocalle/shared';
import { useEffect, useMemo, useState } from 'react';

import { matchNames, type NameMatch } from '../../callUps/matchNames';
import { Button } from '../../components/ui/Button/Button';
import { FilterMenu } from '../../components/ui/FilterMenu/FilterMenu';
import { PersonChip } from '../../components/ui/PersonChip/PersonChip';
import { FIGURE_LABELS, usePeople, usePeopleMutations } from '../../people/peopleApi';
import styles from './CallUpSection.module.scss';
import { type ImportedName, ImportNamesDialog } from './ImportNamesDialog';

/** An imported name and who it is in the group; skipped rows are left out. */
interface Row extends NameMatch {
  skipped: boolean;
}

interface CallUpSectionProps {
  groupId: string;
  /** Call-up already saved, when editing a performance. */
  initial?: CallUpEntry[];
  /** Reports the call-up and whether imported names are still missing from the group. */
  onChange: (entries: CallUpEntry[], pending: boolean) => void;
}

// Stable while loading, so the call-up is not recalculated on every render.
const NO_PEOPLE: Person[] = [];
const MEMBERSHIPS: Membership[] = ['member', 'collaborator'];
const FIGURES: Figure[] = ['boy', 'girl'];

// Each click moves a person along: comes, pending confirmation, not called up.
const NEXT_STATUS = { none: 'yes', yes: 'maybe', maybe: 'none' } as const;
type ChipStatus = keyof typeof NEXT_STATUS;

/** "Convocatoria": click each person to mark who comes, or import a list. */
export function CallUpSection({ groupId, initial, onChange }: CallUpSectionProps) {
  const { data: people = NO_PEOPLE } = usePeople(groupId);
  const mutations = usePeopleMutations(groupId);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  // People who do not come are left out, as if they were not called up.
  const [statuses, setStatuses] = useState<Record<string, CallUpStatus>>(() =>
    Object.fromEntries(
      (initial ?? [])
        .filter((entry) => entry.status !== 'no')
        .map((entry) => [entry.personId, entry.status]),
    ),
  );
  // Every option starts on, so nobody is hidden at first.
  const [roles, setRoles] = useState<PersonRole[]>([...PERSON_ROLES]);
  const [memberships, setMemberships] = useState<Membership[]>(MEMBERSHIPS);
  const [figures, setFigures] = useState<Figure[]>(FIGURES);

  const missing = rows.filter((row) => !row.personId && !row.skipped);
  const entries = useMemo(
    () =>
      people.flatMap((person) => {
        const status = statuses[person.id];
        return status ? [{ personId: person.id, status }] : [];
      }),
    [people, statuses],
  );
  useEffect(() => onChange(entries, missing.length > 0), [entries, missing.length, onChange]);

  // Doubtful matches (low score, a tie or the same person twice) show the imported name.
  const doubtful = new Map(
    rows
      .filter((row) => row.personId && !row.skipped && row.state === 'doubtful')
      .map((row) => [row.personId!, row.original]),
  );

  // Everyone found in the imported list comes, or is still to be confirmed if marked with "?".
  const [doubts, setDoubts] = useState<Set<string>>(new Set());
  const markAll = (ids: string[], doubtful: (id: string) => boolean = () => false) =>
    setStatuses((current) => ({
      ...current,
      ...Object.fromEntries(ids.map((id) => [id, doubtful(id) ? 'maybe' : ('yes' as const)])),
    }));
  const importNames = (names: ImportedName[]) => {
    const doubtfulNames = new Set(names.filter((item) => item.doubtful).map((item) => item.name));
    setDoubts(doubtfulNames);
    const matches = matchNames(
      names.map((item) => item.name),
      people,
    ).map((match) => ({ ...match, skipped: false }));
    setRows(matches);
    const unsure = new Set(
      matches.flatMap((match) =>
        match.personId && doubtfulNames.has(match.original) ? [match.personId] : [],
      ),
    );
    markAll(
      matches.flatMap((match) => (match.personId ? [match.personId] : [])),
      (id) => unsure.has(id),
    );
  };

  // New people join the group as collaborators and come.
  const link = (created: Person[]) => {
    setRows((current) =>
      current.map((row) => {
        const person = created.find((item) => item.name === row.original);
        return person && !row.personId ? { ...row, personId: person.id, state: 'matched' } : row;
      }),
    );
    markAll(
      created.map((person) => person.id),
      (id) => doubts.has(created.find((person) => person.id === id)?.name ?? ''),
    );
  };
  const createOne = (name: string) =>
    mutations.create.mutate({ name, membership: 'collaborator' }, { onSuccess: (p) => link([p]) });
  const createMissing = () =>
    mutations.paste.mutate(
      { names: missing.map((row) => row.original), membership: 'collaborator' },
      { onSuccess: link },
    );
  const skip = (original: string) =>
    setRows((current) =>
      current.map((row) => (row.original === original ? { ...row, skipped: true } : row)),
    );

  const cycle = (personId: string) =>
    setStatuses((current) => {
      const next = NEXT_STATUS[(current[personId] as ChipStatus | undefined) ?? 'none'];
      const rest = Object.fromEntries(Object.entries(current).filter(([id]) => id !== personId));
      return next === 'none' ? rest : { ...rest, [personId]: next };
    });

  // People without a role or gender only hide when that filter is narrowed.
  const visible = people.filter(
    (person) =>
      memberships.includes(person.membership) &&
      (roles.length === PERSON_ROLES.length || person.roles.some((role) => roles.includes(role))) &&
      (figures.length === FIGURES.length || (person.figure && figures.includes(person.figure))),
  );
  const coming = entries.filter((entry) => entry.status === 'yes').length;
  const pending = entries.length - coming;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Button onClick={() => setImporting(true)}>Importar</Button>
        <p className={styles.summary}>
          Vienen {coming}
          {pending > 0 && ` · Por confirmar ${pending}`}
        </p>
      </div>

      {rows.length > 0 && (
        <p className={styles.notice}>
          Revisa la convocatoria: al importar puede haber nombres mal escritos.
        </p>
      )}
      {missing.length > 0 && (
        <div className={styles.missing}>
          <div className={styles.missingHead}>
            <span>
              {missing.length === 1
                ? '1 nombre no está en el grupo'
                : `${missing.length} nombres no están en el grupo`}
            </span>
            <Button onClick={createMissing} disabled={mutations.paste.isPending}>
              {missing.length === 1
                ? 'Crear 1 miembro nuevo'
                : `Crear ${missing.length} miembros nuevos`}
            </Button>
          </div>
          <ul className={styles.missingList}>
            {missing.map((row) => (
              <li key={row.original}>
                <span className={styles.original}>{row.original}</span>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => createOne(row.original)}
                  disabled={mutations.create.isPending}
                >
                  Crear
                </button>
                <button type="button" className={styles.link} onClick={() => skip(row.original)}>
                  No incluir
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.filters}>
        <FilterMenu
          label="Rol"
          options={PERSON_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))}
          selected={roles}
          onChange={setRoles}
        />
        <FilterMenu
          label="Tipo"
          options={MEMBERSHIPS.map((value) => ({ value, label: MEMBERSHIP_LABELS[value] }))}
          selected={memberships}
          onChange={setMemberships}
        />
        <FilterMenu
          label="Género"
          options={FIGURES.map((value) => ({ value, label: FIGURE_LABELS[value] }))}
          selected={figures}
          onChange={setFigures}
        />
      </div>

      <p className={styles.hint}>Un clic: viene. Dos: por confirmar. Tres: lo quitas.</p>
      {people.length === 0 && <p className={styles.notice}>Aún no hay personas en el grupo.</p>}
      {people.length > 0 && !visible.length && (
        <p className={styles.notice}>Nadie cumple los filtros.</p>
      )}
      <ul className={styles.chips}>
        {visible.map((person) => {
          const status = statuses[person.id];
          const label =
            status === 'yes' ? 'viene' : status === 'maybe' ? 'por confirmar' : 'no convocado';
          return (
            <li key={person.id}>
              <button
                type="button"
                className={styles.chip}
                aria-label={`${person.name}: ${label}`}
                onClick={() => cycle(person.id)}
              >
                <PersonChip
                  name={person.name}
                  color={person.mainColor}
                  highlighted={status === 'yes'}
                  secondary={status === 'maybe'}
                />
                {doubtful.has(person.id) && status && (
                  <span className={styles.review}>Revisar: «{doubtful.get(person.id)}»</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <ImportNamesDialog open={importing} onOpenChange={setImporting} onImport={importNames} />
    </div>
  );
}

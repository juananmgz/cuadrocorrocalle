import {
  CALL_UP_LABELS,
  type CallUpEntry,
  type CallUpStatus,
  parseNameList,
  type Person,
  ROLE_LABELS,
} from '@cuadrocorrocalle/shared';
import { type ChangeEvent, useEffect, useMemo, useState } from 'react';

import { matchNames, type NameMatch } from '../../callUps/matchNames';
import { Button } from '../../components/ui/Button/Button';
import { Tabs } from '../../components/ui/Tabs/Tabs';
import { TextArea } from '../../components/ui/TextArea/TextArea';
import { getPersonColor } from '../../components/ui/personColors';
import { usePeople, usePeopleMutations } from '../../people/peopleApi';
import styles from './CallUpSection.module.scss';

/** A pasted or imported name and who it is in the group; skipped rows are left out. */
interface Row extends NameMatch {
  skipped: boolean;
}

interface CallUpSectionProps {
  groupId: string;
  /** Reports the call-up and whether names are still missing from the group. */
  onChange: (entries: CallUpEntry[], pending: boolean) => void;
}

const STATUSES: CallUpStatus[] = ['yes', 'no', 'maybe'];
// Stable while loading, so the call-up is not recalculated on every render.
const NO_PEOPLE: Person[] = [];

/** CSV files keep the first column; plain text keeps every line. */
async function readNames(file: File) {
  const text = await file.text();
  if (!/\.csv$/i.test(file.name)) return parseNameList(text);
  return parseNameList(
    text
      .split(/\r?\n/)
      .map((line) => line.split(/[;,\t]/)[0]?.replace(/"/g, '') ?? '')
      .join('\n'),
  );
}

/** "Convocatoria": paste or import a list, or choose who comes by hand. */
export function CallUpSection({ groupId, onChange }: CallUpSectionProps) {
  const { data: people = NO_PEOPLE } = usePeople(groupId);
  const mutations = usePeopleMutations(groupId);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  // Statuses chosen by hand; pasted people come by default.
  const [chosen, setChosen] = useState<Record<string, CallUpStatus | null>>({});
  const [importError, setImportError] = useState('');
  const [tab, setTab] = useState('paste');

  const listed = useMemo(
    () => new Set(rows.filter((row) => row.personId && !row.skipped).map((row) => row.personId!)),
    [rows],
  );
  const statusOf = (personId: string) =>
    personId in chosen ? chosen[personId]! : listed.has(personId) ? 'yes' : null;
  const missing = rows.filter((row) => !row.personId && !row.skipped);

  const entries = useMemo(
    () =>
      people.flatMap((person) => {
        const status =
          person.id in chosen ? chosen[person.id] : listed.has(person.id) ? 'yes' : null;
        return status ? [{ personId: person.id, status }] : [];
      }),
    [people, chosen, listed],
  );
  useEffect(() => onChange(entries, missing.length > 0), [entries, missing.length, onChange]);

  // The list marks who comes and opens the list by hand to review it.
  const relate = (names: string[]) => {
    setRows(matchNames(names, people).map((match) => ({ ...match, skipped: false })));
    setTab('manual');
  };

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const names = await readNames(file);
    setImportError(names.length ? '' : 'No hay nombres en el fichero');
    if (names.length) relate(names);
  };

  const skip = (original: string) =>
    setRows((current) =>
      current.map((row) => (row.original === original ? { ...row, skipped: true } : row)),
    );

  // New people join the group as occasional collaborators.
  const link = (created: Person[]) =>
    setRows((current) =>
      current.map((row) => {
        const person = created.find((item) => item.name === row.original);
        return person && !row.personId ? { ...row, personId: person.id, state: 'matched' } : row;
      }),
    );
  const createOne = (name: string) =>
    mutations.create.mutate({ name, membership: 'collaborator' }, { onSuccess: (p) => link([p]) });
  const createMissing = () =>
    mutations.paste.mutate(
      { names: missing.map((row) => row.original), membership: 'collaborator' },
      { onSuccess: link },
    );

  const setStatus = (personId: string, status: CallUpStatus) =>
    setChosen((current) => ({
      ...current,
      [personId]: statusOf(personId) === status ? null : status,
    }));

  const counts = STATUSES.map((status) => ({
    status,
    count: entries.filter((entry) => entry.status === status).length,
  }));

  // Doubtful matches (low score, a tie or the same person twice) show the pasted name to review.
  const doubtful = new Map(
    rows
      .filter((row) => row.personId && !row.skipped && row.state === 'doubtful')
      .map((row) => [row.personId!, row.original]),
  );

  const listReview = rows.length > 0 && (
    <>
      <p className={styles.notice}>
        Revisa la convocatoria: al pegar o importar puede haber nombres mal escritos.
      </p>
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
    </>
  );

  return (
    <div className={styles.root}>
      <Tabs
        label="Cómo elegir la convocatoria"
        value={tab}
        onValueChange={setTab}
        items={[
          {
            value: 'paste',
            label: 'Pegar',
            content: (
              <div className={styles.tab}>
                <TextArea
                  label="Lista de nombres"
                  hint="Uno por línea o separados por comas"
                  rows={4}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
                <Button onClick={() => relate(parseNameList(text))} disabled={!text.trim()}>
                  Marcar en la convocatoria
                </Button>
              </div>
            ),
          },
          {
            value: 'import',
            label: 'Importar',
            content: (
              <div className={styles.tab}>
                <label className={styles.file}>
                  <span>Fichero .txt o .csv (en un CSV se usa la primera columna)</span>
                  <input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={importFile} />
                </label>
                {importError && <p className={styles.error}>{importError}</p>}
              </div>
            ),
          },
          {
            value: 'manual',
            label: 'A mano',
            content: (
              <div className={styles.tab}>
                {listReview}
                <p className={styles.summary}>
                  {counts
                    .map(({ status, count }) => `${CALL_UP_LABELS[status]}: ${count}`)
                    .join(' · ')}
                </p>
                {people.length === 0 && (
                  <p className={styles.notice}>Aún no hay personas en el grupo.</p>
                )}
                <ul className={styles.people}>
                  {people.map((person) => (
                    <li key={person.id} className={styles.person}>
                      <span className={styles.name}>
                        <span
                          className={styles.dot}
                          style={{ background: getPersonColor(person.mainColor).fill }}
                          aria-hidden="true"
                        />
                        {person.name}
                        {person.roles.map((role) => (
                          <span key={role} className={styles.tag}>
                            {ROLE_LABELS[role]}
                          </span>
                        ))}
                        {person.membership === 'collaborator' && (
                          <span className={styles.tag}>Colaborador</span>
                        )}
                        {doubtful.has(person.id) && statusOf(person.id) && (
                          <span className={styles.review}>
                            Revisar: «{doubtful.get(person.id)}»
                          </span>
                        )}
                      </span>
                      <span className={styles.statuses} role="group" aria-label={person.name}>
                        {STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={styles.status}
                            data-status={status}
                            aria-pressed={statusOf(person.id) === status}
                            onClick={() => setStatus(person.id, status)}
                          >
                            {CALL_UP_LABELS[status]}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

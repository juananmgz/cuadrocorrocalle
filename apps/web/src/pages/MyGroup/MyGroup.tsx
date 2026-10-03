import {
  type Figure,
  type Membership,
  type Person,
  PERSON_ROLES,
  type PersonRole,
  ROLE_LABELS,
} from '@cuadrocorrocalle/shared';
import { useLayoutEffect, useRef, useState } from 'react';

import { useApp } from '../../components/AppLayout/appContext';
import { PasteNamesDialog } from '../../components/PasteNamesDialog/PasteNamesDialog';
import { PersonDialog } from '../../components/PersonDialog/PersonDialog';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { PersonChip } from '../../components/ui/PersonChip/PersonChip';
import { GRID_COLOR_LABELS, gridColorVar } from '../../groups/gridColors';
import { normalizeName } from '../../callUps/matchNames';
import { FIGURE_LABELS, usePeople, usePeopleMutations } from '../../people/peopleApi';
import { DeleteAllPeopleDialog } from './DeleteAllPeopleDialog';
import styles from './MyGroup.module.scss';

/** "Mi grupo": the group's information and its people (OA-01). */
export function MyGroup() {
  const { activeGroup } = useApp();

  return (
    // data-wide lets the layout give this page more room.
    <div className={styles.page} data-wide="">
      <h1 className={styles.title}>Mi grupo</h1>
      {activeGroup && <GroupPeople key={activeGroup.id} groupId={activeGroup.id} />}
    </div>
  );
}

const MOVE_MS = 450;

type SortKey = 'name' | 'role' | 'gender';
interface Sort {
  key: SortKey;
  /** 1 ascending, -1 descending (name and gender). */
  direction: 1 | -1;
  /** Role brought to the top when sorting by role. */
  role: PersonRole;
}

const SORT_LABELS = { name: 'Nombre', role: 'Rol', gender: 'Género' } as const;
const GENDER_ORDER = { boy: 0, girl: 1 } as const;

/**
 * Sorts by the chosen column, then by name. By role, whoever has the chosen role goes first;
 * people without a role or gender go last.
 */
function sortPeople(people: Person[], { key, direction, role }: Sort) {
  const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'es');
  if (key === 'role') {
    const rank = (person: Person) =>
      person.roles.includes(role) ? 0 : person.roles.length ? 1 : 2;
    return [...people].sort((a, b) => rank(a) - rank(b) || byName(a, b));
  }
  const rank = (person: Person) => (person.figure ? String(GENDER_ORDER[person.figure]) : null);
  return [...people].sort((a, b) => {
    if (key === 'name') return byName(a, b) * direction;
    const [ra, rb] = [rank(a), rank(b)];
    if (ra === null || rb === null) return ra === rb ? byName(a, b) : ra === null ? 1 : -1;
    return ra.localeCompare(rb) * direction || byName(a, b);
  });
}

interface SortHeaderProps {
  sort: Sort;
  onSort: (key: SortKey) => void;
  showFigure: boolean;
}

/**
 * Column titles that sort the list. Name and gender reverse when pressed again; role goes
 * through dance, music and singing, showing the role on top with its colour.
 */
function SortHeader({ sort, onSort, showFigure }: SortHeaderProps) {
  const keys: SortKey[] = showFigure ? ['name', 'role', 'gender'] : ['name', 'role'];
  return (
    <div className={styles.columns} data-figure={showFigure ? '' : undefined}>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          className={styles.column}
          aria-pressed={sort.key === key}
          data-key={key}
          aria-label={
            key === 'role' && sort.key === 'role'
              ? `Ordenado por rol: ${ROLE_LABELS[sort.role]} primero`
              : `Ordenar por ${SORT_LABELS[key].toLowerCase()}`
          }
          onClick={() => onSort(key)}
        >
          {SORT_LABELS[key]}
          {sort.key === key &&
            (key === 'role' ? (
              <span className={styles.role} data-role={sort.role} aria-hidden="true">
                {ROLE_LABELS[sort.role]}
              </span>
            ) : (
              <span aria-hidden="true">{sort.direction === 1 ? ' ▲' : ' ▼'}</span>
            ))}
        </button>
      ))}
    </div>
  );
}

/**
 * Slides each person from where it was to where it is now (FLIP), so splitting by gender
 * sends boys to one side and girls to the other instead of jumping.
 */
function useSlide() {
  const items = useRef(new Map<string, HTMLElement>());
  const before = useRef(new Map<string, DOMRect>());

  const remember = () => {
    before.current = new Map(
      [...items.current].map(([id, element]) => [id, element.getBoundingClientRect()]),
    );
  };

  useLayoutEffect(() => {
    const previous = before.current;
    before.current = new Map();
    if (!previous.size || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    items.current.forEach((element, id) => {
      const from = previous.get(id);
      if (!from || !element.animate) return;
      const to = element.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (!dx && !dy) return;
      element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
        duration: MOVE_MS,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
    });
  });

  const ref = (id: string) => (element: HTMLElement | null) => {
    if (element) items.current.set(id, element);
    else items.current.delete(id);
  };
  return { remember, ref };
}

interface PeopleListProps {
  people: Person[];
  onEdit: (person: Person) => void;
  slideRef: (id: string) => (element: HTMLElement | null) => void;
  showFigure: boolean;
}

function PeopleList({ people, onEdit, slideRef, showFigure }: PeopleListProps) {
  return (
    <ul className={styles.people}>
      {people.map((person) => (
        <li key={person.id} ref={slideRef(person.id)}>
          <button
            type="button"
            className={styles.person}
            data-figure={showFigure ? '' : undefined}
            onClick={() => onEdit(person)}
            aria-label={`Editar ${person.name}`}
          >
            <PersonChip name={person.name} color={person.mainColor} />
            <span className={styles.roles}>
              {/* One slot per role, always in the same order, so each tag lines up in its column. */}
              {person.roles.length ? (
                PERSON_ROLES.map((role) =>
                  person.roles.includes(role) ? (
                    <span key={role} className={styles.role} data-role={role}>
                      {ROLE_LABELS[role]}
                    </span>
                  ) : (
                    <span key={role} aria-hidden="true" />
                  ),
                )
              ) : (
                <span className={styles.noRole}>Sin rol</span>
              )}
            </span>
            {showFigure && (
              <span className={styles.figure}>
                {person.figure ? (
                  <span className={styles.gender} data-gender={person.figure}>
                    {FIGURE_LABELS[person.figure]}
                  </span>
                ) : (
                  <span className={styles.noRole}>Sin género</span>
                )}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface GroupSectionProps extends Omit<PeopleListProps, 'people'> {
  title?: string;
  people: Person[];
  /** Groups folded away. */
  collapsed: Set<Membership>;
  onToggle: (membership: Membership) => void;
  sort: Sort;
  onSort: (key: SortKey) => void;
}

const GROUP_TITLES = { member: 'Principales', collaborator: 'Colaboradores' } as const;

/** "Principales" (members) first and, at the end, "Colaboradores"; each group folds away. */
function GroupSection({
  title,
  people,
  collapsed,
  onToggle,
  sort,
  onSort,
  ...list
}: GroupSectionProps) {
  const groups = (['member', 'collaborator'] as const)
    .map((membership) => ({
      membership,
      people: people.filter((person) => person.membership === membership),
    }))
    .filter((group) => group.people.length > 0);
  if (!groups.length && !title) return null;

  return (
    <section className={styles.section}>
      {title && <h3 className={styles.sectionTitle}>{title}</h3>}
      {groups.length > 0 && <SortHeader sort={sort} onSort={onSort} showFigure={list.showFigure} />}
      {groups.map((group) => {
        const open = !collapsed.has(group.membership);
        return (
          <div key={group.membership} className={styles.group}>
            <h4 className={styles.subsection}>
              <button
                type="button"
                className={styles.groupToggle}
                aria-expanded={open}
                onClick={() => onToggle(group.membership)}
              >
                <span className={styles.chevron} aria-hidden="true">
                  ▾
                </span>
                {GROUP_TITLES[group.membership]} ({group.people.length})
              </button>
            </h4>
            {/* Accordion: the list folds to zero height; it stays mounted for the animation. */}
            <div className={styles.fold} data-open={open ? '' : undefined} inert={!open}>
              <div className={styles.foldInner}>
                <PeopleList people={group.people} {...list} />
              </div>
            </div>
          </div>
        );
      })}
      {title && !groups.length && <p className={styles.empty}>Nadie</p>}
    </section>
  );
}

function GroupPeople({ groupId }: { groupId: string }) {
  const { activeGroup } = useApp();
  const { data: people, isPending } = usePeople(groupId);
  const mutations = usePeopleMutations(groupId);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);
  const [pasting, setPasting] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [byGender, setByGender] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: 'name', direction: 1, role: 'dance' });
  const [collapsed, setCollapsed] = useState(new Set<Membership>());
  const [search, setSearch] = useState('');
  const slide = useSlide();
  const group = activeGroup!;
  const count = people?.length ?? 0;
  const collaboratorCount = people?.filter((p) => p.membership === 'collaborator').length ?? 0;

  // Every change of the filters slides people to their new place.
  const toggleGender = () => {
    slide.remember();
    setByGender((value) => !value);
  };
  const toggleGroup = (membership: Membership) => {
    const next = new Set(collapsed);
    if (next.has(membership)) next.delete(membership);
    else next.add(membership);
    setCollapsed(next);
  };
  const changeSort = (key: SortKey) => {
    slide.remember();
    setSort((current) => {
      if (key === 'role') {
        // Dance, music, singing and back to dance.
        const next = PERSON_ROLES[(PERSON_ROLES.indexOf(current.role) + 1) % PERSON_ROLES.length]!;
        return { ...current, key, role: current.key === 'role' ? next : PERSON_ROLES[0] };
      }
      return {
        ...current,
        key,
        direction: current.key === key ? (-current.direction as 1 | -1) : 1,
      };
    });
  };
  // The search ignores accents and case.
  const query = normalizeName(search);
  const found = (people ?? []).filter(
    (person) => !query || normalizeName(person.name).includes(query),
  );
  const sorted = sortPeople(found, sort);
  const ofFigure = (figure: Figure | null) => sorted.filter((person) => person.figure === figure);
  const listProps = {
    collapsed,
    onToggle: toggleGroup,
    onEdit: setEditing,
    slideRef: slide.ref,
    sort,
    onSort: changeSort,
  };

  return (
    <>
      {/* Information on the left (4 of 12 columns), members on the right (8 of 12). */}
      <div className={styles.layout}>
        <Card title="Información">
          <dl className={styles.info}>
            <div>
              <dt>Nombre</dt>
              <dd>{group.name}</dd>
            </div>
            <div>
              <dt>Cuadrícula</dt>
              <dd>
                <span
                  className={styles.swatch}
                  style={{ background: gridColorVar(group.gridColor) }}
                  aria-hidden="true"
                />
                {GRID_COLOR_LABELS[group.gridColor]}
              </dd>
            </div>
            <div>
              <dt>Licencia</dt>
              <dd>{group.isTrial ? 'Grupo de prueba' : 'Sin licencia'}</dd>
            </div>
            <div>
              <dt>Personas</dt>
              <dd>
                {isPending
                  ? '…'
                  : `${count} (${count - collaboratorCount} miembros, ${collaboratorCount} colaboradores)`}
              </dd>
            </div>
          </dl>
        </Card>

        <Card
          title="Miembros"
          actions={
            <>
              <Button variant="primary" onClick={() => setEditing('new')}>
                Añadir persona
              </Button>
              <Button onClick={() => setPasting(true)}>Pegar lista</Button>
            </>
          }
        >
          {people && people.length === 0 && (
            <p className={styles.empty}>
              Aún no hay nadie. Añade a las personas una a una o pega la lista del grupo.
            </p>
          )}
          {people && people.length > 0 && (
            <>
              <div className={styles.filters}>
                <input
                  type="search"
                  className={styles.search}
                  placeholder="Buscar por nombre"
                  aria-label="Buscar por nombre"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <label className={styles.check}>
                  <input type="checkbox" checked={byGender} onChange={toggleGender} />
                  Separar por género
                </label>
              </div>
              {query && !found.length && <p className={styles.empty}>Nadie se llama así.</p>}

              {byGender ? (
                <>
                  <div className={styles.genders}>
                    <GroupSection
                      title="Chicos"
                      people={ofFigure('boy')}
                      showFigure={false}
                      {...listProps}
                    />
                    <GroupSection
                      title="Chicas"
                      people={ofFigure('girl')}
                      showFigure={false}
                      {...listProps}
                    />
                  </div>
                  {ofFigure(null).length > 0 && (
                    <GroupSection
                      title="Sin género"
                      people={ofFigure(null)}
                      showFigure={false}
                      {...listProps}
                    />
                  )}
                </>
              ) : (
                <GroupSection people={sorted} showFigure {...listProps} />
              )}
            </>
          )}
          {people && people.length > 0 && (
            <div className={styles.dangerZone}>
              <Button variant="danger" onClick={() => setDeletingAll(true)}>
                Borrar todos los miembros
              </Button>
            </div>
          )}
        </Card>
      </div>

      <PersonDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        person={editing && editing !== 'new' ? editing : undefined}
        mutations={mutations}
      />
      <PasteNamesDialog
        open={pasting}
        onOpenChange={setPasting}
        mutations={mutations}
        groupName={group.name}
        currentCount={count}
      />
      <DeleteAllPeopleDialog
        open={deletingAll}
        onOpenChange={setDeletingAll}
        groupName={group.name}
        count={count}
        mutations={mutations}
      />
    </>
  );
}

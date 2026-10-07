import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  type Group,
  MAX_GROUP_INSTRUMENTS,
  missingInstruments,
  type Person,
} from '@cuadrocorrocalle/shared';
import { Plus, Trash2, TriangleAlert, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { Menu } from '../../components/ui/Menu/Menu';
import { PersonChip } from '../../components/ui/PersonChip/PersonChip';
import { TagField } from '../../components/ui/TagField/TagField';
import { useToast } from '../../components/ui/Toast/toastContext';
import { useSaveGroupInstruments } from '../../groups/groupsApi';
import type { PeopleMutations } from '../../people/peopleApi';
import { STARTER_INSTRUMENTS } from '../../pieces/instruments';
import styles from './GroupInstruments.module.scss';

interface GroupInstrumentsProps {
  group: Group;
  people: Person[];
  mutations: PeopleMutations;
}

const same = (a: string, b: string) => a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es');
const plays = (person: Person, instrument: string) =>
  person.instruments.some((name) => same(name, instrument));
const byName = (a: Person, b: Person) => a.name.localeCompare(b.name, 'es');

// What is being dragged: a person, from the list of people or from an instrument's row.
interface Dragged {
  personId: string;
  from: string | null;
}
const POOL = 'pool';

/**
 * Third tab of "Mi grupo": the instruments the group plays and who plays each one. People are
 * dragged onto an instrument (or picked with its +) and taken out with their ×.
 */
export function GroupInstruments({ group, people, mutations }: GroupInstrumentsProps) {
  const save = useSaveGroupInstruments(group.id);
  const toast = useToast();
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );
  const instruments = save.isPending && save.variables ? save.variables : group.instruments;
  const sorted = [...people].sort(byName);
  const incomplete = sorted.filter(missingInstruments);
  const musicians = sorted.filter(
    (person) =>
      !missingInstruments(person) &&
      (person.roles.includes('music') || person.roles.includes('singing')),
  );
  const others = sorted.filter(
    (person) => !person.roles.includes('music') && !person.roles.includes('singing'),
  );
  // Played by someone but missing from the list (typed before it had it).
  const unlisted = [...new Set(people.flatMap((person) => person.instruments))].filter(
    (name) => !instruments.some((listed) => same(listed, name)),
  );

  const setPlaying = (person: Person, next: string[]) =>
    mutations.edit.mutate(
      { id: person.id, instruments: next },
      { onError: (error) => toast.show({ title: error.message, tone: 'error' }) },
    );
  // Someone can play several instruments (one in each piece): adding never takes another away.
  const assign = (person: Person, instrument: string) => {
    if (!plays(person, instrument)) setPlaying(person, [...person.instruments, instrument]);
  };
  const unassign = (person: Person, instrument: string) =>
    setPlaying(
      person,
      person.instruments.filter((name) => !same(name, instrument)),
    );

  const saveInstruments = (next: string[]) =>
    save.mutate(next, {
      onError: (error) => toast.show({ title: error.message, tone: 'error' }),
    });
  const addInstrument = (name: string) => {
    if (instruments.some((listed) => same(listed, name))) return;
    if (instruments.length >= MAX_GROUP_INSTRUMENTS)
      return toast.show({ title: `Máximo ${MAX_GROUP_INSTRUMENTS} instrumentos`, tone: 'error' });
    saveInstruments([...instruments, name]);
  };
  // Out of the group's list, and from everyone who played it.
  const deleteInstrument = (name: string) => {
    if (instruments.some((listed) => same(listed, name)))
      saveInstruments(instruments.filter((listed) => !same(listed, name)));
    for (const person of people.filter((item) => plays(item, name))) unassign(person, name);
  };

  const onDragStart = (event: DragStartEvent) => setDragged(event.active.data.current as Dragged);
  const onDragEnd = (event: DragEndEvent) => {
    setDragged(null);
    const data = event.active.data.current as Dragged | undefined;
    const person = people.find((item) => item.id === data?.personId);
    const target = event.over ? String(event.over.id) : null;
    if (!data || !person || !target || target === data.from) return;
    // Back to the list of people: they no longer play the one they came from.
    if (target === POOL) return data.from ? unassign(person, data.from) : undefined;
    // From another instrument too: they now play both.
    assign(person, target);
  };
  const draggedPerson = dragged && people.find((person) => person.id === dragged.personId);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragged(null)}
    >
      <Card title="Instrumentos" className={styles.root}>
        <div className={styles.layout}>
          <People incomplete={incomplete} musicians={musicians} others={others} />
          <div className={styles.scroll}>
            <ul className={styles.list}>
              {[...instruments, ...unlisted].map((instrument) => (
                <InstrumentRow
                  key={instrument}
                  instrument={instrument}
                  unlisted={!instruments.includes(instrument)}
                  players={sorted.filter((person) => plays(person, instrument))}
                  choices={{
                    musicians: [...incomplete, ...musicians].filter(
                      (person) => !plays(person, instrument),
                    ),
                    others: others.filter((person) => !plays(person, instrument)),
                  }}
                  onAdd={(person) => assign(person, instrument)}
                  onRemove={(person) => unassign(person, instrument)}
                  onDelete={() => deleteInstrument(instrument)}
                />
              ))}
              {/* A new instrument: a row with its name to write, then saved with Enter. */}
              {adding && (
                <li className={styles.row}>
                  <TagField
                    label="Nombre del instrumento"
                    values={[]}
                    onChange={([name]) => {
                      if (name) addInstrument(name);
                      setAdding(false);
                    }}
                    onCancel={() => setAdding(false)}
                    placeholder="Nombre del instrumento"
                    suggestions={STARTER_INSTRUMENTS.filter(
                      (name) => !instruments.some((listed) => same(listed, name)),
                    )}
                    suggestionsTitle="Ejemplos: elige uno o escribe el tuyo"
                    inline
                    autoFocus
                  />
                  <span className={styles.count}>0 personas</span>
                </li>
              )}
            </ul>
            {!adding && (
              <Button className={styles.addButton} onClick={() => setAdding(true)}>
                + Añadir instrumento
              </Button>
            )}
            {!instruments.length && !adding && (
              <p className={styles.hint}>
                Añade los que toca el grupo y arrastra a cada persona al suyo. Se ofrecen al decir
                qué instrumentos necesita cada pieza.
              </p>
            )}
          </div>
        </div>
      </Card>
      <DragOverlay dropAnimation={null}>
        {draggedPerson && (
          <PersonChip name={draggedPerson.name} color={draggedPerson.mainColor} highlighted />
        )}
      </DragOverlay>
    </DndContext>
  );
}

/** Everyone, to drag onto an instrument: musicians without one first. */
function People({
  incomplete,
  musicians,
  others,
}: {
  incomplete: Person[];
  musicians: Person[];
  others: Person[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL });
  return (
    <aside ref={setNodeRef} className={styles.pool} data-over={isOver ? '' : undefined}>
      <p className={styles.hint}>Arrastra a cada persona al instrumento que toca.</p>
      {incomplete.length > 0 && (
        <section className={styles.warning}>
          <h3 className={styles.heading}>
            <TriangleAlert size={16} aria-hidden="true" />
            Músicos sin instrumento ({incomplete.length})
          </h3>
          <Chips people={incomplete} from={null} />
        </section>
      )}
      {musicians.length > 0 && (
        <section className={styles.group}>
          <h3 className={styles.subheading}>Músicos ({musicians.length})</h3>
          <Chips people={musicians} from={null} />
        </section>
      )}
      {others.length > 0 && (
        <section className={styles.group}>
          <h3 className={styles.subheading}>Resto del grupo ({others.length})</h3>
          <Chips people={others} from={null} />
        </section>
      )}
    </aside>
  );
}

function Chips({
  people,
  from,
  onRemove,
}: {
  people: Person[];
  from: string | null;
  onRemove?: (person: Person) => void;
}) {
  return (
    <ul className={styles.people}>
      {people.map((person) => (
        <DraggablePerson key={person.id} person={person} from={from} onRemove={onRemove} />
      ))}
    </ul>
  );
}

function DraggablePerson({
  person,
  from,
  onRemove,
}: {
  person: Person;
  from: string | null;
  onRemove?: (person: Person) => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `${from ?? POOL}:${person.id}`,
    data: { personId: person.id, from } satisfies Dragged,
  });
  return (
    <li
      ref={setNodeRef}
      className={styles.handle}
      data-dragging={isDragging ? '' : undefined}
      {...attributes}
      {...listeners}
      aria-label={`Arrastrar a ${person.name}`}
    >
      <PersonChip
        name={person.name}
        color={person.mainColor}
        action={
          onRemove && (
            <button
              type="button"
              className={styles.remove}
              data-danger=""
              aria-label={`Quitar a ${person.name}`}
              // A click on the cross removes them; it never starts a drag.
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={() => onRemove(person)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )
        }
      />
    </li>
  );
}

interface InstrumentRowProps {
  instrument: string;
  unlisted: boolean;
  players: Person[];
  /** People who could be added with the +, musicians first. */
  choices: { musicians: Person[]; others: Person[] };
  onAdd: (person: Person) => void;
  onRemove: (person: Person) => void;
  onDelete: () => void;
}

/** An instrument, with who plays it; people dropped on it start playing it. */
function InstrumentRow({
  instrument,
  unlisted,
  players,
  choices,
  onAdd,
  onRemove,
  onDelete,
}: InstrumentRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: instrument });
  // With people in it, deleting asks once more.
  const [confirming, setConfirming] = useState(false);
  const remove = () => {
    if (players.length && !confirming) return setConfirming(true);
    onDelete();
  };
  const toItems = (list: Person[]) =>
    list.map((person) => ({
      label: person.name,
      // The same chip as everywhere else.
      content: <PersonChip name={person.name} color={person.mainColor} />,
      onSelect: () => onAdd(person),
    }));

  return (
    <li ref={setNodeRef} className={styles.row} data-over={isOver ? '' : undefined}>
      <span className={styles.name}>
        {instrument}
        {unlisted && <span className={styles.unlisted}> (no está en la lista)</span>}
      </span>
      <span className={styles.count}>
        {players.length === 1 ? '1 persona' : `${players.length} personas`}
      </span>
      <div className={styles.players}>
        {players.length > 0 && <Chips people={players} from={instrument} onRemove={onRemove} />}
        <Menu
          align="start"
          trigger={
            <button type="button" className={styles.add} aria-label={`Añadir a ${instrument}`}>
              <Plus size={16} aria-hidden="true" />
            </button>
          }
          items={[]}
          sections={[
            { label: 'Músicos', items: toItems(choices.musicians) },
            { label: 'Resto del grupo', items: toItems(choices.others) },
          ]}
          empty="Ya lo toca todo el grupo"
        />
      </div>
      <button
        type="button"
        className={styles.delete}
        data-confirming={confirming ? '' : undefined}
        aria-label={confirming ? `Confirmar: quitar ${instrument}` : `Quitar ${instrument}`}
        onClick={remove}
        onBlur={() => setConfirming(false)}
      >
        <Trash2 size={16} aria-hidden="true" />
        {confirming &&
          (players.length === 1 ? '¿Quitárselo a 1?' : `¿Quitárselo a ${players.length}?`)}
      </button>
    </li>
  );
}

import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { CallUpStatus, Person } from '@cuadrocorrocalle/shared';
import { type ReactNode, useState } from 'react';

import { PersonChip } from '../ui/PersonChip/PersonChip';
import styles from './PeopleTray.module.scss';

export type TrayPerson = Person & { status: CallUpStatus };

interface PeopleTrayProps {
  people: TrayPerson[];
  /** Title of the open piece; without one, nobody can be picked. */
  pieceTitle: string | null;
  /** People in the open piece. */
  selected: Set<string>;
  /** How many pieces each person takes part in. */
  counts: Map<string, number>;
  onToggle: (person: TrayPerson) => void;
  /** Whether people can be dragged onto the stage (inside a DndContext). */
  draggable?: boolean;
}

const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7M22 21v-1a6 6 0 0 0-4-5.6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BoxIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      d="M21 8 12 3 3 8v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface SectionProps {
  id: string;
  icon: ReactNode;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** One block of the tray; several can be open at once. */
function Section({ id, icon, title, open, onToggle, children }: SectionProps) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <button
          type="button"
          className={styles.header}
          aria-expanded={open}
          aria-controls={`tray-${id}`}
          onClick={onToggle}
        >
          {icon}
          <span>{title}</span>
        </button>
      </h3>
      <div
        id={`tray-${id}`}
        className={styles.accordion}
        data-open={open ? '' : undefined}
        inert={!open}
      >
        <div className={styles.accordionInner}>{children}</div>
      </div>
    </section>
  );
}

interface TrayPersonButtonProps {
  person: TrayPerson;
  count: number;
  selected: boolean;
  disabled: boolean;
  draggable: boolean;
  onToggle: () => void;
}

/** Someone in the tray: a click adds or removes them, dragging places them on the stage. */
function TrayPersonButton({
  person,
  count,
  selected,
  disabled,
  draggable,
  onToggle,
}: TrayPersonButtonProps) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `tray:${person.id}`,
    disabled: !draggable,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={styles.person}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
    >
      <PersonChip
        name={person.name}
        color={person.mainColor}
        highlighted={selected}
        secondary={person.status === 'maybe'}
      />
      <span className={styles.count}>
        {count} {count === 1 ? 'pieza' : 'piezas'}
      </span>
    </button>
  );
}

/** Drop zone: people dragged back here leave the stage but stay in the piece. */
function TrayDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: 'tray' });
  return (
    <aside ref={setNodeRef} className={styles.root} aria-label="Bandeja">
      {children}
    </aside>
  );
}

/** Toolbar next to the repertoire: people now; props, equipment… can join as more blocks. */
export function PeopleTray({
  people,
  pieceTitle,
  selected,
  counts,
  onToggle,
  draggable = false,
}: PeopleTrayProps) {
  const [open, setOpen] = useState({ people: true, objects: false });
  const toggle = (key: keyof typeof open) =>
    setOpen((current) => ({ ...current, [key]: !current[key] }));

  return (
    <TrayDropZone>
      <Section
        id="people"
        icon={<PeopleIcon />}
        title="Personas"
        open={open.people}
        onToggle={() => toggle('people')}
      >
        <p className={styles.hint}>
          {!pieceTitle
            ? 'Abre una pieza para elegir quién sale.'
            : draggable
              ? `Pulsa para meter o sacar a alguien de «${pieceTitle}», o arrástralo al escenario para colocarlo.`
              : `Pulsa para meter o sacar a alguien de «${pieceTitle}».`}
        </p>
        {people.length ? (
          <ul className={styles.people}>
            {people.map((person) => (
              <li key={person.id}>
                <TrayPersonButton
                  person={person}
                  count={counts.get(person.id) ?? 0}
                  selected={selected.has(person.id)}
                  disabled={!pieceTitle}
                  draggable={draggable && Boolean(pieceTitle)}
                  onToggle={() => onToggle(person)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>Nadie convocado todavía.</p>
        )}
      </Section>
      <Section
        id="objects"
        icon={<BoxIcon />}
        title="Objetos e infraestructura"
        open={open.objects}
        onToggle={() => toggle('objects')}
      >
        <p className={styles.hint}>Llegará más adelante: atrezo, instrumentos, equipo…</p>
      </Section>
    </TrayDropZone>
  );
}

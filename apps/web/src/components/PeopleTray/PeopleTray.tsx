import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronDown, LayoutGrid, Package, Shapes, Users } from 'lucide-react';
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
  /** The figures palette (step 2.2); without it, the block only says what is coming. */
  palette?: ReactNode;
  /** The spaces palette (step 2.3), like the figures one. */
  spaces?: ReactNode;
}

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
          {/* Turns over when the block opens or closes. */}
          <ChevronDown
            className={styles.chevron}
            data-open={open ? '' : undefined}
            aria-hidden="true"
          />
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

/** Toolbar next to the repertoire: spaces, figures, people, and props or equipment later. */
export function PeopleTray({
  people,
  pieceTitle,
  selected,
  counts,
  onToggle,
  draggable = false,
  palette,
  spaces,
}: PeopleTrayProps) {
  const [open, setOpen] = useState({
    spaces: true,
    figures: true,
    people: true,
    objects: false,
  });
  const toggle = (key: keyof typeof open) =>
    setOpen((current) => ({ ...current, [key]: !current[key] }));

  return (
    <TrayDropZone>
      <Section
        id="spaces"
        icon={<LayoutGrid size={20} aria-hidden="true" />}
        title="Espacios"
        open={open.spaces}
        onToggle={() => toggle('spaces')}
      >
        {spaces ?? (
          <p className={styles.hint}>Entra en una pieza para colocar espacios en el escenario.</p>
        )}
      </Section>
      <Section
        id="figures"
        icon={<Shapes size={20} aria-hidden="true" />}
        title="Figuras"
        open={open.figures}
        onToggle={() => toggle('figures')}
      >
        {palette ?? (
          <p className={styles.hint}>Entra en una pieza para colocar figuras en el escenario.</p>
        )}
      </Section>
      <Section
        id="people"
        icon={<Users size={20} aria-hidden="true" />}
        title="Personas"
        open={open.people}
        onToggle={() => toggle('people')}
      >
        {/* How to use it will live in a help button (a guided tour), not here. */}
        {!pieceTitle && <p className={styles.hint}>Entra en una pieza para elegir quién sale.</p>}
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
        icon={<Package size={20} aria-hidden="true" />}
        title="Objetos e infraestructura"
        open={open.objects}
        onToggle={() => toggle('objects')}
      >
        <p className={styles.hint}>Llegará más adelante: atrezo, instrumentos, equipo…</p>
      </Section>
    </TrayDropZone>
  );
}

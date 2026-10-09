import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  ChevronDown,
  LayoutGrid,
  Package,
  PanelRightClose,
  PanelRightOpen,
  Shapes,
  Users,
} from 'lucide-react';
import type { CallUpStatus, Person } from '@cuadrocorrocalle/shared';
import { type ReactNode, useEffect, useState } from 'react';

import { PersonChip } from '../ui/PersonChip/PersonChip';
import styles from './PeopleTray.module.scss';

export type TrayPerson = Person & { status: CallUpStatus };

interface PeopleTrayProps {
  people: TrayPerson[];
  /** Title of the open piece; without one, nobody can be picked. */
  pieceTitle: string | null;
  /** The open piece is spoken (a voice-over or a talk): it has no stage. */
  spokenOpen?: boolean;
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
  /** Always a strip of icons, with no button to unfold it (e.g. a laptop or a tablet). */
  alwaysFolded?: boolean;
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
function TrayDropZone({ children, collapsed }: { children: ReactNode; collapsed: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'tray' });
  return (
    <aside
      ref={setNodeRef}
      className={styles.root}
      data-tray=""
      data-tray-collapsed={collapsed ? '' : undefined}
      aria-label="Bandeja"
    >
      {children}
    </aside>
  );
}

// Where whether the tray is folded is remembered, on this device.
const COLLAPSED_KEY = 'ccc.trayCollapsed';
const readCollapsed = () => {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};
const saveCollapsed = (collapsed: boolean) => {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Without storage it just opens unfolded next time.
  }
};

type SectionKey = 'spaces' | 'figures' | 'people' | 'objects';

/** Toolbar next to the repertoire: spaces, figures, people, and props or equipment later. */
export function PeopleTray({
  people,
  pieceTitle,
  spokenOpen = false,
  selected,
  counts,
  onToggle,
  draggable = false,
  palette,
  spaces,
  alwaysFolded = false,
}: PeopleTrayProps) {
  const [open, setOpen] = useState({
    spaces: true,
    figures: true,
    people: true,
    objects: false,
  });
  const toggle = (key: SectionKey) => setOpen((current) => ({ ...current, [key]: !current[key] }));
  // Folded into a strip of icons; a click on one shows just that block, floating beside it.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [floating, setFloating] = useState<{
    key: SectionKey;
    top: number;
    left: number;
    /** As low as the strip of icons reaches, so its end is always in view. */
    bottom: number;
  } | null>(null);
  const fold = (next: boolean) => {
    setCollapsed(next);
    setFloating(null);
    saveCollapsed(next);
  };
  // The floating block goes on a click elsewhere (not while dragging from it) or with Esc.
  useEffect(() => {
    if (!floating) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-tray-floating], [data-tray-rail]')) return;
      // Placing something just picked from it: it stays until the next click.
      if (target?.closest('[data-figure-handle], [data-figure-block]')) return;
      setFloating(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [floating]);

  // Why nothing can be placed: no piece entered, or a spoken one.
  const enter = (what: string) =>
    spokenOpen ? 'Las piezas habladas no tienen escenario.' : `Entra en una pieza para ${what}.`;
  const sections: { key: SectionKey; icon: ReactNode; title: string; content: ReactNode }[] = [
    {
      key: 'spaces',
      icon: <LayoutGrid size={20} aria-hidden="true" />,
      title: 'Espacios',
      content: spaces ?? <p className={styles.hint}>{enter('colocar espacios en el escenario')}</p>,
    },
    {
      key: 'figures',
      icon: <Shapes size={20} aria-hidden="true" />,
      title: 'Figuras',
      content: palette ?? <p className={styles.hint}>{enter('colocar figuras en el escenario')}</p>,
    },
    {
      key: 'people',
      icon: <Users size={20} aria-hidden="true" />,
      title: 'Personas',
      content: peopleBlock(),
    },
    {
      key: 'objects',
      icon: <Package size={20} aria-hidden="true" />,
      title: 'Objetos e infraestructura',
      content: <p className={styles.hint}>Llegará más adelante: atrezo, instrumentos, equipo…</p>,
    },
  ];

  if (collapsed || alwaysFolded) {
    const shown = sections.find((section) => section.key === floating?.key);
    return (
      <TrayDropZone collapsed>
        <div className={styles.rail} data-tray-rail="">
          {sections.map(({ key, icon, title }) => (
            <button
              key={key}
              type="button"
              className={styles.railButton}
              aria-label={title}
              aria-expanded={floating?.key === key}
              title={title}
              onClick={(event) => {
                if (floating?.key === key) return setFloating(null);
                const box = event.currentTarget.getBoundingClientRect();
                const strip = event.currentTarget.closest('[data-tray]')?.getBoundingClientRect();
                setFloating({
                  key,
                  top: box.top,
                  left: box.right + 8,
                  bottom: strip?.bottom ?? window.innerHeight - 16,
                });
              }}
            >
              {icon}
            </button>
          ))}
          {!alwaysFolded && (
            <button
              type="button"
              className={styles.railButton}
              data-fold=""
              aria-label="Mostrar la bandeja"
              title="Mostrar la bandeja"
              onClick={() => fold(false)}
            >
              <PanelRightOpen size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        {shown && floating && (
          <section
            className={styles.floating}
            data-tray-floating=""
            aria-label={shown.title}
            style={{
              top: floating.top,
              left: floating.left,
              maxHeight: floating.bottom - floating.top,
            }}
          >
            <h3 className={styles.floatingTitle}>
              {shown.icon}
              <span>{shown.title}</span>
            </h3>
            <div className={styles.floatingBody}>{shown.content}</div>
          </section>
        )}
      </TrayDropZone>
    );
  }

  return (
    <TrayDropZone collapsed={false}>
      <div className={styles.scroll}>
        {sections.map(({ key, icon, title, content }) => (
          <Section
            key={key}
            id={key}
            icon={icon}
            title={title}
            open={open[key]}
            onToggle={() => toggle(key)}
          >
            {content}
          </Section>
        ))}
      </div>
      <button
        type="button"
        className={styles.foldButton}
        aria-label="Ocultar la bandeja"
        title="Ocultar la bandeja"
        onClick={() => fold(true)}
      >
        <PanelRightClose size={18} aria-hidden="true" />
        Ocultar
      </button>
    </TrayDropZone>
  );

  /** Who is called up, to add to the open piece or drag onto its stage. */
  function peopleBlock() {
    return (
      <>
        {/* How to use it will live in a help button (a guided tour), not here. */}
        {!pieceTitle && <p className={styles.hint}>{enter('elegir quién sale')}</p>}
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
      </>
    );
  }
}

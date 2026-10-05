import {
  closestCenter,
  DndContext,
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DropAnimation,
  DragOverlay,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  type AnimateLayoutChanges,
  arrayMove,
  defaultAnimateLayoutChanges,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PIECE_TYPE_LABELS, type PieceType } from '@cuadrocorrocalle/shared';
import { type ReactNode, useMemo, useState } from 'react';

import { formatClock } from '../../pieces/clock';
import { draftError, emptyDraft, type PieceDraft } from '../../pieces/draft';
import { summarize } from '../../pieces/summary';
import { cleanText } from '../../performances/sanitize';
import type { TrayPerson } from '../PeopleTray/PeopleTray';
import { Button } from '../ui/Button/Button';
import { Select } from '../ui/Select/Select';
import { TextField } from '../ui/TextField/TextField';
import styles from './RepertoireSection.module.scss';

const TYPE_OPTIONS = Object.entries(PIECE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// Every move while sorting and after dropping is animated, at the same pace.
const SLIDE = { duration: 200, easing: 'ease' };
// The piece stays hidden in the list until the copy has landed on it.
const DROP: DropAnimation = {
  ...SLIDE,
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0' } } }),
};
// While sorting, dnd-kit moves the pieces itself; animating every other layout change too made
// them flicker, so besides that only the change right after a drop is animated.
const animateAlways: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

const cleanClock = (value: string) => value.replace(/[^\d:.,]/g, '').slice(0, 5);

interface RepertoireSectionProps {
  pieces: PieceDraft[];
  onChange: (pieces: PieceDraft[]) => void;
  /** Most pieces allowed, as in the "Grupo de Prueba". */
  limit?: number;
  /** Called-up people; when given, each piece shows how many take part in it. */
  people?: TrayPerson[];
  /** Open piece, when someone else (e.g. the people tray) needs to know it. */
  openKey?: string | null;
  onOpenKeyChange?: (key: string | null) => void;
}

interface PieceRowProps {
  draft: PieceDraft;
  /** Shown before the title: 1, 2… in the repertoire, B1, B2… among the encores. */
  label: string;
  open: boolean;
  onToggle: () => void;
  onChange: (draft: PieceDraft) => void;
  onRemove: () => void;
  people?: Map<string, TrayPerson>;
}

/** One piece: a summary row that can be dragged, opening into its fields. */
function PieceRow({ draft, label, open, onToggle, onChange, onRemove, people }: PieceRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: draft.key, transition: SLIDE, animateLayoutChanges: animateAlways });
  const error = draftError(draft);
  const set = (changes: Partial<PieceDraft>) => onChange({ ...draft, ...changes });

  return (
    <li
      ref={setNodeRef}
      className={styles.piece}
      data-dragging={isDragging ? '' : undefined}
      data-invalid={error && !open ? '' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <div className={styles.row}>
        <button
          ref={setActivatorNodeRef}
          type="button"
          className={styles.handle}
          aria-label={`Mover «${draft.title || 'pieza sin título'}»`}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className={styles.number}>{label}</span>
        {/* Open, the title itself is the field, like the name of a document. */}
        {open && (
          <input
            className={styles.nameInput}
            aria-label="Título de la pieza"
            aria-invalid={!draft.title.trim()}
            aria-describedby={draft.title.trim() ? undefined : `${draft.key}-title-error`}
            required
            maxLength={120}
            placeholder="Ponle un título"
            autoFocus={!draft.title}
            value={draft.title}
            onChange={(event) => set({ title: cleanText(event.target.value) })}
          />
        )}
        <button
          type="button"
          className={styles.summary}
          aria-expanded={open}
          aria-controls={`${draft.key}-fields`}
          aria-label={open ? `Cerrar «${draft.title.trim() || 'Sin título'}»` : undefined}
          onClick={onToggle}
        >
          {!open && <span className={styles.name}>{draft.title.trim() || 'Sin título'}</span>}
          <span className={styles.meta}>
            <span className={styles.type} data-type={draft.type}>
              {PIECE_TYPE_LABELS[draft.type]}
            </span>
            {draft.optional && <span className={styles.optional}>Opcional</span>}
            {people && (
              <span className={styles.peopleCount}>
                {draft.participants.length}{' '}
                {draft.participants.length === 1 ? 'persona' : 'personas'}
              </span>
            )}
            <span className={styles.duration}>{draft.duration || '—'}</span>
          </span>
        </button>
      </div>
      {open && (
        <div id={`${draft.key}-fields`} className={styles.fields}>
          {!draft.title.trim() && (
            <p id={`${draft.key}-title-error`} className={styles.titleError}>
              Ponle un título
            </p>
          )}
          <div className={styles.pair}>
            <Select
              label="Tipo"
              options={TYPE_OPTIONS}
              value={draft.type}
              onValueChange={(type) => set({ type: type as PieceType })}
            />
            <TextField
              label="Duración"
              inputMode="decimal"
              autoComplete="off"
              placeholder="3:30"
              value={draft.duration}
              onChange={(event) => set({ duration: cleanClock(event.target.value) })}
              hint="Minutos:segundos"
              error={error && draft.title.trim() ? error : undefined}
            />
          </div>
          <TextField
            label="Estructura (opcional)"
            maxLength={300}
            placeholder="Entrada, 3 coplas con estribillo, salida"
            value={draft.structure}
            onChange={(event) => set({ structure: cleanText(event.target.value) })}
          />
          <div className={styles.footer}>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={draft.optional}
                onChange={(event) => set({ optional: event.target.checked })}
              />
              Opcional (se hace si sobra tiempo)
            </label>
            <div className={styles.buttons}>
              {/* The same as dragging it to the other list. */}
              <Button variant="ghost" onClick={() => set({ encore: !draft.encore })}>
                {draft.encore ? 'Pasar al repertorio' : 'Pasar a bis'}
              </Button>
              <Button variant="danger" onClick={onRemove}>
                Quitar
              </Button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

type ListId = 'main' | 'encore';

interface PieceListProps {
  id: ListId;
  pieces: PieceDraft[];
  /** A piece from the other list is being dragged here. */
  highlighted: boolean;
  /** Whether the list itself takes drops; the encores take them on their whole block. */
  droppable?: boolean;
  children: ReactNode;
}

/** One of the two lists; it also takes drops while empty. */
function PieceList({ id, pieces, highlighted, droppable = true, children }: PieceListProps) {
  // Only an empty list takes drops itself; otherwise its pieces do, or the pointer would flicker
  // between the list and the piece under it and the pieces would jump back and forth.
  const { setNodeRef } = useDroppable({ id, disabled: !droppable || pieces.length > 0 });
  return (
    <SortableContext
      items={pieces.map((piece) => piece.key)}
      strategy={verticalListSortingStrategy}
    >
      <ol
        ref={droppable ? setNodeRef : undefined}
        className={styles.list}
        data-empty={pieces.length ? undefined : ''}
        data-over={highlighted ? '' : undefined}
        aria-label={id === 'encore' ? 'Bis' : 'Repertorio'}
      >
        {children}
      </ol>
    </SortableContext>
  );
}

/**
 * The repertoire of a performance: pieces in order and, apart, the encores ("bis") kept ready in
 * case the audience asks for more. Pieces are dragged within and between both lists.
 */
export function RepertoireSection({
  pieces,
  onChange,
  limit,
  people,
  openKey: controlledKey,
  onOpenKeyChange,
}: RepertoireSectionProps) {
  const [ownKey, setOwnKey] = useState<string | null>(null);
  // List a piece is being dragged into, to highlight it.
  const [targetList, setTargetList] = useState<ListId | null>(null);
  // Piece being dragged, drawn under the pointer; it glides into its new place on dropping.
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = pieces.find((piece) => piece.key === activeKey) ?? null;
  const openKey = controlledKey !== undefined ? controlledKey : ownKey;
  const setOpenKey = onOpenKeyChange ?? setOwnKey;
  const peopleById = useMemo(
    () => (people ? new Map(people.map((person) => [person.id, person])) : undefined),
    [people],
  );
  const updatePiece = (next: PieceDraft) =>
    onChange(pieces.map((piece) => (piece.key === next.key ? next : piece)));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const full = limit !== undefined && pieces.length >= limit;
  // At the limit, the add buttons say so instead, in red, and stay blocked.
  const limitText = `El Grupo de Prueba admite hasta ${limit} piezas`;
  const main = pieces.filter((piece) => !piece.encore);
  const encores = pieces.filter((piece) => piece.encore);
  // Encores are timed apart; the time available does not matter here.
  const summary = summarize(pieces, null, null);

  const listOf = (id: string | number): ListId | null => {
    if (id === 'main' || id === 'encore') return id;
    const piece = pieces.find((item) => item.key === id);
    return piece ? (piece.encore ? 'encore' : 'main') : null;
  };

  const add = (encore: boolean) => {
    const draft = { ...emptyDraft(), encore };
    onChange([...pieces, draft]);
    setOpenKey(draft.key);
  };

  // While dragging into the other list it is only highlighted; the piece moves on dropping.
  const highlight = ({ active, over }: DragOverEvent) => {
    const to = over ? listOf(over.id) : null;
    setTargetList(to && to !== listOf(active.id) ? to : null);
  };

  const drop = ({ active, over }: DragEndEvent) => {
    setTargetList(null);
    setActiveKey(null);
    if (!over || active.id === over.id) return;
    const from = listOf(active.id);
    const to = listOf(over.id);
    if (!from || !to) return;
    if (from === to) {
      const start = pieces.findIndex((piece) => piece.key === active.id);
      const end = pieces.findIndex((piece) => piece.key === over.id);
      if (start >= 0 && end >= 0) onChange(arrayMove(pieces, start, end));
      return;
    }
    // Into the other list, before the piece it was dropped on, or at its end.
    const moving = pieces.find((piece) => piece.key === active.id);
    if (!moving) return;
    const rest = pieces.filter((piece) => piece.key !== active.id);
    const at = rest.findIndex((piece) => piece.key === over.id);
    const moved = { ...moving, encore: to === 'encore' };
    onChange(at < 0 ? [...rest, moved] : [...rest.slice(0, at), moved, ...rest.slice(at)]);
  };

  const row = (draft: PieceDraft, label: string) => (
    <PieceRow
      key={draft.key}
      draft={draft}
      label={label}
      open={openKey === draft.key}
      onToggle={() => setOpenKey(openKey === draft.key ? null : draft.key)}
      onChange={updatePiece}
      people={peopleById}
      onRemove={() => onChange(pieces.filter((piece) => piece.key !== draft.key))}
    />
  );

  return (
    <div className={styles.root}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active: dragged }: DragStartEvent) => setActiveKey(String(dragged.id))}
        onDragOver={highlight}
        onDragEnd={drop}
        onDragCancel={() => {
          setTargetList(null);
          setActiveKey(null);
        }}
      >
        <PieceList id="main" pieces={main} highlighted={targetList === 'main'}>
          {main.length === 0 && <li className={styles.emptyList}>Sin piezas todavía</li>}
          {main.map((draft, index) => row(draft, String(index + 1)))}
        </PieceList>
        <div className={styles.add}>
          <Button className={styles.addButton} onClick={() => add(false)} disabled={full}>
            {full ? limitText : '+ Añadir pieza'}
          </Button>
        </div>

        <EncoreSection
          count={encores.length}
          seconds={summary.encore}
          highlighted={targetList === 'encore'}
        >
          <PieceList id="encore" pieces={encores} highlighted={false} droppable={false}>
            {encores.map((draft, index) => row(draft, `B${index + 1}`))}
          </PieceList>
          <div className={styles.add}>
            <Button className={styles.addButton} onClick={() => add(true)} disabled={full}>
              {full ? limitText : '+ Añadir bis'}
            </Button>
          </div>
        </EncoreSection>

        {/* On dropping, the copy glides to where the piece ends up, also into the other list. */}
        <DragOverlay dropAnimation={DROP}>
          {active && (
            <div className={styles.dragPreview}>
              <span className={styles.handle} aria-hidden="true">
                ⠿
              </span>
              <span className={styles.name}>{active.title.trim() || 'Sin título'}</span>
              <span className={styles.type} data-type={active.type}>
                {PIECE_TYPE_LABELS[active.type]}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface EncoreSectionProps {
  count: number;
  seconds: number;
  highlighted: boolean;
  children: ReactNode;
}

/**
 * "Bis": collapsible block, closed whenever the screen opens again. It takes drops even while
 * closed, so a piece can be dragged onto its title.
 */
function EncoreSection({ count, seconds, highlighted, children }: EncoreSectionProps) {
  const [open, setOpen] = useState(false);
  const { setNodeRef } = useDroppable({ id: 'encore' });

  return (
    <section
      ref={setNodeRef}
      className={styles.encores}
      data-over={highlighted ? '' : undefined}
      aria-labelledby="encores-title"
    >
      <h3 id="encores-title" className={styles.encoresTitle}>
        <button
          type="button"
          className={styles.encoresToggle}
          aria-expanded={open}
          aria-controls="encores-body"
          onClick={() => setOpen(!open)}
        >
          Bis ({count})
          {seconds > 0 && <span className={styles.encoresTime}>{formatClock(seconds)}</span>}
        </button>
      </h3>
      {/* Only while a piece is dragged over the block: where it will land, growing into view. */}
      <div className={styles.dropZone} data-open={highlighted ? '' : undefined} aria-hidden="true">
        <div className={styles.dropZoneInner}>
          <span>Suelta aquí una pieza</span>
        </div>
      </div>
      <div
        id="encores-body"
        className={styles.accordion}
        data-open={open ? '' : undefined}
        inert={!open}
      >
        <div className={styles.accordionInner}>{children}</div>
      </div>
    </section>
  );
}

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
import { ChevronDown, GripVertical } from 'lucide-react';
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
import {
  isSpoken,
  SPOKEN_TAGS,
  MAX_INSTRUMENTS,
  PIECE_TYPE_LABELS,
  type PieceType,
} from '@cuadrocorrocalle/shared';
import { type ReactNode, useMemo, useState } from 'react';

import { formatClock } from '../../pieces/clock';
import { draftError, emptyDraft, type PieceDraft, pieceNumbers } from '../../pieces/draft';
import { STARTER_INSTRUMENTS } from '../../pieces/instruments';
import {
  missingPlaces,
  repeatedPeople,
  repeatedText,
  undecidedPlaces,
  undecidedText,
} from '../../stage/pieceFigures';
import { summarize } from '../../pieces/summary';
import { cleanText } from '../../performances/sanitize';
import type { TrayPerson } from '../PeopleTray/PeopleTray';
import { Button } from '../ui/Button/Button';
import { Select } from '../ui/Select/Select';
import { TagField } from '../ui/TagField/TagField';
import { TextArea } from '../ui/TextArea/TextArea';
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
  /** Piece entered (selected), when someone else (e.g. the stage and the tray) needs to know it. */
  openKey?: string | null;
  onOpenKeyChange?: (key: string | null) => void;
  /** The group's instruments, offered in each piece; a new one can be added to them. */
  groupInstruments?: string[];
  onAddToGroup?: (instruments: string[]) => void;
}

interface PieceRowProps {
  draft: PieceDraft;
  /** Shown before the title: 1, 2… in the repertoire, B1, B2… among the encores; none if spoken. */
  label: string | null;
  /** Entered: its stage is the one shown; highlighted. */
  selected: boolean;
  /** Its fields are showing. */
  open: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onChange: (draft: PieceDraft) => void;
  onRemove: () => void;
  people?: Map<string, TrayPerson>;
  /** Instruments offered while typing: the group's (or a starter list) and the other pieces'. */
  instruments?: string[];
  /** The group's list; an instrument typed that is not in it can be added to it. */
  groupInstruments?: string[];
  onAddToGroup?: (instruments: string[]) => void;
}

/** One piece: a summary row that can be dragged and entered; its chevron opens its fields. */
function PieceRow({
  draft,
  label,
  selected,
  open,
  onSelect,
  onToggle,
  onChange,
  onRemove,
  people,
  instruments = [],
  groupInstruments,
  onAddToGroup,
}: PieceRowProps) {
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
  // Figures with nobody in some of their places (step 2.2).
  const missing = missingPlaces(draft);
  const repeated = repeatedPeople(draft).size;
  const undecided = undecidedPlaces(draft);
  const set = (changes: Partial<PieceDraft>) => onChange({ ...draft, ...changes });
  // Voice-overs and talks: no stage, so no people, figures or instruments.
  const spoken = isSpoken(draft.type);
  const onStage = draft.participants.length + draft.figures.length + draft.instruments.length > 0;

  return (
    <li
      ref={setNodeRef}
      className={styles.piece}
      data-spoken={spoken ? '' : undefined}
      data-dragging={isDragging ? '' : undefined}
      data-selected={selected ? '' : undefined}
      data-invalid={error && !open ? '' : undefined}
      data-incomplete={missing ? '' : undefined}
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
          <GripVertical size={18} aria-hidden="true" />
        </button>
        {/* A spoken piece says what it is there instead: «(en off)», «(micro)». */}
        {spoken ? (
          <span className={styles.spokenTag}>({SPOKEN_TAGS[draft.type]})</span>
        ) : (
          <span className={styles.number}>{label}</span>
        )}
        {/* Title on top and its details below; open, the title itself is the field. */}
        <div className={styles.main}>
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
            aria-current={selected ? 'true' : undefined}
            aria-label={
              spoken
                ? `${open ? 'Ocultar' : 'Mostrar'} los datos de «${draft.title.trim() || 'Sin título'}»`
                : open
                  ? `Entrar en «${draft.title.trim() || 'Sin título'}»`
                  : undefined
            }
            onClick={onSelect}
          >
            {!open && <span className={styles.name}>{draft.title.trim() || 'Sin título'}</span>}
            {/* Only its title, on one line; its duration beside it. */}
            {spoken && !open && draft.duration && (
              <span className={styles.duration}>{draft.duration}</span>
            )}
            {!spoken && (
              <span className={styles.meta}>
                <span className={styles.type} data-type={draft.type}>
                  {PIECE_TYPE_LABELS[draft.type]}
                </span>
                {draft.optional && <span className={styles.optional}>Opcional</span>}
                {people && !spoken && (
                  <span className={styles.peopleCount}>
                    {draft.participants.length}{' '}
                    {draft.participants.length === 1 ? 'persona' : 'personas'}
                  </span>
                )}
                {repeated > 0 && <span className={styles.repeated}>{repeatedText(repeated)}</span>}
                {undecided > 0 && (
                  <span className={styles.missingPlaces}>{undecidedText(undecided)}</span>
                )}
                {missing > 0 && (
                  <span className={styles.missingPlaces}>
                    {missing} {missing === 1 ? 'hueco vacío' : 'huecos vacíos'}
                  </span>
                )}
                {draft.duration && <span className={styles.duration}>{draft.duration}</span>}
              </span>
            )}
          </button>
        </div>
        {/* Its own strip at the right: opens and closes the fields, turning over. */}
        <button
          type="button"
          className={styles.expand}
          aria-expanded={open}
          aria-controls={`${draft.key}-fields`}
          aria-label={`${open ? 'Ocultar' : 'Mostrar'} los datos de «${draft.title.trim() || 'Sin título'}»`}
          onClick={onToggle}
        >
          <ChevronDown
            className={styles.chevron}
            data-open={open ? '' : undefined}
            aria-hidden="true"
          />
        </button>
      </div>
      {/* Always there, so it can slide open and shut like an accordion. */}
      <div
        id={`${draft.key}-fields`}
        className={styles.accordion}
        data-open={open ? '' : undefined}
        inert={!open}
      >
        <div className={styles.pieceAccordionInner}>
          <div className={styles.fields}>
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
                aria-description="Minutos y segundos"
                value={draft.duration}
                onChange={(event) => set({ duration: cleanClock(event.target.value) })}
                error={error && draft.title.trim() ? error : undefined}
              />
            </div>
            {spoken && onStage && (
              <p className={styles.newInstruments}>
                Las piezas habladas no tienen escenario: al guardar se quitan sus personas, figuras
                e instrumentos.
              </p>
            )}
            {!spoken && (
              <TagField
                label="Instrumentos"
                values={draft.instruments}
                onChange={(values) => set({ instruments: values })}
                placeholder="Dulzaina, redoblante, castañuelas, canto…"
                hint="Cada uno tiene su sitio en la zona de músicos. Añádelo con Enter o una coma; «2 dulzainas» o «Dulzaina x2» añade dos, y − y + cambian cuántos."
                suggestions={instruments}
                suggestionsTitle="Ejemplos: elige uno o escribe el tuyo"
                counted
                max={MAX_INSTRUMENTS}
              />
            )}
            {!spoken &&
              groupInstruments &&
              onAddToGroup &&
              (() => {
                // New here: offer to keep it in the group's list for next time.
                const known = new Set(groupInstruments.map((name) => name.toLocaleLowerCase('es')));
                const fresh = [...new Set(draft.instruments)].filter(
                  (name) => !known.has(name.toLocaleLowerCase('es')),
                );
                return fresh.length ? (
                  <p className={styles.newInstruments}>
                    {fresh.length === 1
                      ? `«${fresh[0]}» no está en los instrumentos de Mi grupo.`
                      : `${fresh.map((name) => `«${name}»`).join(', ')} no están en los instrumentos de Mi grupo.`}{' '}
                    <Button variant="ghost" onClick={() => onAddToGroup(fresh)}>
                      Añadir a Mi grupo
                    </Button>
                  </p>
                ) : null;
              })()}
            {spoken ? (
              <TextArea
                label="Anotaciones (opcional)"
                maxLength={1000}
                rows={3}
                placeholder="Quién habla, qué se dice o qué suena"
                value={draft.structure}
                onChange={(event) => set({ structure: event.target.value })}
              />
            ) : (
              <TextField
                label="Estructura (opcional)"
                maxLength={1000}
                placeholder="Entrada, 3 coplas con estribillo, salida"
                value={draft.structure}
                onChange={(event) => set({ structure: cleanText(event.target.value) })}
              />
            )}
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
        </div>
      </div>
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
  groupInstruments,
  onAddToGroup,
}: RepertoireSectionProps) {
  const [ownKey, setOwnKey] = useState<string | null>(null);
  // The piece showing its fields: only one at a time, opening another closes it.
  const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(new Set());
  const toggleOpen = (key: string) =>
    setOpenKeys((keys) => (keys.has(key) ? new Set() : new Set([key])));
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
  // The group's instruments (a starter list until it has its own), and any the pieces use.
  const instrumentSuggestions = [
    ...new Set([
      ...(groupInstruments?.length ? groupInstruments : STARTER_INSTRUMENTS),
      ...pieces.flatMap((piece) => piece.instruments),
    ]),
  ];
  const updatePiece = (next: PieceDraft) => {
    // A piece turned spoken has no stage, so it is no longer the one entered.
    if (isSpoken(next.type) && openKey === next.key) setOpenKey(null);
    onChange(pieces.map((piece) => (piece.key === next.key ? next : piece)));
  };
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
    // A new piece is entered and open, to give it a title.
    setOpenKey(draft.key);
    setOpenKeys(new Set([draft.key]));
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

  const numbers = pieceNumbers(pieces);
  const row = (draft: PieceDraft) => (
    <PieceRow
      key={draft.key}
      draft={draft}
      label={numbers.get(draft.key) ?? null}
      selected={openKey === draft.key}
      open={openKeys.has(draft.key)}
      // A voice-over or a talk has no stage to enter: its row only opens its notes.
      onSelect={() => (isSpoken(draft.type) ? toggleOpen(draft.key) : setOpenKey(draft.key))}
      onToggle={() => toggleOpen(draft.key)}
      onChange={updatePiece}
      people={peopleById}
      instruments={instrumentSuggestions}
      groupInstruments={groupInstruments}
      onAddToGroup={onAddToGroup}
      onRemove={() => {
        if (openKey === draft.key) setOpenKey(null);
        onChange(pieces.filter((piece) => piece.key !== draft.key));
      }}
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
          {main.map(row)}
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
            {encores.map(row)}
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
                <GripVertical size={18} />
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
          <ChevronDown
            className={styles.encoresChevron}
            data-open={open ? '' : undefined}
            aria-hidden="true"
          />
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

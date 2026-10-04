import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type Participant, PIECE_TYPE_LABELS, type PieceType } from '@cuadrocorrocalle/shared';
import { type ReactNode, useMemo, useState } from 'react';

import { formatClock } from '../../pieces/clock';
import { draftError, emptyDraft, type PieceDraft } from '../../pieces/draft';
import { summarize } from '../../pieces/summary';
import { formatDuration } from '../../performances/format';
import { cleanText } from '../../performances/sanitize';
import type { TrayPerson } from '../PeopleTray/PeopleTray';
import { RoleToggles } from '../PersonFields/PersonFields';
import { PersonChip } from '../ui/PersonChip/PersonChip';
import { Button } from '../ui/Button/Button';
import { Select } from '../ui/Select/Select';
import { TextField } from '../ui/TextField/TextField';
import styles from './RepertoireSection.module.scss';

const TYPE_OPTIONS = Object.entries(PIECE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const cleanClock = (value: string) => value.replace(/[^\d:.,]/g, '').slice(0, 5);

interface RepertoireSectionProps {
  pieces: PieceDraft[];
  onChange: (pieces: PieceDraft[]) => void;
  /** Most pieces allowed, as in the "Grupo de Prueba". */
  limit?: number;
  /** Called after "Guardar" closes a piece, e.g. to store the repertoire. */
  onSave?: () => void;
  /** Called-up people; when given, each piece lists who takes part in it. */
  people?: TrayPerson[];
  /** Open piece, when someone else (e.g. the people tray) needs to know it. */
  openKey?: string | null;
  onOpenKeyChange?: (key: string | null) => void;
  /** Time available for the performance, to compare the repertoire with. */
  minMinutes?: number | null;
  maxMinutes?: number | null;
}

interface PieceRowProps {
  draft: PieceDraft;
  /** Shown before the title: 1, 2… in the repertoire, B1, B2… among the encores. */
  label: string;
  open: boolean;
  onToggle: () => void;
  onChange: (draft: PieceDraft) => void;
  onRemove: () => void;
  onSave: () => void;
  people?: Map<string, TrayPerson>;
}

interface ParticipantsProps {
  participants: Participant[];
  people: Map<string, TrayPerson>;
  onChange: (participants: Participant[]) => void;
}

/** Who takes part in a piece and what each one does. */
function Participants({ participants, people, onChange }: ParticipantsProps) {
  const set = (personId: string, changes: Partial<Participant>) =>
    onChange(
      participants.map((participant) =>
        participant.personId === personId ? { ...participant, ...changes } : participant,
      ),
    );

  return (
    <div className={styles.participants}>
      <p className={styles.participantsTitle}>Quién sale ({participants.length})</p>
      {participants.length === 0 && (
        <p className={styles.hint}>Elige a las personas en la bandeja de personas.</p>
      )}
      <ul className={styles.participantList}>
        {participants.map((participant) => {
          const person = people.get(participant.personId);
          if (!person) return null;
          return (
            <li key={participant.personId} className={styles.participant}>
              <PersonChip name={person.name} color={person.mainColor} />
              <RoleToggles
                compact
                label={`Qué hace ${person.name}`}
                value={participant.roles}
                onChange={(roles) => set(participant.personId, { roles })}
              />
              <button
                type="button"
                className={styles.removePerson}
                aria-label={`Sacar a ${person.name} de la pieza`}
                onClick={() =>
                  onChange(participants.filter((item) => item.personId !== participant.personId))
                }
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** One piece: a summary row that can be dragged, opening into its fields. */
function PieceRow({
  draft,
  label,
  open,
  onToggle,
  onChange,
  onRemove,
  onSave,
  people,
}: PieceRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: draft.key });
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
        <button
          type="button"
          className={styles.summary}
          aria-expanded={open}
          aria-controls={`${draft.key}-fields`}
          onClick={onToggle}
        >
          <span className={styles.name}>{draft.title.trim() || 'Sin título'}</span>
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
          <TextField
            label="Título"
            requiredMark
            maxLength={120}
            autoFocus={!draft.title}
            value={draft.title}
            onChange={(event) => set({ title: cleanText(event.target.value) })}
            error={draft.title.trim() ? undefined : 'Ponle un título'}
          />
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
          {people && (
            <Participants
              participants={draft.participants}
              people={people}
              onChange={(participants) => set({ participants })}
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
              <Button variant="primary" onClick={onSave} disabled={Boolean(error)}>
                Guardar
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
  const { setNodeRef } = useDroppable({ id, disabled: !droppable });
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
  onSave,
  people,
  openKey: controlledKey,
  onOpenKeyChange,
  minMinutes = null,
  maxMinutes = null,
}: RepertoireSectionProps) {
  const [ownKey, setOwnKey] = useState<string | null>(null);
  // List a piece is being dragged into, to highlight it.
  const [targetList, setTargetList] = useState<ListId | null>(null);
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
  const main = pieces.filter((piece) => !piece.encore);
  const encores = pieces.filter((piece) => piece.encore);
  const summary = summarize(pieces, minMinutes, maxMinutes);

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
      onSave={() => {
        setOpenKey(null);
        onSave?.();
      }}
    />
  );

  return (
    <div className={styles.root}>
      <RepertoireSummaryView summary={summary} minMinutes={minMinutes} maxMinutes={maxMinutes} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={highlight}
        onDragEnd={drop}
        onDragCancel={() => setTargetList(null)}
      >
        <PieceList id="main" pieces={main} highlighted={targetList === 'main'}>
          {main.length === 0 && <li className={styles.emptyList}>Sin piezas todavía</li>}
          {main.map((draft, index) => row(draft, String(index + 1)))}
        </PieceList>
        <div className={styles.add}>
          <Button onClick={() => add(false)} disabled={full}>
            + Añadir pieza
          </Button>
          {full && (
            <span className={styles.limit}>El Grupo de Prueba admite hasta {limit} piezas</span>
          )}
        </div>

        <EncoreSection
          count={encores.length}
          seconds={summary.encore}
          highlighted={targetList === 'encore'}
        >
          <PieceList id="encore" pieces={encores} highlighted={false} droppable={false}>
            {encores.length === 0 && <li className={styles.emptyList}>Suelta aquí una pieza</li>}
            {encores.map((draft, index) => row(draft, `B${index + 1}`))}
          </PieceList>
          <div className={styles.add}>
            <Button onClick={() => add(true)} disabled={full}>
              + Añadir bis
            </Button>
          </div>
        </EncoreSection>
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
      <div
        id="encores-body"
        className={styles.accordion}
        data-open={open ? '' : undefined}
        inert={!open}
      >
        <div className={styles.accordionInner}>
          <p className={styles.hint}>
            Por si el público pide otra. No cuentan para el resumen; arrastra piezas aquí o desde
            aquí.
          </p>
          {children}
        </div>
      </div>
    </section>
  );
}

interface SummaryViewProps {
  summary: ReturnType<typeof summarize>;
  minMinutes: number | null;
  maxMinutes: number | null;
}

/** Repertoire time against the time available for the performance (step 1.12). */
function RepertoireSummaryView({ summary, minMinutes, maxMinutes }: SummaryViewProps) {
  const available = formatDuration(minMinutes, maxMinutes);
  const message = {
    over: `Te pasas de la duración máxima en ${formatClock(summary.required - (maxMinutes ?? 0) * 60)}.`,
    short: `Te faltan ${formatClock((minMinutes ?? 0) * 60 - summary.required - summary.optional)} para la duración mínima.`,
    ok: 'Cabe en el tiempo de la actuación.',
    unknown: 'Pon la duración mínima o máxima de la actuación para compararlo.',
  }[summary.status];

  // Without the time available, the note goes under the box, as a disclaimer.
  const unknown = summary.status === 'unknown';
  return (
    <div className={styles.summaryBlock} aria-live="polite">
      <div className={styles.overview} data-status={summary.status}>
        <dl className={styles.figures}>
          <div>
            <dt>Repertorio</dt>
            <dd>{formatClock(summary.required)}</dd>
          </div>
          {summary.optional > 0 && (
            <div>
              <dt>Opcionales</dt>
              <dd>+{formatClock(summary.optional)}</dd>
            </div>
          )}
          <div>
            <dt>Disponible</dt>
            <dd>{available ?? 'Sin indicar'}</dd>
          </div>
        </dl>
        {!unknown && <p className={styles.verdict}>{message}</p>}
        {summary.missingDurations > 0 && (
          <p className={styles.hint}>
            {summary.missingDurations === 1
              ? '1 pieza no tiene duración y no cuenta.'
              : `${summary.missingDurations} piezas no tienen duración y no cuentan.`}
          </p>
        )}
      </div>
      {unknown && <p className={styles.disclaimer}>{message}</p>}
    </div>
  );
}

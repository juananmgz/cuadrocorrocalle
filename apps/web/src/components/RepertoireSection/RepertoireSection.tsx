import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
import { PIECE_TYPE_LABELS, type PieceType } from '@cuadrocorrocalle/shared';
import { useState } from 'react';

import { formatClock } from '../../pieces/clock';
import { draftError, emptyDraft, type PieceDraft, totalSeconds } from '../../pieces/draft';
import { cleanText } from '../../performances/sanitize';
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
}

interface PieceRowProps {
  draft: PieceDraft;
  index: number;
  open: boolean;
  onToggle: () => void;
  onChange: (draft: PieceDraft) => void;
  onRemove: () => void;
  onSave: () => void;
}

/** One piece: a summary row that can be dragged, opening into its fields. */
function PieceRow({ draft, index, open, onToggle, onChange, onRemove, onSave }: PieceRowProps) {
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
        <span className={styles.number}>{index + 1}</span>
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

/** The repertoire of a performance: pieces in order, reordered by dragging. */
export function RepertoireSection({ pieces, onChange, limit, onSave }: RepertoireSectionProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const full = limit !== undefined && pieces.length >= limit;
  const seconds = totalSeconds(pieces);
  const optionalCount = pieces.filter((piece) => piece.optional).length;
  const totals = [
    `${pieces.length} ${pieces.length === 1 ? 'pieza' : 'piezas'}`,
    seconds ? `${formatClock(seconds)} en total` : 'sin duraciones',
    optionalCount && `${optionalCount} opcional${optionalCount === 1 ? '' : 'es'}`,
  ];

  const add = () => {
    const draft = emptyDraft();
    onChange([...pieces, draft]);
    setOpenKey(draft.key);
  };

  const drop = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = pieces.findIndex((piece) => piece.key === active.id);
    const to = pieces.findIndex((piece) => piece.key === over.id);
    onChange(arrayMove(pieces, from, to));
  };

  return (
    <div className={styles.root}>
      <p className={styles.totals} aria-live="polite">
        {pieces.length ? totals.filter(Boolean).join(' · ') : 'Sin piezas todavía'}
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drop}>
        <SortableContext
          items={pieces.map((piece) => piece.key)}
          strategy={verticalListSortingStrategy}
        >
          <ol className={styles.list}>
            {pieces.map((draft, index) => (
              <PieceRow
                key={draft.key}
                draft={draft}
                index={index}
                open={openKey === draft.key}
                onToggle={() => setOpenKey(openKey === draft.key ? null : draft.key)}
                onChange={(next) =>
                  onChange(pieces.map((piece) => (piece.key === next.key ? next : piece)))
                }
                onRemove={() => onChange(pieces.filter((piece) => piece.key !== draft.key))}
                onSave={() => {
                  setOpenKey(null);
                  onSave?.();
                }}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className={styles.add}>
        <Button onClick={add} disabled={full}>
          + Añadir pieza
        </Button>
        {full && (
          <span className={styles.limit}>El Grupo de Prueba admite hasta {limit} piezas</span>
        )}
      </div>
    </div>
  );
}

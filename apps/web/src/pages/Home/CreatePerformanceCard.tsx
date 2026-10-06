import {
  DEFAULT_SQUARE_SIZE,
  MAX_EDGE_DISTANCE,
  MAX_STAGE_DEPTH,
  MAX_STAGE_WIDTH,
  MIN_EDGE_DISTANCE,
  MIN_STAGE_DEPTH,
  MIN_STAGE_WIDTH,
  MAX_MUSIC_ROWS,
  MUSIC_ROW_DEPTH,
  type CallUpEntry,
  type MusicSide,
  type Performance,
} from '@cuadrocorrocalle/shared';
import { Pencil } from 'lucide-react';
import {
  type FormEvent,
  type InputEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import type { GridStage } from '../../components/GridBackground/GridBackground';
import type { StageSize } from '../../stage/placement';
import { Button } from '../../components/ui/Button/Button';
import { Dialog, DialogClose } from '../../components/ui/Dialog/Dialog';
import { RequiredMark } from '../../components/ui/RequiredMark/RequiredMark';
import { Select } from '../../components/ui/Select/Select';
import { TextField } from '../../components/ui/TextField/TextField';
import { useQueryClient } from '@tanstack/react-query';

import { callUpKey, saveCallUp } from '../../callUps/callUpApi';
import { formatDay, formatDuration } from '../../performances/format';
import { usePerformanceMutations } from '../../performances/performancesApi';
import { cleanDecimal, cleanInteger, cleanText } from '../../performances/sanitize';
import { CallUpSection } from './CallUpSection';
import styles from './CreatePerformanceCard.module.scss';

interface StageValues {
  width: string;
  depth: string;
  squareSize: string;
  edgeDistance: string;
  /** Where the musicians play ('' without a zone) and how many rows. */
  musicSide: MusicSide | '';
  musicRows: string;
}

const MUSIC_SIDE_OPTIONS = [
  { value: 'none', label: 'Sin zona de músicos' },
  { value: 'back', label: 'Atrás' },
  { value: 'left', label: 'A la izquierda' },
  { value: 'right', label: 'A la derecha' },
];

/** The rows of the musicians' zone, kept within their limits. */
const musicRowsOf = (value: string) =>
  Math.min(MAX_MUSIC_ROWS, Math.max(1, Math.round(toNumber(value) ?? 1)));

type Step = 'data' | 'stage' | 'callUp';

interface CreatePerformanceCardProps {
  groupId: string;
  /** The performance to edit; without it, a new one is created. */
  performance?: Performance;
  /** Its saved call-up, when editing. */
  initialCallUp?: CallUpEntry[];
  /** Title to start with when creating, e.g. from the guided start. */
  initialTitle?: string;
  onCancel: () => void;
  /** Called with the performance once created. */
  onCreated: (performance: Performance) => void;
  /** Editing saves as it changes; called with the performance after each save. */
  onSaved?: (performance: Performance) => void;
  /** Reports the stage to preview on the grid. */
  onStageChange: (stage: GridStage | null) => void;
  /** The same stage in metres, as shown, e.g. for the people placed on it. */
  onStageSizeChange?: (stage: StageSize | null) => void;
  /** Reports whether something required is still missing. */
  onMissingChange?: (missing: boolean) => void;
  handleRef?: Ref<PerformanceFormHandle>;
  /** Where to draw the title instead of on top of the form, e.g. over the editor's tabs. */
  titleSlot?: HTMLElement | null;
}

// Editing saves this long after the last change.
const AUTOSAVE_DELAY = 800;

const toNumber = (value: string) => {
  const number = Number(value.replace(',', '.'));
  return value.trim() && Number.isFinite(number) && number > 0 ? number : null;
};

const edgeOf = (value: string) => Math.max(MIN_EDGE_DISTANCE, toNumber(value) ?? 0);

/** Stage in metres, or null until both measures are valid. */
function toStageSize({
  width,
  depth,
  squareSize,
  edgeDistance,
  musicSide,
  musicRows,
}: StageValues): StageSize | null {
  const w = toNumber(width);
  const d = toNumber(depth);
  return w && d
    ? {
        width: w,
        depth: d,
        squareSize: toNumber(squareSize) ?? DEFAULT_SQUARE_SIZE,
        edgeDistance: edgeOf(edgeDistance),
        musicSide: musicSide || null,
        musicRows: musicRowsOf(musicRows),
      }
    : null;
}

/** Stage in grid squares, or null until both measures are valid. */
function toStage(values: StageValues): GridStage | null {
  const size = toStageSize(values);
  return size
    ? {
        cols: size.width / size.squareSize,
        rows: size.depth / size.squareSize,
        edge: size.edgeDistance / size.squareSize,
        music: size.musicSide
          ? {
              side: size.musicSide,
              deep: (size.edgeDistance + (size.musicRows ?? 1) * MUSIC_ROW_DEPTH) / size.squareSize,
            }
          : null,
      }
    : null;
}

const formatNumber = (value: string) => value.replace('.', ',');

/** Filters what is typed in an uncontrolled field. */
const filtered = (clean: (value: string) => string) => (event: InputEvent<HTMLInputElement>) => {
  const input = event.currentTarget;
  const value = clean(input.value);
  if (value !== input.value) input.value = value;
};
const minutesField = filtered((value) => cleanInteger(value, 4));
const textField = filtered(cleanText);

const DEFAULT_TITLE = 'Nueva actuación';

// Fields that Enter moves between; buttons, checkboxes and multi-line fields keep their own Enter.
const FIELDS = 'input:not([type=checkbox]):not([type=hidden]), [role=combobox], textarea';

/** Enter in a one-line field applies it and moves to the next field instead of submitting. */
function nextFieldOnEnter(event: KeyboardEvent<HTMLFormElement>) {
  const form = event.currentTarget;
  const target = event.target as HTMLElement;
  // Dialogs are portals: their events bubble here but they are not inside the form.
  if (event.key !== 'Enter' || !form.contains(target) || !(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.type === 'checkbox') return;
  event.preventDefault();
  const fields = [...form.querySelectorAll<HTMLElement>(FIELDS)].filter(
    (field) => !field.closest('[inert]') && !field.hasAttribute('disabled') && field.tabIndex >= 0,
  );
  const next = fields[fields.indexOf(target) + 1];
  if (next) next.focus();
  else target.blur();
}

/** Lets the editor try to create from outside, e.g. from the "Piezas" switch. */
export interface PerformanceFormHandle {
  /** Creates (or saves) if nothing required is missing; otherwise marks what is missing. */
  attempt: () => void;
}

/** Two yellow beats over an element that still needs filling in; a new key replays it. */
const Heartbeat = ({ beat }: { beat: number }) =>
  beat > 0 ? <span key={beat} className={styles.heartbeat} aria-hidden="true" /> : null;

interface StepPanelProps {
  id: Step;
  title: string;
  /** Replays the heartbeat when it changes; 0 shows nothing. */
  attention?: number;
  /** Marks the block with "(*)" when something in it must be filled in. */
  required?: boolean;
  summary: string;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
}

/** One block of the form; only one is open at a time, like an accordion. */
function StepPanel({
  id,
  title,
  attention = 0,
  required,
  summary,
  open,
  onOpen,
  children,
}: StepPanelProps) {
  return (
    // A closed block opens on a click anywhere on it; the title button keeps keyboard access.
    <section
      className={styles.root}
      aria-labelledby={`${id}-title`}
      data-closed={open ? undefined : ''}
      onClick={open ? undefined : onOpen}
    >
      <Heartbeat beat={attention} />
      <h2 id={`${id}-title`} className={styles.title}>
        <button
          type="button"
          className={styles.header}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={(event) => {
            // Avoid a second toggle from the section's own click.
            event.stopPropagation();
            onOpen();
          }}
        >
          {title}
          {required && <RequiredMark />}
        </button>
      </h2>
      {!open && summary && <p className={styles.summary}>{summary}</p>}
      {/* Closed blocks stay mounted so their fields keep what was typed. */}
      <div
        id={`${id}-body`}
        className={styles.accordion}
        data-open={open ? '' : undefined}
        inert={!open}
      >
        <div className={styles.accordionInner}>
          <div className={styles.form}>{children}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * Performance settings (data, stage and call-up), previewing the stage on the grid seen from above.
 * Creates a new performance, or edits one with its data already filled in.
 */
export function CreatePerformanceCard({
  groupId,
  performance,
  initialCallUp,
  initialTitle,
  onCancel,
  onCreated,
  onSaved,
  onStageChange,
  onStageSizeChange,
  onMissingChange,
  handleRef,
  titleSlot = null,
}: CreatePerformanceCardProps) {
  const { create, update: updatePerformance } = usePerformanceMutations();
  const queryClient = useQueryClient();
  const editing = Boolean(performance);
  // New performances start with a 10 × 8 m stage; an edited one shows its own.
  const [stage, setStage] = useState<StageValues>(() => ({
    width: String(performance?.stageWidth ?? (performance ? '' : 10)),
    depth: String(performance?.stageDepth ?? (performance ? '' : 8)),
    squareSize: formatNumber(String(performance?.squareSize ?? DEFAULT_SQUARE_SIZE)),
    edgeDistance: formatNumber(String(performance?.edgeDistance ?? MIN_EDGE_DISTANCE)),
    musicSide: performance?.musicSide ?? '',
    musicRows: String(performance?.musicRows ?? 1),
  }));
  // Values shown on the grid: they only change when a field loses focus, so typing "9" over "10"
  // does not flash a 1 m stage.
  const [settled, setSettled] = useState<StageValues>(stage);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [step, setStep] = useState<Step | null>('data');
  const [title, setTitle] = useState(performance?.title ?? (initialTitle || DEFAULT_TITLE));
  const [titleError, setTitleError] = useState('');
  // Data fields are uncontrolled; these copies only feed the closed block's summary.
  const [info, setInfo] = useState<Record<string, string>>(() => ({
    place: performance?.place ?? '',
    date: performance?.date ?? '',
    minMinutes: String(performance?.minMinutes ?? ''),
    maxMinutes: String(performance?.maxMinutes ?? ''),
  }));
  const [callUp, setCallUp] = useState<{ entries: CallUpEntry[]; pending: boolean }>({
    entries: initialCallUp ?? [],
    pending: false,
  });
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Counts the attempts with something missing, to replay the heartbeat on each one.
  const [beat, setBeat] = useState(0);
  const reportCallUp = useCallback(
    (entries: CallUpEntry[], pending: boolean) => setCallUp({ entries, pending }),
    [],
  );

  useEffect(() => {
    onStageChange(toStage(settled));
    onStageSizeChange?.(toStageSize(settled));
  }, [settled, onStageChange, onStageSizeChange]);

  // Leaving a stage field applies it; values out of range go to the nearest limit
  // (width 4 to 32 m, depth 2 to 20 m, edge 0,25 to 2 m).
  const applyStage = () => {
    const limit = (value: string, min: number, max: number, blank: string) => {
      const number = toNumber(value);
      if (number === null) return blank;
      const fixed = Math.min(max, Math.max(min, number));
      return fixed === number ? value : formatNumber(String(fixed));
    };
    const next = {
      ...stage,
      width: limit(stage.width, MIN_STAGE_WIDTH, MAX_STAGE_WIDTH, ''),
      depth: limit(stage.depth, MIN_STAGE_DEPTH, MAX_STAGE_DEPTH, ''),
      edgeDistance: formatNumber(
        limit(stage.edgeDistance, MIN_EDGE_DISTANCE, MAX_EDGE_DISTANCE, String(MIN_EDGE_DISTANCE)),
      ),
      musicRows: String(musicRowsOf(stage.musicRows)),
    };
    setStage(next);
    // Incomplete measures keep the previous preview.
    if (toStage(next)) setSettled(next);
  };

  const update =
    (field: keyof StageValues, clean: (value: string) => string) =>
    (event: { target: { value: string } }) =>
      setStage((current) => ({ ...current, [field]: clean(event.target.value) }));
  const metres = (value: string) => cleanInteger(value, 3);

  // The title is the only required field; without it the focus goes back to it.
  const checkTitle = () => {
    if (title.trim()) return true;
    setTitleError('Ponle un título');
    window.setTimeout(() => titleRef.current?.focus(), 0);
    return false;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkTitle() || missing.length) return;
    const form = new FormData(event.currentTarget);
    const minutes = (name: string) => toNumber(String(form.get(name) ?? ''));

    setSaving(true);
    setSaveError('');
    const values = {
      title,
      place: String(form.get('place')),
      date: String(form.get('date')) || null,
      minMinutes: minutes('minMinutes'),
      maxMinutes: minutes('maxMinutes'),
      stageWidth: toNumber(stage.width),
      stageDepth: toNumber(stage.depth),
      squareSize: toNumber(stage.squareSize) ?? DEFAULT_SQUARE_SIZE,
      edgeDistance: Math.min(MAX_EDGE_DISTANCE, edgeOf(stage.edgeDistance)),
      musicSide: stage.musicSide || null,
      musicRows: musicRowsOf(stage.musicRows),
    };
    try {
      const saved = performance
        ? await updatePerformance.mutateAsync({ id: performance.id, ...values })
        : await create.mutateAsync({ groupId, ...values });
      await saveCallUp(saved.id, callUp.entries);
      await queryClient.invalidateQueries({ queryKey: callUpKey(saved.id) });
      setSaving(false);
      onCreated(saved);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se ha podido guardar');
      setSaving(false);
    }
  };

  const square = formatNumber(String(toNumber(stage.squareSize) ?? DEFAULT_SQUARE_SIZE));

  // What still has to be filled in before creating; the button stays blocked until it is empty.
  const missing = [
    // The default "Nueva actuación" does not count: the performance needs its own name.
    (!title.trim() || title.trim() === DEFAULT_TITLE) && 'ponerle título',
    !toNumber(stage.width) && 'el ancho del escenario',
    !toNumber(stage.depth) && 'el fondo del escenario',
    // Someone has to come, or at least may come.
    !callUp.entries.some((entry) => entry.status !== 'no') && 'convocar al menos a una persona',
    callUp.pending && 'las personas de la convocatoria por crear',
  ].filter(Boolean);
  const missingTitle = !title.trim() || title.trim() === DEFAULT_TITLE;
  const missingStage = !toNumber(stage.width) || !toNumber(stage.depth);
  const missingCallUp = callUp.pending || !callUp.entries.some((entry) => entry.status !== 'no');
  const attempt = () => {
    if (missing.length) setBeat((current) => current + 1);
    else formRef.current?.requestSubmit();
  };

  useImperativeHandle(handleRef, () => ({ attempt }));
  useEffect(() => onMissingChange?.(missing.length > 0), [missing.length, onMissingChange]);

  // Editing saves on its own a moment after each change, once nothing required is missing.
  const liveValues = {
    title: title.trim(),
    place: info.place || null,
    date: info.date || null,
    minMinutes: toNumber(info.minMinutes ?? ''),
    maxMinutes: toNumber(info.maxMinutes ?? ''),
    stageWidth: toNumber(settled.width),
    stageDepth: toNumber(settled.depth),
    squareSize: toNumber(settled.squareSize) ?? DEFAULT_SQUARE_SIZE,
    edgeDistance: Math.min(MAX_EDGE_DISTANCE, edgeOf(settled.edgeDistance)),
    musicSide: settled.musicSide || null,
    musicRows: musicRowsOf(settled.musicRows),
  };
  const valuesKey = JSON.stringify(liveValues);
  const callUpKeyValue = JSON.stringify(callUp.entries);
  const lastSaved = useRef({ values: valuesKey, callUp: callUpKeyValue });
  useEffect(() => {
    if (!performance || missing.length || callUp.pending) return;
    const saved = lastSaved.current;
    if (saved.values === valuesKey && saved.callUp === callUpKeyValue) return;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      setSaveError('');
      try {
        const next =
          saved.values === valuesKey
            ? performance
            : await updatePerformance.mutateAsync({ id: performance.id, ...JSON.parse(valuesKey) });
        if (saved.callUp !== callUpKeyValue) {
          await saveCallUp(performance.id, JSON.parse(callUpKeyValue));
          await queryClient.invalidateQueries({ queryKey: callUpKey(performance.id) });
        }
        lastSaved.current = { values: valuesKey, callUp: callUpKeyValue };
        onSaved?.(next);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'No se ha podido guardar');
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
    // Saves when what would be stored changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuesKey, callUpKeyValue, missing.length, callUp.pending]);

  const calledCount = callUp.entries.filter((entry) => entry.status === 'yes').length;
  const dataSummary =
    [
      info.place?.trim(),
      formatDay(info.date || null),
      formatDuration(toNumber(info.minMinutes ?? ''), toNumber(info.maxMinutes ?? '')),
    ]
      .filter(Boolean)
      .join(' · ') || 'Sin datos todavía';
  const musicSummary = settled.musicSide
    ? ` · músicos ${MUSIC_SIDE_OPTIONS.find((option) => option.value === settled.musicSide)?.label.toLowerCase()}`
    : '';
  const stageSummary = settled.width ? `${settled.width} × ${settled.depth} m${musicSummary}` : '';
  const callUpSummary = callUp.pending
    ? 'Faltan personas por crear'
    : callUp.entries.length
      ? `${calledCount} ${calledCount === 1 ? 'viene' : 'vienen'} de ${callUp.entries.length} convocados`
      : 'Sin convocatoria todavía';

  // Big editable title, like a document name; it goes back to the default if left empty. With a
  // slot it is drawn there, over both tabs, but still belongs to this form.
  const titleField = (
    <div className={styles.titleField}>
      <Heartbeat beat={missingTitle ? beat : 0} />
      {/* The label makes the pencil focus the field too; the hidden copy sizes it to its text. */}
      <label className={styles.titleRow}>
        <span className={styles.titleBox}>
          <span className={styles.titleSizer} aria-hidden="true">
            {title || ' '}
          </span>
          <input
            ref={titleRef}
            className={styles.titleInput}
            aria-label="Título de la actuación"
            // When creating, the title is the first thing to fill in; focusing selects it.
            autoFocus={!editing}
            size={1}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? 'title-error' : undefined}
            maxLength={120}
            autoComplete="off"
            value={title}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              setTitle(cleanText(event.target.value));
              setTitleError('');
            }}
            onBlur={() => {
              if (!title.trim()) setTitle(DEFAULT_TITLE);
            }}
          />
        </span>
        <Pencil className={styles.editIcon} size={20} aria-hidden="true" />
        <RequiredMark />
      </label>
      {titleError && (
        <p id="title-error" className={styles.error} role="alert">
          {titleError}
        </p>
      )}
    </div>
  );

  return (
    <form
      ref={formRef}
      id="create-performance"
      className={styles.stack}
      noValidate
      onSubmit={submit}
      onKeyDown={nextFieldOnEnter}
      onChange={(event) => {
        const { name, value } = event.target as unknown as HTMLInputElement;
        if (name) setInfo((current) => ({ ...current, [name]: value }));
      }}
    >
      {titleSlot ? createPortal(titleField, titleSlot) : titleField}

      <StepPanel
        id="data"
        title="Información general"
        summary={dataSummary}
        open={step === 'data'}
        onOpen={() => setStep(step === 'data' ? null : 'data')}
      >
        <TextField
          label="Lugar (opcional)"
          name="place"
          maxLength={120}
          defaultValue={performance?.place ?? ''}
          onInput={textField}
        />
        <TextField label="Fecha" name="date" type="date" defaultValue={performance?.date ?? ''} />
        <div className={styles.pair}>
          <TextField
            label="Duración mínima"
            name="minMinutes"
            defaultValue={performance?.minMinutes ?? ''}
            inputMode="numeric"
            autoComplete="off"
            onInput={minutesField}
            hint="Minutos"
          />
          <TextField
            label="Duración máxima"
            name="maxMinutes"
            defaultValue={performance?.maxMinutes ?? ''}
            inputMode="numeric"
            autoComplete="off"
            onInput={minutesField}
            hint="Minutos"
          />
        </div>
        <div className={styles.next}>
          <Button variant="primary" onClick={() => checkTitle() && setStep('stage')}>
            Continuar
          </Button>
        </div>
      </StepPanel>

      <StepPanel
        id="stage"
        attention={missingStage ? beat : 0}
        title="Escenario"
        summary={stageSummary}
        open={step === 'stage'}
        onOpen={() => setStep(step === 'stage' ? null : 'stage')}
      >
        <fieldset className={styles.stage} aria-labelledby="stage-title" onBlur={applyStage}>
          <div className={styles.triple}>
            <TextField
              label="Ancho (m)"
              requiredMark
              inputMode="numeric"
              autoComplete="off"
              value={stage.width}
              onChange={update('width', metres)}
              hint="De 4 a 32 m"
            />
            <TextField
              label="Fondo (m)"
              requiredMark
              inputMode="numeric"
              autoComplete="off"
              value={stage.depth}
              onChange={update('depth', metres)}
              hint="De 2 a 20 m"
            />
            <TextField
              label="Borde (m)"
              inputMode="decimal"
              autoComplete="off"
              value={stage.edgeDistance}
              onChange={update('edgeDistance', cleanDecimal)}
              hint="De 0,25 a 2 m"
            />
          </div>
          {/* Where the musicians play, kept for them in every piece. */}
          <div className={styles.pair}>
            <Select
              label="Zona de músicos"
              options={MUSIC_SIDE_OPTIONS}
              value={stage.musicSide || 'none'}
              onValueChange={(value) => {
                const next: StageValues = {
                  ...stage,
                  musicSide: value === 'none' ? '' : (value as MusicSide),
                };
                setStage(next);
                setSettled(next);
              }}
            />
            {stage.musicSide && (
              <TextField
                label="Filas"
                inputMode="numeric"
                autoComplete="off"
                value={stage.musicRows}
                onChange={update('musicRows', (value) => cleanInteger(value, 1))}
                hint={`De 1 a ${MAX_MUSIC_ROWS}, de 1 m cada una`}
              />
            )}
          </div>
          <div className={styles.scaleNote}>
            <span>{square === '1' ? '1 m = 1 cuadrado' : `1 cuadrado = ${square} m`}</span>
            <button
              type="button"
              className={styles.change}
              aria-expanded={scaleOpen}
              aria-controls="square-size"
              onClick={() => setScaleOpen((open) => !open)}
            >
              {scaleOpen ? 'Cerrar' : 'Cambiar'}
            </button>
          </div>
          {/* Accordion sweep: the row grows from 0 to its height. */}
          <div id="square-size" className={styles.accordion} data-open={scaleOpen ? '' : undefined}>
            <div className={styles.accordionInner}>
              <label className={styles.scale}>
                <span>1 cuadrado =</span>
                <input
                  className={styles.scaleInput}
                  inputMode="decimal"
                  autoComplete="off"
                  value={stage.squareSize}
                  onChange={update('squareSize', cleanDecimal)}
                  tabIndex={scaleOpen ? 0 : -1}
                  aria-label="Metros por cuadrado"
                />
                <span>m</span>
              </label>
            </div>
          </div>
        </fieldset>
        <div className={styles.next}>
          <Button variant="primary" onClick={() => setStep('callUp')}>
            Continuar
          </Button>
        </div>
      </StepPanel>

      <StepPanel
        id="callUp"
        attention={missingCallUp ? beat : 0}
        title="Convocatoria"
        required
        summary={callUpSummary}
        open={step === 'callUp'}
        onOpen={() => setStep(step === 'callUp' ? null : 'callUp')}
      >
        <CallUpSection groupId={groupId} initial={initialCallUp} onChange={reportCallUp} />
        <div className={styles.next}>
          <Button variant="primary" onClick={() => setStep(null)} disabled={callUp.pending}>
            Continuar
          </Button>
        </div>
      </StepPanel>

      {saveError && (
        <p className={styles.error} role="alert">
          {saveError}
        </p>
      )}
      {/* Editing saves as it goes, so only a status shows; creating has its buttons. */}
      <p className={styles.saveStatus} aria-live="polite">
        {editing && saving ? 'Guardando…' : ''}
      </p>
      {/* Under the last block; leaving asks first because nothing is saved until then. */}
      {!editing && (
        <div className={styles.actions}>
          <Button onClick={() => setConfirmingCancel(true)}>Cancelar</Button>
          <Button
            type="submit"
            variant="primary"
            className={styles.create}
            // Not disabled, so a click can point at what is missing.
            disabled={saving}
            aria-disabled={missing.length > 0}
            title={missing.length ? 'Rellena los campos necesarios' : undefined}
            onClick={(event) => {
              if (!missing.length) return;
              event.preventDefault();
              attempt();
            }}
          >
            {editing
              ? saving
                ? 'Guardando…'
                : 'Guardar cambios'
              : saving
                ? 'Creando…'
                : 'Crear actuación'}
          </Button>
        </div>
      )}
      {missing.length > 0 && (
        <p className={styles.missing}>
          <RequiredMark /> Falta {missing.join(', ')}.
        </p>
      )}
      <Dialog
        open={confirmingCancel}
        onOpenChange={setConfirmingCancel}
        title={editing ? '¿Salir sin guardar los cambios?' : '¿Salir sin crear la actuación?'}
        description="Los cambios no se guardarán. ¿Quieres continuar?"
        footer={
          <>
            <DialogClose asChild>
              <Button>Seguir editando</Button>
            </DialogClose>
            <Button variant="danger" onClick={onCancel}>
              Salir sin guardar
            </Button>
          </>
        }
      />
    </form>
  );
}

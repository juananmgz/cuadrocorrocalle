import {
  DEFAULT_SQUARE_SIZE,
  MAX_EDGE_DISTANCE,
  MAX_STAGE_DEPTH,
  MAX_STAGE_WIDTH,
  MIN_EDGE_DISTANCE,
  MIN_STAGE_DEPTH,
  MIN_STAGE_WIDTH,
  type CallUpEntry,
  type Performance,
} from '@cuadrocorrocalle/shared';
import {
  type FormEvent,
  type InputEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { GridStage } from '../../components/GridBackground/GridBackground';
import { Button } from '../../components/ui/Button/Button';
import { Dialog, DialogClose } from '../../components/ui/Dialog/Dialog';
import { RequiredMark } from '../../components/ui/RequiredMark/RequiredMark';
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
}

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
  /** Called with the performance once created or saved. */
  onCreated: (performance: Performance) => void;
  /** Reports the stage to preview on the grid. */
  onStageChange: (stage: GridStage | null) => void;
}

const toNumber = (value: string) => {
  const number = Number(value.replace(',', '.'));
  return value.trim() && Number.isFinite(number) && number > 0 ? number : null;
};

const edgeOf = (value: string) => Math.max(MIN_EDGE_DISTANCE, toNumber(value) ?? 0);

/** Stage in grid squares, or null until both measures are valid. */
function toStage({ width, depth, squareSize, edgeDistance }: StageValues): GridStage | null {
  const w = toNumber(width);
  const d = toNumber(depth);
  const square = toNumber(squareSize) ?? DEFAULT_SQUARE_SIZE;
  return w && d
    ? { cols: w / square, rows: d / square, edge: edgeOf(edgeDistance) / square }
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

interface StepPanelProps {
  id: Step;
  title: string;
  /** Marks the block with "(*)" when something in it must be filled in. */
  required?: boolean;
  summary: string;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
}

/** One block of the form; only one is open at a time, like an accordion. */
function StepPanel({ id, title, required, summary, open, onOpen, children }: StepPanelProps) {
  return (
    // A closed block opens on a click anywhere on it; the title button keeps keyboard access.
    <section
      className={styles.root}
      aria-labelledby={`${id}-title`}
      data-closed={open ? undefined : ''}
      onClick={open ? undefined : onOpen}
    >
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
  onStageChange,
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
  const reportCallUp = useCallback(
    (entries: CallUpEntry[], pending: boolean) => setCallUp({ entries, pending }),
    [],
  );

  useEffect(() => {
    onStageChange(toStage(settled));
  }, [settled, onStageChange]);

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
  const calledCount = callUp.entries.filter((entry) => entry.status === 'yes').length;
  const dataSummary =
    [
      info.place?.trim(),
      formatDay(info.date || null),
      formatDuration(toNumber(info.minMinutes ?? ''), toNumber(info.maxMinutes ?? '')),
    ]
      .filter(Boolean)
      .join(' · ') || 'Sin datos todavía';
  const stageSummary = settled.width ? `${settled.width} × ${settled.depth} m` : '';
  const callUpSummary = callUp.pending
    ? 'Faltan personas por crear'
    : callUp.entries.length
      ? `${calledCount} ${calledCount === 1 ? 'viene' : 'vienen'} de ${callUp.entries.length} convocados`
      : 'Sin convocatoria todavía';

  return (
    <form
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
      {/* Big editable title, like a document name; it goes back to the default if left empty. */}
      <div className={styles.titleField}>
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
          <svg
            className={styles.editIcon}
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <path
              d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM14 8l2 2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <RequiredMark />
        </label>
        {titleError && (
          <p id="title-error" className={styles.error} role="alert">
            {titleError}
          </p>
        )}
      </div>

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
      {/* Under the last block; leaving asks first because nothing is saved until then. */}
      <div className={styles.actions}>
        <Button onClick={() => setConfirmingCancel(true)}>Cancelar</Button>
        <Button
          type="submit"
          variant="primary"
          className={styles.create}
          disabled={saving || missing.length > 0}
          title={missing.length ? `Falta: ${missing.join(', ')}` : undefined}
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

import {
  DEFAULT_SQUARE_SIZE,
  MAX_EDGE_DISTANCE,
  MAX_STAGE_DEPTH,
  MAX_STAGE_WIDTH,
  MIN_EDGE_DISTANCE,
  MIN_STAGE_DEPTH,
  MIN_STAGE_WIDTH,
  TRIAL_PIECE_LIMIT,
  type CallUpEntry,
  type Performance,
} from '@cuadrocorrocalle/shared';
import {
  type FormEvent,
  type InputEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { GridStage } from '../../components/GridBackground/GridBackground';
import { RepertoireSection } from '../../components/RepertoireSection/RepertoireSection';
import { Button } from '../../components/ui/Button/Button';
import { TextField } from '../../components/ui/TextField/TextField';
import { saveCallUp } from '../../callUps/callUpApi';
import { usePerformanceMutations } from '../../performances/performancesApi';
import { cleanDecimal, cleanInteger, cleanText } from '../../performances/sanitize';
import { saveRepertoire } from '../../pieces/repertoireApi';
import { formatClock } from '../../pieces/clock';
import { draftError, type PieceDraft, toPieceInput, totalSeconds } from '../../pieces/draft';
import { CallUpSection } from './CallUpSection';
import styles from './CreatePerformanceCard.module.scss';

interface StageValues {
  width: string;
  depth: string;
  squareSize: string;
  edgeDistance: string;
}

type Step = 'data' | 'stage' | 'callUp' | 'repertoire';

interface CreatePerformanceCardProps {
  groupId: string;
  /** The "Grupo de Prueba" allows up to TRIAL_PIECE_LIMIT pieces. */
  isTrial?: boolean;
  /** Width covered on the left; the action buttons centre on the rest, under the stage. */
  inset: number;
  onCancel: () => void;
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

interface StepPanelProps {
  id: Step;
  title: string;
  summary: string;
  open: boolean;
  onOpen: () => void;
  children: ReactNode;
}

/** One block of the form; only one is open at a time, like an accordion. */
function StepPanel({ id, title, summary, open, onOpen, children }: StepPanelProps) {
  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.title}>
        <button
          type="button"
          className={styles.header}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={onOpen}
        >
          {title}
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

/** "Crear actuación" on the home page, previewing the stage on the grid seen from above. */
export function CreatePerformanceCard({
  groupId,
  isTrial,
  inset,
  onCancel,
  onCreated,
  onStageChange,
}: CreatePerformanceCardProps) {
  const { create } = usePerformanceMutations();
  // New performances start with a 10 × 8 m stage.
  const [stage, setStage] = useState<StageValues>({
    width: '10',
    depth: '8',
    squareSize: formatNumber(String(DEFAULT_SQUARE_SIZE)),
    edgeDistance: formatNumber(String(MIN_EDGE_DISTANCE)),
  });
  // Values shown on the grid: they only change when a field loses focus, so typing "9" over "10"
  // does not flash a 1 m stage.
  const [settled, setSettled] = useState<StageValues>(stage);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [step, setStep] = useState<Step | null>('data');
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [callUp, setCallUp] = useState<{ entries: CallUpEntry[]; pending: boolean }>({
    entries: [],
    pending: false,
  });
  const [pieces, setPieces] = useState<PieceDraft[]>([]);
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

  // The title is the only required field; without it the data block opens again.
  const checkTitle = () => {
    if (title.trim()) return true;
    setStep('data');
    setTitleError('Ponle un título');
    window.setTimeout(() => titleRef.current?.focus(), 0);
    return false;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkTitle() || callUp.pending) return;
    if (piecesInvalid) {
      setStep('repertoire');
      setSaveError('Revisa las piezas marcadas en rojo');
      return;
    }
    const form = new FormData(event.currentTarget);
    const minutes = (name: string) => toNumber(String(form.get(name) ?? ''));

    setSaving(true);
    setSaveError('');
    try {
      const performance = await create.mutateAsync({
        groupId,
        title,
        place: String(form.get('place')),
        date: String(form.get('date')) || null,
        minMinutes: minutes('minMinutes'),
        maxMinutes: minutes('maxMinutes'),
        stageWidth: toNumber(stage.width),
        stageDepth: toNumber(stage.depth),
        squareSize: toNumber(stage.squareSize) ?? DEFAULT_SQUARE_SIZE,
        edgeDistance: Math.min(MAX_EDGE_DISTANCE, edgeOf(stage.edgeDistance)),
      });
      if (callUp.entries.length) await saveCallUp(performance.id, callUp.entries);
      if (pieces.length) await saveRepertoire(performance.id, pieces.map(toPieceInput));
      onCreated(performance);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se ha podido crear');
      setSaving(false);
    }
  };

  const square = formatNumber(String(toNumber(stage.squareSize) ?? DEFAULT_SQUARE_SIZE));

  const piecesInvalid = pieces.some((piece) => draftError(piece));
  const repertoireSummary = pieces.length
    ? [
        `${pieces.length} ${pieces.length === 1 ? 'pieza' : 'piezas'}`,
        totalSeconds(pieces) > 0 && formatClock(totalSeconds(pieces)),
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Sin repertorio todavía';
  const calledCount = callUp.entries.filter((entry) => entry.status === 'yes').length;
  const dataSummary = title.trim();
  const stageSummary = settled.width ? `${settled.width} × ${settled.depth} m` : '';
  const callUpSummary = callUp.pending
    ? 'Faltan personas por crear'
    : callUp.entries.length
      ? `${calledCount} ${calledCount === 1 ? 'viene' : 'vienen'} de ${callUp.entries.length} convocados`
      : 'Sin convocatoria todavía';

  return (
    <form id="create-performance" className={styles.stack} noValidate onSubmit={submit}>
      <StepPanel
        id="data"
        title="Nueva actuación"
        summary={dataSummary}
        open={step === 'data'}
        onOpen={() => setStep(step === 'data' ? null : 'data')}
      >
        <TextField
          ref={titleRef}
          label="Título"
          name="title"
          maxLength={120}
          required
          autoFocus
          value={title}
          onChange={(event) => {
            setTitle(cleanText(event.target.value));
            setTitleError('');
          }}
          error={titleError}
        />
        <TextField label="Lugar (opcional)" name="place" maxLength={120} onInput={textField} />
        <TextField label="Fecha" name="date" type="date" />
        <div className={styles.pair}>
          <TextField
            label="Duración mínima"
            name="minMinutes"
            inputMode="numeric"
            autoComplete="off"
            onInput={minutesField}
            hint="Minutos"
          />
          <TextField
            label="Duración máxima"
            name="maxMinutes"
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
              inputMode="numeric"
              autoComplete="off"
              value={stage.width}
              onChange={update('width', metres)}
              hint="De 4 a 32 m"
            />
            <TextField
              label="Fondo (m)"
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
        summary={callUpSummary}
        open={step === 'callUp'}
        onOpen={() => setStep(step === 'callUp' ? null : 'callUp')}
      >
        <CallUpSection groupId={groupId} onChange={reportCallUp} />
        <div className={styles.next}>
          <Button variant="primary" onClick={() => setStep('repertoire')} disabled={callUp.pending}>
            Continuar
          </Button>
        </div>
      </StepPanel>

      <StepPanel
        id="repertoire"
        title="Repertorio"
        summary={repertoireSummary}
        open={step === 'repertoire'}
        onOpen={() => setStep(step === 'repertoire' ? null : 'repertoire')}
      >
        <RepertoireSection
          pieces={pieces}
          onChange={(next) => {
            setPieces(next);
            setSaveError('');
          }}
          limit={isTrial ? TRIAL_PIECE_LIMIT : undefined}
        />
        <div className={styles.next}>
          <Button variant="primary" onClick={() => setStep(null)} disabled={piecesInvalid}>
            Continuar
          </Button>
        </div>
      </StepPanel>

      {saveError && (
        <p className={styles.error} role="alert">
          {saveError}
        </p>
      )}
      {/* Under the stage, centred on the free area. */}
      <div
        className={styles.actions}
        style={{ left: `calc(${inset}px + (100% - ${inset}px) / 2)` }}
      >
        <Button onClick={onCancel}>Cancelar</Button>
        <Button
          type="submit"
          variant="primary"
          disabled={saving || callUp.pending}
          title={callUp.pending ? 'Faltan personas de la convocatoria por crear' : undefined}
        >
          {saving ? 'Creando…' : 'Crear actuación'}
        </Button>
      </div>
    </form>
  );
}

import type { Performance } from '@cuadrocorrocalle/shared';
import { ArrowLeft } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useCallUp } from '../../callUps/callUpApi';
import type { GridStage } from '../../components/GridBackground/GridBackground';
import type { StageSize } from '../../stage/placement';
import {
  PerformanceSummary,
  type SummarySection,
} from '../../components/PerformanceSummary/PerformanceSummary';
import { RepertoireCard } from '../../components/RepertoireSection/RepertoireCard';
import { StageMeasures } from '../../components/StageMeasures/StageMeasures';
import { FROM_TABLET, useMediaQuery } from '../../hooks';
import { StageTools } from '../../components/StageTools/StageTools';
import { useApp } from '../../components/AppLayout/appContext';
import { useMeasuresOn } from '../../stage/stagePrefs';
import { CreatePerformanceCard, type PerformanceFormHandle } from './CreatePerformanceCard';
import styles from './PerformanceEditor.module.scss';

export type EditorView = 'settings' | 'callUp' | 'pieces';

// Whether the stage's measures stay on, remembered on this device.
interface PerformanceEditorProps {
  groupId: string;
  /** The performance to edit; without it, the editor starts by creating one. */
  performance?: Performance;
  initialView?: EditorView;
  /** Opens editing its general information instead of on its summary. */
  startEditing?: boolean;
  /** Title to start with when creating. */
  initialTitle?: string;
  /** Leaving without saving. */
  onCancel: () => void;
  /** "← Inicio", once the performance exists; pending changes save on their own. */
  onHome: () => void;
  onStageChange: (stage: GridStage | null) => void;
  /** Title of the open piece, for the sign over the stage; null outside the pieces view. */
  onPieceLabel: (label: string | null) => void;
}

/**
 * The same screen to create and to edit a performance. An existing one opens on its summary;
 * "Editar" (or a piece in it) shows the "Actuación" (settings form) and "Piezas" tabs, and
 * "← Resumen" goes back. Creating starts straight in the form.
 */
export function PerformanceEditor({
  groupId,
  performance: initial,
  initialView = 'settings',
  startEditing = false,
  initialTitle,
  onCancel,
  onHome,
  onStageChange,
  onPieceLabel,
}: PerformanceEditorProps) {
  const [performance, setPerformance] = useState(initial);
  const [view, setView] = useState<EditorView>(initial ? initialView : 'settings');
  const { data: callUp } = useCallUp(performance?.id ?? '', Boolean(performance));
  // The settings form needs the saved call-up before it starts, when editing.
  const ready = !performance || callUp;
  const formRef = useRef<PerformanceFormHandle>(null);
  // Whether the settings still miss something required (only matters before creating).
  const [missing, setMissing] = useState(true);
  // Creating starts editing; an existing performance shows its summary until "Editar" (or a piece).
  const [editing, setEditing] = useState(!initial || initialView === 'pieces' || startEditing);
  // Piece to open in "Piezas", chosen from the summary.
  const [pieceToOpen, setPieceToOpen] = useState<string | null>(null);
  // Where the title of the form goes: over both tabs, so it stays put when switching.
  // The title goes in the middle of the top bar.
  const { titleSlot } = useApp();
  // The stage as shown, with any measure changed but not saved yet; people are placed on it.
  const [shownStage, setShownStage] = useState<StageSize | null>(null);
  // Its measures show while the "Escenario" block is open, or always with "Medidas" on.
  const [stageOpen, setStageOpen] = useState(false);
  const measuresOn = useMeasuresOn();
  const wide = useMediaQuery(FROM_TABLET);
  const piecesHint = performance
    ? undefined
    : missing
      ? 'Rellena los campos necesarios'
      : 'Crea la actuación y pasa a sus piezas';

  const show = (next: EditorView) => {
    setView(next);
    if (next !== 'pieces') onPieceLabel(null);
  };
  const edit = (next: EditorView, pieceId: string | null = null) => {
    setEditing(true);
    setPieceToOpen(pieceId);
    show(next);
  };
  const backToSummary = () => {
    setEditing(false);
    // So the same piece can be asked for again next time.
    setPieceToOpen(null);
    show('settings');
  };
  const summarizing = Boolean(performance) && !editing;
  // The summary's parts, chosen like the editor's views; it opens on the performance's data.
  const [summarySection, setSummarySection] = useState<SummarySection>('performance');
  const summaryOptions: { value: SummarySection; label: string }[] = [
    { value: 'performance', label: 'Actuación' },
    { value: 'callUp', label: 'Convocatoria' },
    { value: 'pieces', label: 'Piezas' },
  ];

  return (
    <div className={styles.root}>
      {/* In the summary the title is only read, in the middle of the top bar like when editing. */}
      {summarizing &&
        performance &&
        titleSlot &&
        createPortal(<h1 className={styles.barTitle}>{performance.title}</h1>, titleSlot)}
      <div className={styles.header}>
        {summarizing && (
          <button type="button" className={styles.home} onClick={onHome}>
            <ArrowLeft size={16} aria-hidden="true" /> Inicio
          </button>
        )}
        {performance && editing && (
          <button type="button" className={styles.home} onClick={backToSummary}>
            <ArrowLeft size={16} aria-hidden="true" /> Resumen
          </button>
        )}
        {/* The summary's three parts, with the same buttons as the editor's. */}
        {summarizing && (
          <div
            className={styles.switch}
            data-options={summaryOptions.length}
            role="group"
            aria-label="Qué ver"
          >
            {summaryOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={styles.option}
                aria-pressed={summarySection === value}
                onClick={() => setSummarySection(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {/* While editing: "Actuación", "Convocatoria" (an existing performance) and "Piezas". */}
        <div
          className={styles.switch}
          data-options={performance ? 3 : 2}
          role="group"
          aria-label="Qué editar"
          hidden={summarizing}
        >
          <button
            type="button"
            className={styles.option}
            aria-pressed={view === 'settings'}
            onClick={() => show('settings')}
          >
            Actuación
          </button>
          {performance && (
            <button
              type="button"
              className={styles.option}
              aria-pressed={view === 'callUp'}
              onClick={() => show('callUp')}
            >
              Convocatoria
            </button>
          )}
          <button
            type="button"
            className={styles.option}
            aria-pressed={view === 'pieces'}
            // Before the performance exists, a click creates it, or points at what is missing.
            aria-disabled={!performance && missing}
            data-hint={piecesHint}
            onClick={() => (performance ? show('pieces') : formRef.current?.attempt())}
          >
            Piezas
          </button>
        </div>
      </div>

      {/* Every view stays mounted, so switching keeps what was typed and the stage preview. */}
      {performance && (
        <div className={styles.view} hidden={!summarizing}>
          <PerformanceSummary
            performance={performance}
            section={summarySection}
            onEdit={() => edit('settings')}
            onEditCallUp={() => edit('callUp')}
            onOpenPiece={(pieceId) => edit('pieces', pieceId)}
            stage={shownStage}
            active={summarizing}
            onPreviewLabel={onPieceLabel}
          />
        </div>
      )}
      <div
        className={styles.view}
        hidden={summarizing || (view !== 'settings' && view !== 'callUp')}
      >
        {ready && (
          <CreatePerformanceCard
            // A new key once created, so the form starts again in edit mode.
            key={performance?.id ?? 'new'}
            groupId={groupId}
            performance={performance}
            initialCallUp={callUp}
            initialTitle={initialTitle}
            // Only a new performance can be cancelled; edits save as they go.
            onCancel={onCancel}
            onCreated={(saved) => {
              setPerformance(saved);
              show('pieces');
            }}
            onSaved={setPerformance}
            onStageChange={onStageChange}
            onStageSizeChange={setShownStage}
            onStageOpen={setStageOpen}
            onMissingChange={setMissing}
            handleRef={formRef}
            // While summarizing the form is hidden, so its title is too.
            titleSlot={summarizing ? null : titleSlot}
            shown={!summarizing && view === 'settings'}
            // Creating, every block is in "Actuación"; editing, the call-up has its own tab.
            part={!performance ? 'all' : view === 'callUp' ? 'callUp' : 'settings'}
          />
        )}
      </div>
      {wide && shownStage && (
        <StageMeasures
          stage={shownStage}
          shown={measuresOn || (stageOpen && !summarizing && view === 'settings')}
        />
      )}
      {wide && <StageTools />}
      {performance && (
        <div className={styles.view} hidden={summarizing || view !== 'pieces'}>
          <div className={styles.pieces}>
            <RepertoireCard
              performanceId={performance.id}
              fill
              onOpenPiece={(label) => !summarizing && view === 'pieces' && onPieceLabel(label)}
              stage={shownStage}
              stageActive={!summarizing && view === 'pieces'}
              openPieceId={pieceToOpen}
            />
          </div>
        </div>
      )}
    </div>
  );
}

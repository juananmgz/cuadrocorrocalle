import type { Performance } from '@cuadrocorrocalle/shared';
import { useRef, useState } from 'react';

import { useCallUp } from '../../callUps/callUpApi';
import type { GridStage } from '../../components/GridBackground/GridBackground';
import type { StageSize } from '../../stage/placement';
import { PerformanceSummary } from '../../components/PerformanceSummary/PerformanceSummary';
import { RepertoireCard } from '../../components/RepertoireSection/RepertoireCard';
import { CreatePerformanceCard, type PerformanceFormHandle } from './CreatePerformanceCard';
import styles from './PerformanceEditor.module.scss';

export type EditorView = 'settings' | 'pieces';

interface PerformanceEditorProps {
  groupId: string;
  /** The performance to edit; without it, the editor starts by creating one. */
  performance?: Performance;
  initialView?: EditorView;
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
  const [editing, setEditing] = useState(!initial || initialView === 'pieces');
  // Piece to open in "Piezas", chosen from the summary.
  const [pieceToOpen, setPieceToOpen] = useState<string | null>(null);
  // The stage as shown, with any measure changed but not saved yet; people are placed on it.
  const [shownStage, setShownStage] = useState<StageSize | null>(null);
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

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        {summarizing && (
          <button type="button" className={styles.home} onClick={onHome}>
            ← Inicio
          </button>
        )}
        {performance && editing && (
          <button type="button" className={styles.home} onClick={backToSummary}>
            ← Resumen
          </button>
        )}
        {/* "Actuación" and "Piezas" only while editing. */}
        <div className={styles.switch} role="group" aria-label="Qué editar" hidden={summarizing}>
          <button
            type="button"
            className={styles.option}
            aria-pressed={view === 'settings'}
            onClick={() => show('settings')}
          >
            Actuación
          </button>
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
            onEdit={() => edit('settings')}
            onOpenPiece={(pieceId) => edit('pieces', pieceId)}
            stage={shownStage}
            active={summarizing}
            onPreviewLabel={onPieceLabel}
          />
        </div>
      )}
      <div className={styles.view} hidden={summarizing || view !== 'settings'}>
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
            onMissingChange={setMissing}
            handleRef={formRef}
          />
        )}
      </div>
      {performance && (
        <div className={styles.view} hidden={summarizing || view !== 'pieces'}>
          <div className={styles.pieces}>
            <h2 className={styles.title}>{performance.title}</h2>
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

import type { Performance } from '@cuadrocorrocalle/shared';
import { useState } from 'react';

import { useCallUp } from '../../callUps/callUpApi';
import type { GridStage } from '../../components/GridBackground/GridBackground';
import { RepertoireCard } from '../../components/RepertoireSection/RepertoireCard';
import { useToast } from '../../components/ui/Toast/toastContext';
import { CreatePerformanceCard } from './CreatePerformanceCard';
import styles from './PerformanceEditor.module.scss';

export type EditorView = 'settings' | 'pieces';

interface PerformanceEditorProps {
  groupId: string;
  /** The performance to edit; without it, the editor starts by creating one. */
  performance?: Performance;
  initialView?: EditorView;
  /** Leaving without saving. */
  onCancel: () => void;
  /** "Terminar" in the pieces view. */
  onFinish: () => void;
  onStageChange: (stage: GridStage | null) => void;
  /** Title of the open piece, for the sign over the stage; null outside the pieces view. */
  onPieceLabel: (label: string | null) => void;
}

/**
 * The same screen to create and to edit a performance: its settings (data, stage, call-up) and its
 * pieces, switching between both once it exists.
 */
export function PerformanceEditor({
  groupId,
  performance: initial,
  initialView = 'settings',
  onCancel,
  onFinish,
  onStageChange,
  onPieceLabel,
}: PerformanceEditorProps) {
  const toast = useToast();
  const [performance, setPerformance] = useState(initial);
  const [view, setView] = useState<EditorView>(initial ? initialView : 'settings');
  const { data: callUp } = useCallUp(performance?.id ?? '', Boolean(performance));
  // The settings form needs the saved call-up before it starts, when editing.
  const ready = !performance || callUp;

  const show = (next: EditorView) => {
    setView(next);
    if (next === 'settings') onPieceLabel(null);
  };

  return (
    <div className={styles.root}>
      <div className={styles.switch} role="group" aria-label="Qué editar">
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
          disabled={!performance}
          title={performance ? undefined : 'Crea la actuación para añadir sus piezas'}
          onClick={() => show('pieces')}
        >
          Piezas
        </button>
      </div>

      {/* Both views stay mounted, so switching keeps what was typed. */}
      <div className={styles.view} hidden={view !== 'settings'}>
        {ready && (
          <CreatePerformanceCard
            // A new key once created, so the form starts again in edit mode.
            key={performance?.id ?? 'new'}
            groupId={groupId}
            performance={performance}
            initialCallUp={callUp}
            onCancel={onCancel}
            onCreated={(saved) => {
              const created = !performance;
              setPerformance(saved);
              if (created) show('pieces');
              else toast.show({ title: 'Cambios guardados', tone: 'success' });
            }}
            onStageChange={onStageChange}
          />
        )}
      </div>
      {performance && (
        <div className={styles.view} hidden={view !== 'pieces'}>
          <div className={styles.pieces}>
            <h2 className={styles.title}>{performance.title}</h2>
            <RepertoireCard
              performanceId={performance.id}
              fill
              minMinutes={performance.minMinutes}
              maxMinutes={performance.maxMinutes}
              onOpenPiece={(label) => view === 'pieces' && onPieceLabel(label)}
              onFinish={onFinish}
            />
          </div>
        </div>
      )}
    </div>
  );
}

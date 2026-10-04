import { TRIAL_PIECE_LIMIT } from '@cuadrocorrocalle/shared';
import { useState } from 'react';

import { draftError, type PieceDraft, toDraft, toPieceInput } from '../../pieces/draft';
import { useRepertoire, useSaveRepertoire } from '../../pieces/repertoireApi';
import { useApp } from '../AppLayout/appContext';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { useToast } from '../ui/Toast/toastContext';
import { RepertoireSection } from './RepertoireSection';
import styles from './RepertoireSection.module.scss';

/** Repertoire of a saved performance, edited in place and saved with one button. */
export function RepertoireCard({ performanceId }: { performanceId: string }) {
  const toast = useToast();
  const { activeGroup } = useApp();
  const { data: saved } = useRepertoire(performanceId);
  const save = useSaveRepertoire(performanceId);
  // Local edits; null while they match what is saved.
  const [drafts, setDrafts] = useState<PieceDraft[] | null>(null);
  const pieces = drafts ?? saved?.map(toDraft) ?? [];
  const invalid = pieces.some((piece) => draftError(piece));

  const submit = () =>
    save.mutate(pieces.map(toPieceInput), {
      onSuccess: () => {
        setDrafts(null);
        toast.show({ title: 'Repertorio guardado', tone: 'success' });
      },
      onError: (error) => toast.show({ title: error.message, tone: 'warning' }),
    });

  return (
    <Card title="Repertorio">
      {saved && (
        <RepertoireSection
          pieces={pieces}
          onChange={setDrafts}
          onSave={() => !invalid && submit()}
          limit={activeGroup?.isTrial ? TRIAL_PIECE_LIMIT : undefined}
        />
      )}
      {drafts && (
        <div className={styles.add}>
          <Button variant="primary" onClick={submit} disabled={invalid || save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar repertorio'}
          </Button>
          <Button variant="ghost" onClick={() => setDrafts(null)} disabled={save.isPending}>
            Descartar cambios
          </Button>
        </div>
      )}
    </Card>
  );
}

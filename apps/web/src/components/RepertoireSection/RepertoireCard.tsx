import { TRIAL_PIECE_LIMIT } from '@cuadrocorrocalle/shared';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useCallUp } from '../../callUps/callUpApi';
import { usePeople } from '../../people/peopleApi';
import { draftError, type PieceDraft, toDraft, toPieceInput } from '../../pieces/draft';
import { useRepertoire, useSaveRepertoire } from '../../pieces/repertoireApi';
import { useApp } from '../AppLayout/appContext';
import { toggleParticipant } from '../../pieces/participants';
import { PeopleTray, type TrayPerson } from '../PeopleTray/PeopleTray';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { useToast } from '../ui/Toast/toastContext';
import { RepertoireSection } from './RepertoireSection';
import styles from './RepertoireSection.module.scss';

// Changes are saved this long after the last one.
const AUTOSAVE_DELAY = 800;

interface RepertoireCardProps {
  performanceId: string;
  /** Reports the open piece's title, e.g. for a sign over the stage. */
  onOpenPiece?: (title: string | null) => void;
  /** Shows "Terminar", which saves any pending change first. */
  onFinish?: () => void;
  /** Both panels take the full height available, each scrolling on its own. */
  fill?: boolean;
}

/** Repertoire of a saved performance, saved on its own as it changes, with a people tray. */
export function RepertoireCard({
  performanceId,
  onOpenPiece,
  onFinish,
  fill = false,
}: RepertoireCardProps) {
  const toast = useToast();
  const { activeGroup } = useApp();
  const { data: saved } = useRepertoire(performanceId);
  const { data: callUp } = useCallUp(performanceId);
  const { data: groupPeople } = usePeople(activeGroup?.id);
  const save = useSaveRepertoire(performanceId);
  // Local copy being edited; null until the first change.
  const [drafts, setDrafts] = useState<PieceDraft[] | null>(null);
  // Whether the latest changes still have to be saved.
  const [pending, setPending] = useState(false);
  const pieces = useMemo(() => drafts ?? saved?.map(toDraft) ?? [], [drafts, saved]);
  const invalid = pieces.some((piece) => draftError(piece));
  const finishing = useRef(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const openPiece = pieces.find((piece) => piece.key === openKey) ?? null;
  const openTitle = openPiece ? openPiece.title.trim() || 'Sin título' : null;

  useEffect(() => {
    onOpenPiece?.(openTitle);
  }, [openTitle, onOpenPiece]);

  // How many pieces each person takes part in.
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const piece of pieces)
      for (const { personId } of piece.participants)
        map.set(personId, (map.get(personId) ?? 0) + 1);
    return map;
  }, [pieces]);

  // Only people who come or may come can take part, in the group's order.
  const people = useMemo<TrayPerson[] | undefined>(() => {
    if (!callUp || !groupPeople) return undefined;
    const status = new Map(callUp.map((entry) => [entry.personId, entry.status]));
    return groupPeople.flatMap((person) => {
      const entry = status.get(person.id);
      return entry && entry !== 'no' ? [{ ...person, status: entry }] : [];
    });
  }, [callUp, groupPeople]);

  /** Saves what is on screen; new pieces get their ids without closing the open one. */
  const saveNow = (then?: () => void) => {
    const sent = pieces;
    setPending(false);
    save.mutate(sent.map(toPieceInput), {
      onSuccess: (stored) => {
        setDrafts(
          (current) =>
            current?.map((draft) => {
              const index = sent.findIndex((item) => item.key === draft.key);
              return index >= 0 && !draft.id ? { ...draft, id: stored[index]?.id } : draft;
            }) ?? null,
        );
        then?.();
      },
      onError: (error) => {
        setPending(true);
        finishing.current = false;
        toast.show({ title: error.message, tone: 'warning' });
      },
    });
  };

  // Saves a moment after the last change, once every piece is valid.
  useEffect(() => {
    if (!pending || invalid || save.isPending) return;
    const timer = window.setTimeout(() => saveNow(), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
    // saveNow reads the latest state when it runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts, pending, invalid, save.isPending]);

  const change = (next: PieceDraft[]) => {
    setDrafts(next);
    setPending(true);
  };

  const status = invalid
    ? 'Sin guardar: falta algún dato en una pieza'
    : save.isPending
      ? 'Guardando…'
      : pending
        ? 'Cambios sin guardar'
        : drafts
          ? 'Cambios guardados'
          : null;

  return (
    <div className={styles.workspace} data-fill={fill ? '' : undefined}>
      <div className={styles.workspaceGrid}>
        <Card title="Repertorio" className={styles.repertoireCard}>
          {saved && (
            <RepertoireSection
              pieces={pieces}
              onChange={change}
              onSave={() => !invalid && saveNow()}
              limit={activeGroup?.isTrial ? TRIAL_PIECE_LIMIT : undefined}
              people={people}
              openKey={openKey}
              onOpenKeyChange={setOpenKey}
            />
          )}
          {(status || onFinish) && (
            <div className={styles.add}>
              {status && (
                <span className={styles.saveStatus} aria-live="polite">
                  {status}
                </span>
              )}
              {onFinish && (
                <Button
                  variant="primary"
                  className={styles.finish}
                  onClick={() => {
                    if (finishing.current) return;
                    finishing.current = true;
                    if (pending || save.isPending) saveNow(onFinish);
                    else onFinish();
                  }}
                  disabled={invalid}
                >
                  Terminar
                </Button>
              )}
            </div>
          )}
        </Card>
        {people && (
          <PeopleTray
            people={people}
            pieceTitle={openTitle}
            selected={new Set(openPiece?.participants.map((participant) => participant.personId))}
            counts={counts}
            onToggle={(person) =>
              openPiece &&
              change(
                pieces.map((piece) =>
                  piece.key === openPiece.key
                    ? {
                        ...piece,
                        participants: toggleParticipant(piece.participants, person, piece.type),
                      }
                    : piece,
                ),
              )
            }
          />
        )}
      </div>
    </div>
  );
}

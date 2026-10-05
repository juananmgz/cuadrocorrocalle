import { type Performance, PIECE_TYPE_LABELS } from '@cuadrocorrocalle/shared';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';

import { useCallUp } from '../../callUps/callUpApi';
import { usePeople } from '../../people/peopleApi';
import { type PieceDraft, toDraft } from '../../pieces/draft';
import { useRepertoire } from '../../pieces/repertoireApi';
import { summarize } from '../../pieces/summary';
import { formatDay, formatDuration } from '../../performances/format';
import { FROM_TABLET, useMediaQuery } from '../../hooks';
import type { StageSize } from '../../stage/placement';
import { useStageView } from '../GridBackground/stageView';
import { type PlacedPerson, StageLayer } from '../StageLayer/StageLayer';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { PersonChip } from '../ui/PersonChip/PersonChip';
import styles from './PerformanceSummary.module.scss';
import { RepertoireSummaryView } from './RepertoireSummaryView';

interface PerformanceSummaryProps {
  performance: Performance;
  /** Opens the settings form. */
  onEdit: () => void;
  /** Opens a piece to edit it. */
  onOpenPiece: (pieceId: string) => void;
  /** Stage as shown, for the preview of a piece. */
  stage: StageSize | null;
  /** Whether the summary is on screen, so its preview is drawn. */
  active: boolean;
  /** Title of the previewed piece, for the sign over the stage; null without one. */
  onPreviewLabel: (label: string | null) => void;
}

interface FoldableProps {
  title: string;
  /** Shown next to the title, e.g. how many there are. */
  count?: number;
  children: ReactNode;
}

/** A block of the summary that folds away; open by default. */
function Foldable({ title, count, children }: FoldableProps) {
  const [open, setOpen] = useState(true);
  const id = useId();

  return (
    <section className={styles.foldable}>
      <h2 className={styles.foldTitle}>
        <button
          type="button"
          className={styles.foldToggle}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          {title}
          {count !== undefined && <span className={styles.foldCount}>({count})</span>}
        </button>
      </h2>
      <div id={id} className={styles.foldBody} data-open={open ? '' : undefined} inert={!open}>
        <div className={styles.foldInner}>{children}</div>
      </div>
    </section>
  );
}

const pieceCount = (count: number, encore = false) =>
  `${count} ${encore ? 'bis' : count === 1 ? 'pieza' : 'piezas'}`;

/**
 * What an existing performance opens on: its data, repertoire time, its pieces (each one previewed
 * on the stage when clicked, with "Editar" to open it) and how many pieces each person has.
 */
export function PerformanceSummary({
  performance,
  onEdit,
  onOpenPiece,
  stage,
  active,
  onPreviewLabel,
}: PerformanceSummaryProps) {
  const { data: saved } = useRepertoire(performance.id);
  const { data: callUp } = useCallUp(performance.id);
  const { data: groupPeople } = usePeople(performance.groupId);
  const pieces = useMemo(() => saved?.map(toDraft) ?? [], [saved]);
  const summary = summarize(pieces, performance.minMinutes, performance.maxMinutes);
  const main = pieces.filter((piece) => !piece.encore);
  const encores = pieces.filter((piece) => piece.encore);
  // 1, 2… in the repertoire and B1, B2… among the encores, as in "Piezas".
  const numberOf = (piece: PieceDraft) =>
    piece.encore ? `B${encores.indexOf(piece) + 1}` : String(main.indexOf(piece) + 1);

  // Clicking a piece previews what it has on the stage, as saved; "Editar" opens it.
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const preview = pieces.find((piece) => piece.key === previewKey) ?? null;
  const wide = useMediaQuery(FROM_TABLET);
  const stageView = useStageView();
  const previewLabel = active && preview ? preview.title : null;
  useEffect(() => onPreviewLabel(previewLabel), [previewLabel, onPreviewLabel]);

  // Who comes or may come, in the group's order, with the pieces and encores they are in.
  const people = useMemo(() => {
    if (!callUp || !groupPeople) return [];
    const status = new Map(callUp.map((entry) => [entry.personId, entry.status]));
    const count = (personId: string, encore: boolean) =>
      pieces.filter(
        (piece) =>
          piece.encore === encore &&
          piece.participants.some((participant) => participant.personId === personId),
      ).length;
    return groupPeople.flatMap((person) => {
      const entry = status.get(person.id);
      return entry && entry !== 'no'
        ? [
            {
              person,
              maybe: entry === 'maybe',
              pieces: count(person.id, false),
              encores: count(person.id, true),
            },
          ]
        : [];
    });
  }, [callUp, groupPeople, pieces]);

  const placed: PlacedPerson[] = useMemo(() => {
    if (!preview) return [];
    const byId = new Map(people.map((item) => [item.person.id, item]));
    return preview.participants.flatMap(({ personId, x, y }) => {
      const item = byId.get(personId);
      return item && x != null && y != null
        ? [{ person: { ...item.person, status: item.maybe ? 'maybe' : 'yes' }, point: { x, y } }]
        : [];
    });
  }, [preview, people]);

  return (
    <div className={styles.root}>
      <Card
        title={performance.title}
        actions={
          <>
            {/* Opens "Exportar PDF" and "Compartir enlace" in phase 3. */}
            <Button disabled title="Exportar PDF y compartir enlace llegan en la fase 3">
              Compartir
            </Button>
            <Button onClick={onEdit}>Editar</Button>
          </>
        }
      >
        <p className={styles.details}>
          {[
            formatDay(performance.date),
            performance.place,
            formatDuration(performance.minMinutes, performance.maxMinutes),
            performance.stageWidth && performance.stageDepth
              ? `Escenario de ${performance.stageWidth} × ${performance.stageDepth} m`
              : null,
            callUp ? `${people.length} convocados` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Sin fecha ni lugar todavía'}
        </p>
        <RepertoireSummaryView
          summary={summary}
          minMinutes={performance.minMinutes}
          maxMinutes={performance.maxMinutes}
        />
      </Card>

      <Foldable title="Piezas" count={pieces.length}>
        {pieces.length ? (
          <ol className={styles.pieces}>
            {[...main, ...encores].map((piece) => (
              <li key={piece.key} className={styles.pieceRow}>
                <button
                  type="button"
                  className={styles.piece}
                  aria-pressed={piece.key === previewKey}
                  onClick={() => setPreviewKey(piece.key === previewKey ? null : piece.key)}
                >
                  <span className={styles.number}>{numberOf(piece)}</span>
                  <span className={styles.pieceTitle}>{piece.title}</span>
                  <span className={styles.pieceMeta}>
                    {PIECE_TYPE_LABELS[piece.type]}
                    {piece.optional && ' · Opcional'}
                    {` · ${piece.participants.length} ${piece.participants.length === 1 ? 'persona' : 'personas'}`}
                    {` · ${piece.duration || 'sin duración'}`}
                  </span>
                </button>
                <Button onClick={() => piece.id && onOpenPiece(piece.id)}>Editar</Button>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.hint}>Sin piezas todavía. Pulsa «Editar» para añadirlas.</p>
        )}
      </Foldable>

      <Foldable title="Personas que vienen" count={people.length}>
        {people.length ? (
          <ul className={styles.people}>
            {people.map(({ person, maybe, pieces: inPieces, encores }) => (
              <li key={person.id} className={styles.person} data-idle={inPieces ? undefined : ''}>
                <PersonChip name={person.name} color={person.mainColor} secondary={maybe} />
                <span className={styles.count}>
                  {pieceCount(inPieces)}
                  {encores > 0 && ` · ${pieceCount(encores, true)}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>Nadie convocado todavía.</p>
        )}
      </Foldable>

      {active && wide && preview && stage && stageView && (
        <StageLayer view={stageView} stage={stage} placed={placed} readOnly />
      )}
    </div>
  );
}

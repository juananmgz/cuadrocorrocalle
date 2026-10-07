import { ChevronDown } from 'lucide-react';
import { type Performance, PIECE_TYPE_LABELS } from '@cuadrocorrocalle/shared';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';

import { useCallUp } from '../../callUps/callUpApi';
import { usePeople } from '../../people/peopleApi';
import { type PieceDraft, toDraft } from '../../pieces/draft';
import { useRepertoire } from '../../pieces/repertoireApi';
import { summarize } from '../../pieces/summary';
import { formatDay } from '../../performances/format';
import { PIECE_SECONDS } from '../../pages/Home/PieceCycle';
import { FROM_TABLET, useMediaQuery } from '../../hooks';
import {
  missingPlaces,
  repeatedPeople,
  repeatedText,
  undecidedPlaces,
  undecidedText,
} from '../../stage/pieceFigures';
import type { StageSize } from '../../stage/placement';
import { PiecePreview, PREVIEW_FADE } from '../PiecePreview/PiecePreview';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { PersonChip } from '../ui/PersonChip/PersonChip';
import styles from './PerformanceSummary.module.scss';
import { RepertoireSummaryView } from './RepertoireSummaryView';

interface PerformanceSummaryProps {
  performance: Performance;
  /** Opens the settings form. */
  onEdit: () => void;
  /** Opens the settings form on its call-up. */
  onEditCallUp: () => void;
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
  /** Shown first inside it, under the title, e.g. filters and "Editar". */
  actions?: ReactNode;
  children: ReactNode;
}

/** A block of the summary that folds away; closed each time the summary opens. */
function Foldable({ title, count, actions, children }: FoldableProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <section className={styles.foldable}>
      {/* The title row holds only the title, its count and the chevron. */}
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
          <ChevronDown
            className={styles.chevron}
            data-open={open ? '' : undefined}
            aria-hidden="true"
          />
        </button>
      </h2>
      <div id={id} className={styles.foldBody} data-open={open ? '' : undefined} inert={!open}>
        <div className={styles.foldInner}>
          {actions && <div className={styles.foldActions}>{actions}</div>}
          {children}
        </div>
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
  onEditCallUp,
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
  // The first piece shows on the stage until another is picked.
  const preview =
    pieces.find((piece) => piece.key === previewKey) ??
    pieces.find((piece) => !piece.encore) ??
    pieces[0] ??
    null;
  const wide = useMediaQuery(FROM_TABLET);
  // The pieces take turns on the stage, from the last back to the first, as on the home page.
  const order = [...main, ...encores];
  const nextKey = preview ? order[(order.indexOf(preview) + 1) % order.length]?.key : undefined;
  // Its fade out is part of its turn, so the next one comes in right on time.
  const [ending, setEnding] = useState(false);
  useEffect(() => {
    if (!active || !wide || !nextKey || order.length < 2) return;
    const fade = window.setTimeout(() => setEnding(true), PIECE_SECONDS * 1000 - PREVIEW_FADE);
    const next = window.setTimeout(() => {
      setPreviewKey(nextKey);
      setEnding(false);
    }, PIECE_SECONDS * 1000);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(next);
    };
  }, [active, wide, nextKey, preview?.key, order.length]);
  const [byGender, setByGender] = useState(false);
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

  /** Who comes, with how many pieces each is in; under a title when split by gender. */
  const peopleList = (list: typeof people, title?: string) => (
    <div className={styles.peopleGroup}>
      {title && (
        <h3 className={styles.groupTitle}>
          {title} <span className={styles.foldCount}>({list.length})</span>
        </h3>
      )}
      <ul className={styles.people}>
        {list.map(({ person, maybe, pieces: inPieces, encores: inEncores }) => (
          <li key={person.id} className={styles.person} data-idle={inPieces ? undefined : ''}>
            <PersonChip name={person.name} color={person.mainColor} secondary={maybe} />
            <span className={styles.count}>
              {pieceCount(inPieces)}
              {inEncores > 0 && ` · ${pieceCount(inEncores, true)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  const undecidedTotal = pieces.reduce((total, piece) => total + undecidedPlaces(piece), 0);

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
            formatDay(performance.date, performance.time),
            performance.place,
            performance.stageWidth && performance.stageDepth
              ? `Escenario de ${performance.stageWidth} × ${performance.stageDepth} m`
              : null,
            callUp ? `${people.length} convocados` : null,
          ]
            .filter(Boolean)
            .join(' · ') || 'Sin fecha ni lugar todavía'}
        </p>
        {/* Places still to be decided between candidates: the performance is not finished. */}
        {undecidedTotal > 0 && (
          <p className={styles.incomplete}>
            Incompleta: {undecidedText(undecidedTotal)} entre candidatos
          </p>
        )}
        <RepertoireSummaryView
          summary={summary}
          minMinutes={performance.minMinutes}
          maxMinutes={performance.maxMinutes}
        />
      </Card>

      <Foldable title="Piezas" count={pieces.length}>
        {pieces.length ? (
          <ol className={styles.pieces}>
            {order.map((piece) => (
              <li
                key={piece.key}
                className={styles.pieceRow}
                data-incomplete={
                  missingPlaces(piece) || repeatedPeople(piece).size || undecidedPlaces(piece)
                    ? ''
                    : undefined
                }
              >
                <button
                  type="button"
                  className={styles.piece}
                  aria-pressed={piece.key === preview?.key}
                  onClick={() => {
                    setPreviewKey(piece.key);
                    setEnding(false);
                  }}
                >
                  <span className={styles.number}>{numberOf(piece)}</span>
                  <span className={styles.pieceTitle}>{piece.title}</span>
                  <span className={styles.pieceMeta}>
                    {PIECE_TYPE_LABELS[piece.type]}
                    {piece.optional && ' · Opcional'}
                    {` · ${piece.participants.length} ${piece.participants.length === 1 ? 'persona' : 'personas'}`}
                    {` · ${piece.duration || 'sin duración'}`}
                  </span>
                  {repeatedPeople(piece).size > 0 && (
                    <span className={styles.repeated}>
                      {repeatedText(repeatedPeople(piece).size)}
                    </span>
                  )}
                  {undecidedPlaces(piece) > 0 && (
                    <span className={styles.missingPlaces}>
                      {undecidedText(undecidedPlaces(piece))}
                    </span>
                  )}
                  {missingPlaces(piece) > 0 && (
                    <span className={styles.missingPlaces}>
                      {missingPlaces(piece)}{' '}
                      {missingPlaces(piece) === 1 ? 'hueco vacío' : 'huecos vacíos'} en sus figuras
                    </span>
                  )}
                </button>
                <Button onClick={() => piece.id && onOpenPiece(piece.id)}>Editar</Button>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.hint}>Sin piezas todavía. Pulsa «Editar» para añadirlas.</p>
        )}
      </Foldable>

      <Foldable
        title="Personas que vienen"
        count={people.length}
        actions={
          <>
            {people.length > 0 && (
              <label className={styles.check}>
                <input type="checkbox" checked={byGender} onChange={() => setByGender(!byGender)} />
                Separar por género
              </label>
            )}
            <Button onClick={onEditCallUp}>Editar</Button>
          </>
        }
      >
        {people.length ? (
          byGender ? (
            <>
              <div className={styles.genders}>
                {peopleList(
                  people.filter(({ person }) => person.figure === 'boy'),
                  'Chicos',
                )}
                {peopleList(
                  people.filter(({ person }) => person.figure === 'girl'),
                  'Chicas',
                )}
              </div>
              {people.some(({ person }) => !person.figure) &&
                peopleList(
                  people.filter(({ person }) => !person.figure),
                  'Sin género',
                )}
            </>
          ) : (
            peopleList(people)
          )
        ) : (
          <p className={styles.hint}>Nadie convocado todavía.</p>
        )}
      </Foldable>

      {active && wide && preview && stage && (
        <PiecePreview
          fadeKey={preview.key}
          fadingOut={ending}
          groupId={performance.groupId}
          performanceId={performance.id}
          piece={preview}
          stage={stage}
        />
      )}
    </div>
  );
}

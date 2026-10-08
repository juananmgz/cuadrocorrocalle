import {
  isSpoken,
  type Performance,
  PIECE_TYPE_LABELS,
  SPOKEN_TAGS,
} from '@cuadrocorrocalle/shared';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { useCallUp } from '../../callUps/callUpApi';
import { usePeople } from '../../people/peopleApi';
import { pieceNumbers, toDraft } from '../../pieces/draft';
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
import { CycleControls } from '../CycleControls/CycleControls';
import { useCycleKeys } from '../CycleControls/useCycleKeys';
import { PiecePreview, PREVIEW_FADE } from '../PiecePreview/PiecePreview';
import { Button } from '../ui/Button/Button';
import { Card } from '../ui/Card/Card';
import { EditButton } from '../ui/EditButton/EditButton';
import { PersonChip } from '../ui/PersonChip/PersonChip';
import styles from './PerformanceSummary.module.scss';
import { RepertoireSummaryView } from './RepertoireSummaryView';

/** The parts of the summary, chosen with the buttons over it, as in the editor. */
export type SummarySection = 'performance' | 'callUp' | 'pieces';

interface PerformanceSummaryProps {
  performance: Performance;
  /** Which part shows: its data, who comes or its pieces. */
  section: SummarySection;
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

interface BlockProps {
  title: string;
  /** Shown next to the title, e.g. how many there are. */
  count?: number;
  /** At the end of the title row, e.g. "Editar". */
  action?: ReactNode;
  /** Under its content, always in view, e.g. a filter. */
  footer?: ReactNode;
  /** A click on it outside its rows (past the end of the list, its edges…). */
  onEmptyClick?: () => void;
  children: ReactNode;
}

/**
 * A part of the summary, as tall as the column: its title row and footer stay in view and only
 * what it holds scrolls.
 */
function Block({ title, count, action, footer, onEmptyClick, children }: BlockProps) {
  return (
    <section
      className={styles.foldable}
      onClick={(event) => {
        if (!(event.target as Element).closest('li, button, a, label, input')) onEmptyClick?.();
      }}
    >
      <div className={styles.blockHead}>
        <h2 className={styles.foldTitle}>
          {title}
          {count !== undefined && <span className={styles.foldCount}> ({count})</span>}
        </h2>
        {action}
      </div>
      <div className={styles.foldInner}>{children}</div>
      {footer && <div className={styles.blockFooter}>{footer}</div>}
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
  section,
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
  const order = [...main, ...encores];
  // 1, 2… in the repertoire and B1, B2… among the encores, as in "Piezas"; spoken ones, none.
  const numbers = pieceNumbers(order);
  // Only pieces with a stage are previewed (voice-overs and talks have none).
  const staged = order.filter((piece) => !isSpoken(piece.type));

  // Clicking a piece previews what it has on the stage, as saved; "Editar" opens it.
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  // A piece clicked stays on the stage (the carousel waits) until it is clicked again.
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  // Going to another part or leaving the summary lets go of it.
  const onPieces = active && section === 'pieces';
  const [wasOnPieces, setWasOnPieces] = useState(onPieces);
  if (onPieces !== wasOnPieces) {
    setWasOnPieces(onPieces);
    if (!onPieces) setPickedKey(null);
  }
  // The first piece shows on the stage until another is picked.
  const preview = staged.find((piece) => piece.key === previewKey) ?? staged[0] ?? null;
  const wide = useMediaQuery(FROM_TABLET);
  // The pieces take turns on the stage, from the last back to the first, as on the home page.
  const nextKey = preview ? staged[(staged.indexOf(preview) + 1) % staged.length]?.key : undefined;
  // Its fade out is part of its turn, so the next one comes in right on time.
  const [ending, setEnding] = useState(false);
  useEffect(() => {
    if (!active || !wide || !nextKey || staged.length < 2 || pickedKey || paused) return;
    const fade = window.setTimeout(() => setEnding(true), PIECE_SECONDS * 1000 - PREVIEW_FADE);
    const next = window.setTimeout(() => {
      setPreviewKey(nextKey);
      setEnding(false);
    }, PIECE_SECONDS * 1000);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(next);
    };
  }, [active, wide, nextKey, preview?.key, staged.length, pickedKey, paused]);
  // Back, pause and on, as on the home page; they let go of a piece picked by a click.
  const go = (by: number) => {
    if (!preview || !staged.length) return;
    const at = (staged.indexOf(preview) + by + staged.length) % staged.length;
    setPickedKey(null);
    setEnding(false);
    setPreviewKey(staged[at]!.key);
  };
  const togglePause = () => {
    setPickedKey(null);
    setEnding(false);
    setPaused((value) => !value);
  };
  useCycleKeys(onPieces && wide && staged.length > 1, {
    onPrevious: () => go(-1),
    onToggle: togglePause,
    onNext: () => go(1),
  });
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
      {section === 'performance' && (
        <Card
          className={styles.performanceCard}
          title={performance.title}
          actions={
            <>
              {/* Opens "Exportar PDF" and "Compartir enlace" in phase 3. */}
              <Button disabled title="Exportar PDF y compartir enlace llegan en la fase 3">
                Compartir
              </Button>
              <EditButton label="Editar la actuación" onClick={onEdit} />
            </>
          }
        >
          {/* One line each: where, when, the stage and how many are called up. */}
          <p className={styles.details}>
            {[
              performance.place,
              formatDay(performance.date, performance.time),
              performance.stageWidth && performance.stageDepth
                ? `Escenario de ${performance.stageWidth} × ${performance.stageDepth} m`
                : null,
              callUp ? `${people.length} convocados` : null,
            ]
              .filter((line): line is string => Boolean(line))
              .map((line) => (
                <span key={line} className={styles.detailLine}>
                  {line}
                </span>
              ))}
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
      )}

      {section === 'pieces' && (
        <Block
          title="Piezas"
          count={pieces.length}
          action={
            wide && staged.length > 1 ? (
              <CycleControls
                paused={paused || Boolean(pickedKey)}
                onPrevious={() => go(-1)}
                onToggle={togglePause}
                onNext={() => go(1)}
              />
            ) : undefined
          }
          onEmptyClick={() => setPickedKey(null)}
        >
          {pieces.length ? (
            <ol className={styles.pieces}>
              {order.map((piece) => (
                <li
                  key={piece.key}
                  className={styles.pieceRow}
                  data-spoken={isSpoken(piece.type) ? '' : undefined}
                  // On the stage by its turn in the carousel, or picked by a click.
                  data-on-show={piece.key === preview?.key && !pickedKey ? '' : undefined}
                  data-picked={piece.key === pickedKey ? '' : undefined}
                  data-incomplete={
                    missingPlaces(piece) || repeatedPeople(piece).size || undecidedPlaces(piece)
                      ? ''
                      : undefined
                  }
                >
                  {/* A voice-over or a talk has no stage to preview: no number, a smaller row. */}
                  {isSpoken(piece.type) ? (
                    <div className={styles.piece}>
                      <span className={styles.spokenTag}>({SPOKEN_TAGS[piece.type]})</span>
                      <span className={styles.pieceTitle}>
                        {piece.title}
                        {piece.duration && (
                          <span className={styles.spokenDuration}> {piece.duration}</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.piece}
                      aria-pressed={piece.key === pickedKey}
                      onClick={() => {
                        const picked = piece.key === pickedKey ? null : piece.key;
                        setPickedKey(picked);
                        if (picked) setPreviewKey(picked);
                        setEnding(false);
                      }}
                    >
                      <span className={styles.number}>{numbers.get(piece.key)}</span>
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
                          {missingPlaces(piece) === 1 ? 'hueco vacío' : 'huecos vacíos'} en sus
                          figuras
                        </span>
                      )}
                    </button>
                  )}
                  <EditButton
                    small
                    label={`Editar «${piece.title}»`}
                    onClick={() => piece.id && onOpenPiece(piece.id)}
                  />
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.hint}>Sin piezas todavía. Pulsa «Editar» para añadirlas.</p>
          )}
        </Block>
      )}

      {section === 'callUp' && (
        <Block
          title="Convocatoria"
          count={people.length}
          action={<EditButton label="Editar la convocatoria" onClick={onEditCallUp} />}
          footer={
            people.length > 0 && (
              <label className={styles.check}>
                <input type="checkbox" checked={byGender} onChange={() => setByGender(!byGender)} />
                Separar por género
              </label>
            )
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
        </Block>
      )}

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

import type { Performance } from '@cuadrocorrocalle/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { authClient, authErrorMessage, VERIFIED_CALLBACK } from '../../auth/authClient';
import { useApp } from '../../components/AppLayout/appContext';
import type { GridStage } from '../../components/GridBackground/GridBackground';
import { Button } from '../../components/ui/Button/Button';
import { useToast } from '../../components/ui/Toast/toastContext';
import { formatDay, formatDuration } from '../../performances/format';
import { usePerformances } from '../../performances/performancesApi';
import { gridStageOf, stageSizeOf } from '../../performances/stageOf';
import type { PieceDraft } from '../../pieces/draft';
import { FROM_TABLET, useMediaQuery } from '../../hooks';
import { PiecePreview } from '../../components/PiecePreview/PiecePreview';
import { StageMeasures } from '../../components/StageMeasures/StageMeasures';
import { StageTools } from '../../components/StageTools/StageTools';
import { useMeasuresOn } from '../../stage/stagePrefs';
import type { CreateFromOnboarding } from '../Onboarding/Onboarding';
import { PerformanceActions } from './PerformanceActions';
import { PieceCycle } from './PieceCycle';
import { PerformanceEditor } from './PerformanceEditor';
import { useColumnInset } from './useColumnInset';
import styles from './Home.module.scss';

// How long the pointer rests on a performance before it is shown big, in ms.
const HOVER_DELAY = 250;

// How many other performances float under the featured one.
const RECENT_COUNT = 4;
// Delay between list items sliding out (and back in), in ms.
const STAGGER = 70;
const SLIDE = 260;

/** Start page: the curved grid with the latest performances floating on the left. */
export function Home() {
  const toast = useToast();
  const { activeGroup, setGrid } = useApp();
  const { data: performances } = usePerformances(activeGroup?.id);
  const [params, setParams] = useSearchParams();
  const { data: session } = authClient.useSession();
  const [resending, setResending] = useState(false);
  // "list" → "leaving" (items slide out one by one) → "create" (form card); back on cancel.
  // The guided start lands here with the first performance's title: the form opens with it.
  const location = useLocation();
  const navigate = useNavigate();
  const [createTitle, setCreateTitle] = useState(
    () => (location.state as CreateFromOnboarding | null)?.createTitle,
  );
  const [mode, setMode] = useState<'list' | 'leaving' | 'create'>(createTitle ? 'create' : 'list');
  const [previewStage, setPreviewStage] = useState<GridStage | null>(null);
  // Sign over the stage with the open piece, while editing the pieces.
  const [pieceLabel, setPieceLabel] = useState<string | null>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const email = session?.user.email ?? '';

  // Featured: the next performance from today, or the most recent one before it.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = performances?.find((item) => item.date && item.date >= today);
  const featured = upcoming ?? performances?.at(-1);
  const others = (performances ?? []).filter((item) => item !== featured).slice(0, RECENT_COUNT);
  const shown = featured ? [featured, ...others] : others;
  // The one shown big, with its pieces taking turns on the stage: the featured one until another
  // is hovered or clicked (without opening it).
  const [chosenId, setChosenId] = useState<string | null>(null);
  const selected = shown.find((item) => item.id === chosenId) ?? featured;
  // The piece on the stage and its performance. Choosing another keeps the stage until its
  // first piece comes, which then fades in where the last one fades out.
  const [onShow, setOnShow] = useState<{ performance: Performance; piece: PieceDraft } | null>(
    null,
  );
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  });
  const showPiece = useCallback((piece: PieceDraft | null) => {
    const performance = selectedRef.current;
    setOnShow(piece && performance ? { performance, piece } : null);
  }, []);
  // The piece on show fading out at the end of its turn.
  const [ending, setEnding] = useState(false);
  const hoverTimer = useRef<number | undefined>(undefined);
  const choose = (id: string) => {
    window.clearTimeout(hoverTimer.current);
    if (id === selected?.id) return;
    setChosenId(id);
  };
  // Resting on one for a moment chooses it, so passing over the list does not jump around.
  const hoverIntent = (id: string) => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => choose(id), HOVER_DELAY);
  };
  const wide = useMediaQuery(FROM_TABLET);
  const measuresOn = useMeasuresOn();
  const showStage = onShow ? stageSizeOf(onShow.performance) : null;
  const showGrid = onShow ? gridStageOf(onShow.performance) : null;

  // On tablets and PCs the grid centres on the space right of the list.
  const inset = useColumnInset(columnRef);

  // Creating moves the camera above the floor and previews the stage; the list shows, seen from
  // the angle of the world, the stage of the performance shown big with its piece and title.
  const listPiece = mode === 'list' && wide && showGrid && onShow ? onShow.piece : null;
  useEffect(() => {
    setGrid(
      mode === 'list'
        ? listPiece
          ? { leftInset: inset, view: 'angled', stage: showGrid, label: listPiece.title }
          : { leftInset: inset }
        : {
            leftInset: inset,
            view: 'top',
            stage: previewStage,
            label: pieceLabel,
          },
    );
    // The grid stage is rebuilt each render; its performance and piece are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, inset, previewStage, setGrid, pieceLabel, listPiece, onShow?.performance.id]);
  useEffect(() => () => setGrid({}), [setGrid]);

  const unverified = Boolean(session && !session.user.emailVerified);
  // The email notice, when shown, slides out first.
  const offset = unverified ? 1 : 0;
  const listCount = offset + shown.length;
  const startCreating = () => {
    setMode('leaving');
    window.setTimeout(() => setMode('create'), listCount * STAGGER + SLIDE);
  };
  const stopCreating = () => {
    setMode('list');
    setPreviewStage(null);
    setPieceLabel(null);
    setCreateTitle(undefined);
  };

  // The title is read once; then it is cleared from the history, so going back does not reopen it.
  useEffect(() => {
    if (createTitle) navigate('.', { replace: true, state: null });
  }, [createTitle, navigate]);

  // The confirmation link lands here with ?correo=confirmado.
  useEffect(() => {
    if (params.get('correo') !== 'confirmado') return;
    toast.show({ title: 'Correo confirmado', tone: 'success' });
    setParams({}, { replace: true });
  }, [params, setParams, toast]);

  const resend = async () => {
    setResending(true);
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: VERIFIED_CALLBACK,
    });
    setResending(false);

    toast.show(
      error
        ? { title: authErrorMessage(error), tone: 'error' }
        : { title: 'Correo enviado', description: `Revisa ${email}.`, tone: 'success' },
    );
  };

  // Each list item slides out to the left in turn when creating, and back in on cancel.
  const slide = (index: number) => ({
    'data-slide': mode === 'list' ? 'in' : 'out',
    style: { transitionDelay: `${index * STAGGER}ms`, animationDelay: `${index * STAGGER}ms` },
  });

  return (
    <div
      ref={columnRef}
      className={styles.column}
      data-wide={mode === 'create' ? '' : undefined}
      data-editor={mode === 'create' ? '' : undefined}
    >
      <h1 className={styles.srOnly}>Inicio</h1>

      {listPiece && onShow && showStage && (
        <PiecePreview
          fadeKey={`${onShow.performance.id}:${listPiece.key}`}
          groupId={onShow.performance.groupId}
          performanceId={onShow.performance.id}
          piece={listPiece}
          stage={showStage}
          fadingOut={ending}
        />
      )}
      {listPiece && showStage && <StageMeasures stage={showStage} shown={measuresOn} perspective />}
      {/* The editor brings its own while creating. */}
      {wide && mode === 'list' && <StageTools />}

      {mode === 'create' && activeGroup && (
        <PerformanceEditor
          groupId={activeGroup.id}
          initialTitle={createTitle}
          onCancel={stopCreating}
          onHome={stopCreating}
          onStageChange={setPreviewStage}
          onPieceLabel={setPieceLabel}
        />
      )}

      {mode !== 'create' && (
        <>
          {unverified && (
            <section className={styles.panel} {...slide(0)}>
              <p className={styles.text}>
                Confirma tu correo con el enlace que te enviamos a <strong>{email}</strong>.
              </p>
              <Button onClick={resend} disabled={resending}>
                {resending ? 'Enviando…' : 'Reenviar correo'}
              </Button>
            </section>
          )}

          {shown.map((performance, index) =>
            performance === selected ? (
              <section
                key={performance.id}
                className={`${styles.panel} ${styles.withActions}`}
                aria-labelledby="featured-title"
                {...slide(offset + index)}
              >
                <PerformanceActions performance={performance} />
                <p className={styles.eyebrow}>
                  {performance !== featured
                    ? 'Actuación'
                    : upcoming
                      ? 'Próxima actuación'
                      : 'Última actuación'}
                </p>
                <h2 id="featured-title" className={styles.featuredTitle}>
                  {performance.title}
                </h2>
                <p className={styles.details}>
                  {[
                    formatDay(performance.date, performance.time),
                    performance.place,
                    formatDuration(performance.minMinutes, performance.maxMinutes),
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Sin fecha ni lugar todavía'}
                </p>
                {/* Its pieces take turns on the stage (on tablets and PCs, where it is seen). */}
                {wide && stageSizeOf(performance) && (
                  <PieceCycle
                    key={performance.id}
                    performanceId={performance.id}
                    onPiece={showPiece}
                    onEnding={setEnding}
                  />
                )}
                <Link to={`/actuaciones/${performance.id}`} className={styles.open}>
                  Abrir
                </Link>
              </section>
            ) : (
              <div
                key={performance.id}
                className={`${styles.withActions} ${styles.compact}`}
                {...slide(offset + index)}
              >
                <PerformanceActions performance={performance} />
                {/* Clicking (or resting on it) shows it big; "Abrir" there opens it. */}
                <button
                  type="button"
                  className={styles.item}
                  onClick={() => choose(performance.id)}
                  onPointerEnter={() => hoverIntent(performance.id)}
                  onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
                >
                  <span className={styles.itemTitle}>{performance.title}</span>
                  <span className={styles.itemDate}>
                    {formatDay(performance.date, performance.time) ?? 'Sin fecha'}
                  </span>
                </button>
              </div>
            ),
          )}

          {performances?.length === 0 && (
            <section className={styles.panel} {...slide(offset)}>
              <p className={styles.text}>
                {activeGroup?.isTrial
                  ? 'En el grupo de prueba puedes montar una actuación con hasta 3 bailes.'
                  : 'Aún no hay actuaciones en este grupo.'}
              </p>
            </section>
          )}

          {activeGroup && (
            <button
              type="button"
              className={styles.create}
              onClick={startCreating}
              disabled={mode !== 'list'}
              {...slide(listCount)}
            >
              <span aria-hidden="true">+</span> Crear actuación
            </button>
          )}
        </>
      )}
    </div>
  );
}

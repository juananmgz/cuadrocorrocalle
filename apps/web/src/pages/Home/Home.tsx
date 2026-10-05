import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';

import { authClient, authErrorMessage, VERIFIED_CALLBACK } from '../../auth/authClient';
import { useApp } from '../../components/AppLayout/appContext';
import type { GridStage } from '../../components/GridBackground/GridBackground';
import { Button } from '../../components/ui/Button/Button';
import { useToast } from '../../components/ui/Toast/toastContext';
import { formatDay, formatDuration } from '../../performances/format';
import { usePerformances } from '../../performances/performancesApi';
import type { CreateFromOnboarding } from '../Onboarding/Onboarding';
import { PerformanceActions } from './PerformanceActions';
import { PerformanceEditor } from './PerformanceEditor';
import { useColumnInset } from './useColumnInset';
import styles from './Home.module.scss';

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

  // On tablets and PCs the grid centres on the space right of the list.
  const inset = useColumnInset(columnRef);

  // Creating moves the camera above the floor and previews the stage.
  useEffect(() => {
    setGrid(
      mode === 'list'
        ? { leftInset: inset }
        : {
            leftInset: inset,
            view: 'top',
            stage: previewStage,
            label: pieceLabel,
          },
    );
  }, [mode, inset, previewStage, setGrid, pieceLabel]);
  useEffect(() => () => setGrid({}), [setGrid]);

  const unverified = Boolean(session && !session.user.emailVerified);
  // The email notice, when shown, slides out first.
  const offset = unverified ? 1 : 0;
  const listCount = offset + (featured ? 1 : 0) + others.length;
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

          {featured && (
            <section
              className={`${styles.panel} ${styles.withActions}`}
              aria-labelledby="featured-title"
              {...slide(offset)}
            >
              <PerformanceActions performance={featured} />
              <p className={styles.eyebrow}>
                {upcoming ? 'Próxima actuación' : 'Última actuación'}
              </p>
              <h2 id="featured-title" className={styles.featuredTitle}>
                {featured.title}
              </h2>
              <p className={styles.details}>
                {[
                  formatDay(featured.date),
                  featured.place,
                  formatDuration(featured.minMinutes, featured.maxMinutes),
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Sin fecha ni lugar todavía'}
              </p>
              <Link to={`/actuaciones/${featured.id}`} className={styles.open}>
                Abrir
              </Link>
            </section>
          )}

          {others.length > 0 && (
            <ul className={styles.others} aria-label="Otras actuaciones">
              {others.map((performance, index) => (
                <li
                  key={performance.id}
                  className={styles.withActions}
                  {...slide(offset + index + (featured ? 1 : 0))}
                >
                  <PerformanceActions performance={performance} />
                  <Link to={`/actuaciones/${performance.id}`} className={styles.item}>
                    <span className={styles.itemTitle}>{performance.title}</span>
                    <span className={styles.itemDate}>
                      {formatDay(performance.date) ?? 'Sin fecha'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
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

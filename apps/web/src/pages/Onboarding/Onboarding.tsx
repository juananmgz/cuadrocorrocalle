import type { GridColor } from '@cuadrocorrocalle/shared';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';

import { useApp } from '../../components/AppLayout/appContext';
import { GridColorPicker } from '../../components/GroupForms/GridColorPicker';
import { PasteNamesDialog } from '../../components/PasteNamesDialog/PasteNamesDialog';
import { Button } from '../../components/ui/Button/Button';
import { TextField } from '../../components/ui/TextField/TextField';
import { useUpdateGroup } from '../../groups/groupsApi';
import { usePeople, usePeopleMutations } from '../../people/peopleApi';
import { cleanText } from '../../performances/sanitize';
import styles from './Onboarding.module.scss';

const STEPS = 3;

/** Where the first performance starts: the home page opens its form with this title. */
export interface CreateFromOnboarding {
  createTitle: string;
}

/**
 * Guided start for a new account (step 1.13): the group's name, its people and the first
 * performance, instead of an empty page. Every step can be left for later.
 */
export function Onboarding() {
  const navigate = useNavigate();
  const { activeGroup } = useApp();
  const updateGroup = useUpdateGroup();
  const { data: people = [] } = usePeople(activeGroup?.id);
  const peopleMutations = usePeopleMutations(activeGroup?.id ?? '');
  const [step, setStep] = useState(1);
  const [color, setColor] = useState<GridColor>(activeGroup?.gridColor ?? 'azul');
  const [pasting, setPasting] = useState(false);
  const [title, setTitle] = useState('');

  if (!activeGroup) return null;

  const saveGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get('name')).trim();
    updateGroup.mutate(
      { id: activeGroup.id, name: name || activeGroup.name, gridColor: color },
      { onSuccess: () => setStep(2) },
    );
  };

  const startPerformance = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate('/inicio', {
      replace: true,
      state: { createTitle: title.trim() } satisfies CreateFromOnboarding,
    });
  };

  const finish = () => navigate('/inicio', { replace: true });

  return (
    <section className={styles.root} aria-labelledby="onboarding-title">
      <p className={styles.progress} aria-live="polite">
        Paso {step} de {STEPS}
      </p>
      <ol className={styles.dots} aria-hidden="true">
        {Array.from({ length: STEPS }, (_, index) => (
          <li key={index} data-done={index < step ? '' : undefined} />
        ))}
      </ol>

      {step === 1 && (
        <form className={styles.step} onSubmit={saveGroup}>
          <h1 id="onboarding-title" className={styles.title}>
            ¿Cómo se llama vuestro grupo?
          </h1>
          <p className={styles.text}>Puedes cambiarlo cuando quieras desde «Mi grupo».</p>
          <TextField
            label="Nombre del grupo"
            name="name"
            maxLength={60}
            autoFocus
            placeholder="Coros de Pasarón"
            error={updateGroup.error?.message}
          />
          <GridColorPicker value={color} onChange={setColor} />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={() => setStep(2)}>
              Saltar
            </Button>
            <Button type="submit" variant="primary" disabled={updateGroup.isPending}>
              {updateGroup.isPending ? 'Guardando…' : 'Continuar'}
            </Button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className={styles.step}>
          <h1 id="onboarding-title" className={styles.title}>
            ¿Quiénes sois?
          </h1>
          <p className={styles.text}>
            Pega la lista de nombres del grupo, de golpe. Después puedes añadir, quitar o completar
            a cada persona en «Mi grupo».
          </p>
          {people.length > 0 && (
            <p className={styles.done}>
              {people.length} {people.length === 1 ? 'persona' : 'personas'} en el grupo.
            </p>
          )}
          <Button onClick={() => setPasting(true)}>
            {people.length ? 'Pegar más nombres' : 'Pegar la lista'}
          </Button>
          <div className={styles.actions}>
            {people.length === 0 && (
              <Button variant="ghost" onClick={() => setStep(3)}>
                Lo haré luego
              </Button>
            )}
            <Button variant="primary" onClick={() => setStep(3)}>
              Continuar
            </Button>
          </div>
          <PasteNamesDialog
            open={pasting}
            onOpenChange={setPasting}
            mutations={peopleMutations}
            groupName={activeGroup.name}
            currentCount={people.length}
          />
        </div>
      )}

      {step === 3 && (
        <form className={styles.step} onSubmit={startPerformance}>
          <h1 id="onboarding-title" className={styles.title}>
            Vuestra primera actuación
          </h1>
          <p className={styles.text}>
            Ponle un nombre; después eliges el escenario, quién viene y el repertorio.
          </p>
          <TextField
            label="Título de la actuación"
            maxLength={120}
            autoFocus
            placeholder="Fiestas de San Juan"
            value={title}
            onChange={(event) => setTitle(cleanText(event.target.value))}
          />
          <div className={styles.actions}>
            <Button variant="ghost" onClick={finish}>
              Lo haré luego
            </Button>
            <Button type="submit" variant="primary" disabled={!title.trim()}>
              Empezar la actuación
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

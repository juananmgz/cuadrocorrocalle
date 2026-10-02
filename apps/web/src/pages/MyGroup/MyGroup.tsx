import { colorForIndex, type Person } from '@cuadrocorrocalle/shared';
import { useState } from 'react';

import { useApp } from '../../components/AppLayout/appContext';
import { PasteNamesDialog } from '../../components/PasteNamesDialog/PasteNamesDialog';
import { PersonDialog } from '../../components/PersonDialog/PersonDialog';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { PersonChip } from '../../components/ui/PersonChip/PersonChip';
import { GRID_COLOR_LABELS, gridColorVar } from '../../groups/gridColors';
import { FIGURE_LABELS, usePeople, usePeopleMutations } from '../../people/peopleApi';
import styles from './MyGroup.module.scss';

/** "Mi grupo": the group's information and its people (OA-01). */
export function MyGroup() {
  const { activeGroup } = useApp();

  return (
    <>
      <h1 className={styles.title}>Mi grupo</h1>
      {activeGroup && <GroupPeople key={activeGroup.id} groupId={activeGroup.id} />}
    </>
  );
}

function GroupPeople({ groupId }: { groupId: string }) {
  const { activeGroup } = useApp();
  const { data: people, isPending } = usePeople(groupId);
  const mutations = usePeopleMutations(groupId);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);
  const [pasting, setPasting] = useState(false);
  const group = activeGroup!;
  const count = people?.length ?? 0;

  return (
    <>
      <Card title="Información">
        <dl className={styles.info}>
          <div>
            <dt>Nombre</dt>
            <dd>{group.name}</dd>
          </div>
          <div>
            <dt>Cuadrícula</dt>
            <dd>
              <span
                className={styles.swatch}
                style={{ background: gridColorVar(group.gridColor) }}
                aria-hidden="true"
              />
              {GRID_COLOR_LABELS[group.gridColor]}
            </dd>
          </div>
          <div>
            <dt>Licencia</dt>
            <dd>{group.isTrial ? 'Grupo de prueba' : 'Sin licencia'}</dd>
          </div>
          <div>
            <dt>Personas</dt>
            <dd>{isPending ? '…' : count}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Personas">
        <div className={styles.toolbar}>
          <Button variant="primary" onClick={() => setEditing('new')}>
            Añadir persona
          </Button>
          <Button onClick={() => setPasting(true)}>Pegar lista</Button>
        </div>
        {people && people.length === 0 && (
          <p className={styles.empty}>
            Aún no hay nadie. Añade a las personas una a una o pega la lista del grupo.
          </p>
        )}
        {people && people.length > 0 && (
          <ul className={styles.people}>
            {people.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  className={styles.person}
                  onClick={() => setEditing(person)}
                  aria-label={`Editar ${person.name}`}
                >
                  <PersonChip name={person.name} color={person.mainColor} />
                  <span className={styles.figure} data-missing={person.figure ? undefined : ''}>
                    {person.figure ? FIGURE_LABELS[person.figure] : 'Sin muñeco'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PersonDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        person={editing && editing !== 'new' ? editing : undefined}
        defaultColor={colorForIndex(count)}
        mutations={mutations}
      />
      <PasteNamesDialog open={pasting} onOpenChange={setPasting} mutations={mutations} />
    </>
  );
}

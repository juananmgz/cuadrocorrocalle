import { Pencil } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { Card } from '../../components/ui/Card/Card';
import { setActiveGroupId, useActiveGroupId } from '../../groups/activeGroup';
import { useGroups } from '../../groups/groupsApi';
import { GroupSquare } from './GroupSquare';
import styles from './Groups.module.scss';

/** "Elegir grupo", a page of its own styled after Chrome's profile picker. */
export function ChooseGroup() {
  const navigate = useNavigate();
  const { data } = useGroups();
  const activeId = useActiveGroupId();

  return (
    <>
      <h1 className={styles.title}>Elegir grupo</h1>
      <Card>
        <p className={styles.lead}>¿Con qué grupo vas a trabajar?</p>
        <ul className={styles.tiles}>
          {data?.groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                className={styles.tile}
                aria-current={group.id === activeId ? 'true' : undefined}
                onClick={() => {
                  setActiveGroupId(group.id);
                  navigate('/inicio');
                }}
              >
                <GroupSquare group={group} />
                <span className={styles.name}>{group.name}</span>
              </button>
            </li>
          ))}
          {/* Names, colours, adding and deleting groups: all on a page of its own. */}
          <li>
            <Link to="/grupos/editar" className={styles.tile}>
              <span className={styles.tag} aria-hidden="true" />
              <span className={styles.square} data-modify="">
                <Pencil size={28} aria-hidden="true" />
              </span>
              <span className={styles.name}>Modificar</span>
            </Link>
          </li>
        </ul>
      </Card>
    </>
  );
}

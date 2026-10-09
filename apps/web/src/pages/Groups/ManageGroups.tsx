import type { Group } from '@cuadrocorrocalle/shared';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { DeleteGroupForm, GroupForm } from '../../components/GroupForms/GroupForms';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { useToast } from '../../components/ui/Toast/toastContext';
import { clearActiveGroup, useActiveGroupId } from '../../groups/activeGroup';
import { licenseQuotaText, useGroups } from '../../groups/groupsApi';
import { GroupSquare } from './GroupSquare';
import styles from './Groups.module.scss';

// What is open on the page: one group's form, its deletion, or a new group.
type Open = { kind: 'edit' | 'delete'; id: string } | { kind: 'add' } | null;

/** "Modificar grupos": change their names and colours, delete them or add a new one. */
export function ManageGroups() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data } = useGroups();
  const activeId = useActiveGroupId();
  const [open, setOpen] = useState<Open>(null);
  const isOpen = (kind: 'edit' | 'delete', group: Group) =>
    open?.kind === kind && open.id === group.id;
  const toggle = (kind: 'edit' | 'delete', group: Group) =>
    setOpen(isOpen(kind, group) ? null : { kind, id: group.id });

  return (
    <>
      <Link to="/grupos" className={styles.back}>
        <ArrowLeft size={16} aria-hidden="true" /> Elegir grupo
      </Link>
      <h1 className={styles.title}>Modificar grupos</h1>
      <Card>
        <ul className={styles.rows}>
          {data?.groups.map((group) => (
            <li key={group.id} className={styles.row}>
              <div className={styles.rowHead}>
                <span className={styles.rowSquare}>
                  <GroupSquare group={group} small />
                </span>
                <span className={styles.rowName}>{group.name}</span>
                <span className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.icon}
                    aria-label={`Editar ${group.name}`}
                    title="Editar nombre y color"
                    aria-expanded={isOpen('edit', group)}
                    onClick={() => toggle('edit', group)}
                  >
                    <Pencil size={18} aria-hidden="true" />
                  </button>
                  {/* The trial group cannot be deleted. */}
                  {!group.isTrial && (
                    <button
                      type="button"
                      className={styles.icon}
                      data-danger=""
                      aria-label={`Borrar ${group.name}`}
                      title="Borrar grupo"
                      aria-expanded={isOpen('delete', group)}
                      onClick={() => toggle('delete', group)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  )}
                </span>
              </div>
              {isOpen('edit', group) && (
                <GroupForm
                  group={group}
                  submitLabel="Guardar"
                  onCancel={() => setOpen(null)}
                  onSaved={() => setOpen(null)}
                />
              )}
              {isOpen('delete', group) && (
                <DeleteGroupForm
                  group={group}
                  onCancel={() => setOpen(null)}
                  onDeleted={() => {
                    if (group.id === activeId) clearActiveGroup();
                    toast.show({ title: `«${group.name}» borrado`, tone: 'success' });
                    setOpen(null);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
        {/* Later on, a new group will ask for its licence key here. */}
        {open?.kind === 'add' ? (
          <GroupForm
            submitLabel="Añadir grupo"
            onCancel={() => setOpen(null)}
            onSaved={(group) => {
              toast.show({ title: `«${group.name}» añadido`, tone: 'success' });
              setOpen(null);
            }}
          />
        ) : (
          <button type="button" className={styles.add} onClick={() => setOpen({ kind: 'add' })}>
            <Plus size={18} aria-hidden="true" /> Añadir grupo
          </button>
        )}
        <div className={styles.footer}>
          <p className={styles.quota}>
            {licenseQuotaText(data ? data.licenses.groupsAvailable : 0)}
          </p>
          <Button variant="primary" onClick={() => navigate('/grupos')}>
            Listo
          </Button>
        </div>
      </Card>
    </>
  );
}

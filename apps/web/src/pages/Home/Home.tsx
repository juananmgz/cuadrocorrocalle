import type { Group } from '@cuadrocorrocalle/shared';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { authClient, authErrorMessage, VERIFIED_CALLBACK } from '../../auth/authClient';
import { GridBackground } from '../../components/GridBackground/GridBackground';
import { GroupChooser } from '../../components/GroupChooser/GroupChooser';
import { TopBar } from '../../components/TopBar/TopBar';
import { Button } from '../../components/ui/Button/Button';
import { Card } from '../../components/ui/Card/Card';
import { useToast } from '../../components/ui/Toast/toastContext';
import { clearActiveGroup, setActiveGroupId, useActiveGroupId } from '../../groups/activeGroup';
import { useGroups } from '../../groups/groupsApi';
import styles from './Home.module.scss';

/** Signed-in start page; performances arrive in later steps. */
export function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: session } = authClient.useSession();
  const { data } = useGroups();
  const groups = data?.groups;
  const activeId = useActiveGroupId();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const name = session?.user.name ?? '';
  const email = session?.user.email ?? '';
  const activeGroup = groups?.find((group) => group.id === activeId);

  // With a single group there is nothing to choose.
  useEffect(() => {
    if (groups?.length === 1 && !activeGroup) setActiveGroupId(groups[0]!.id);
  }, [groups, activeGroup]);

  // The grid takes the active group's colour.
  useEffect(() => {
    if (!activeGroup) return;
    document.documentElement.dataset.grid = activeGroup.gridColor;
    return () => {
      delete document.documentElement.dataset.grid;
    };
  }, [activeGroup]);

  // The confirmation link lands here with ?correo=confirmado.
  useEffect(() => {
    if (params.get('correo') !== 'confirmado') return;
    toast.show({ title: 'Correo confirmado', tone: 'success' });
    setParams({}, { replace: true });
  }, [params, setParams, toast]);

  const mustChoose = Boolean(groups && groups.length > 1 && !activeGroup);

  const choose = (group: Group) => {
    setActiveGroupId(group.id);
    setChooserOpen(false);
  };

  const signOut = async () => {
    await authClient.signOut();
    clearActiveGroup();
    navigate('/entrar', { replace: true });
  };

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

  return (
    <div className={styles.root}>
      <GridBackground />
      <TopBar
        groupName={activeGroup?.name}
        onGroupClick={() => setChooserOpen(true)}
        userName={name || '?'}
        userMenuItems={[{ label: 'Cerrar sesión', onSelect: signOut, danger: true }]}
      />
      {data && groups && (
        <GroupChooser
          open={chooserOpen || mustChoose}
          onOpenChange={setChooserOpen}
          groups={groups}
          groupsAvailable={data.licenses.groupsAvailable}
          activeId={activeId}
          onChoose={choose}
          dismissable={!mustChoose}
        />
      )}
      <main className={styles.main}>
        <h1 className={styles.title}>Hola, {name.split(' ')[0]}</h1>
        {session && !session.user.emailVerified && (
          <Card title="Confirma tu correo">
            <p className={styles.text}>
              Te hemos enviado un enlace a <strong>{email}</strong>. Ábrelo para confirmar que el
              correo es tuyo.
            </p>
            <Button onClick={resend} disabled={resending}>
              {resending ? 'Enviando…' : 'Reenviar correo'}
            </Button>
          </Card>
        )}
        {activeGroup && (
          <Card title={activeGroup.name}>
            <p className={styles.text}>
              {activeGroup.isTrial
                ? 'Este es tu grupo de prueba: podrás montar una actuación con hasta 3 bailes.'
                : 'Aquí irán tus personas y tus actuaciones en los próximos pasos.'}
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}

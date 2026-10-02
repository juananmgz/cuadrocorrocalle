import type { Group } from '@cuadrocorrocalle/shared';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';

import { authClient } from '../../auth/authClient';
import { RequireAuth } from '../../auth/RequireAuth';
import { clearActiveGroup, setActiveGroupId, useActiveGroupId } from '../../groups/activeGroup';
import { useGroups } from '../../groups/groupsApi';
import { GridBackground } from '../GridBackground/GridBackground';
import { GroupChooser } from '../GroupChooser/GroupChooser';
import { TopBar } from '../TopBar/TopBar';
import styles from './AppLayout.module.scss';
import type { AppContext } from './appContext';

/** Frame for signed-in pages: grid, top bar and the active group with its chooser. */
export function AppLayout() {
  return (
    <RequireAuth>
      <SignedInLayout />
    </RequireAuth>
  );
}

function SignedInLayout() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const { data } = useGroups();
  const activeId = useActiveGroupId();
  const [chooserOpen, setChooserOpen] = useState(false);
  const groups = data?.groups;
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

  return (
    <div className={styles.root}>
      <GridBackground />
      <TopBar
        groupName={activeGroup?.name}
        onGroupClick={() => setChooserOpen(true)}
        userName={session?.user.name || '?'}
        userEmail={session?.user.email}
        userMenuItems={[
          { label: 'Mi cuenta', onSelect: () => navigate('/cuenta') },
          { label: 'Ajustes', onSelect: () => navigate('/ajustes') },
          { label: 'Cerrar sesión', onSelect: signOut, danger: true },
        ]}
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
        <Outlet context={{ activeGroup, signOut } satisfies AppContext} />
      </main>
    </div>
  );
}

import { APP_NAME } from '@cuadrocorrocalle/shared';
import { Link } from 'react-router';

import { GroupBox } from '../GroupBox/GroupBox';
import { SideMenu } from '../SideMenu/SideMenu';
import { Menu, type MenuItem } from '../ui/Menu/Menu';
import styles from './TopBar.module.scss';

interface TopBarProps {
  groupName?: string;
  onGroupClick?: () => void;
  userName: string;
  userEmail?: string;
  /** Items of the user menu on tablets and PCs. */
  userMenuItems: MenuItem[];
}

export function TopBar({
  groupName,
  onGroupClick,
  userName,
  userEmail,
  userMenuItems,
}: TopBarProps) {
  return (
    <header className={styles.root}>
      <Link to="/" className={styles.brand}>
        {APP_NAME}
      </Link>
      {/* Phones get the hamburger menu; tablets and PCs the group box and user menu. */}
      <div className={styles.mobile}>
        <SideMenu
          groupName={groupName}
          onGroupClick={onGroupClick}
          userName={userName}
          userEmail={userEmail}
        />
      </div>
      <div className={styles.actions}>
        {groupName && <GroupBox name={groupName} onClick={onGroupClick} />}
        <Menu
          items={userMenuItems}
          trigger={
            <button type="button" className={styles.user} aria-label={`Menú de ${userName}`}>
              {userName.slice(0, 1).toUpperCase()}
            </button>
          }
        />
      </div>
    </header>
  );
}

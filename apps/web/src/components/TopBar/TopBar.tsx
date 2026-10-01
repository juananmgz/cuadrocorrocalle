import { Link } from 'react-router';

import { THEME_OPTIONS, type ThemePreference, useThemePreference } from '../../theme/theme';
import { Menu, type MenuItem } from '../ui/Menu/Menu';
import styles from './TopBar.module.scss';

interface TopBarProps {
  groupName?: string;
  onGroupClick?: () => void;
  userName: string;
  userMenuItems: MenuItem[];
}

export function TopBar({ groupName, onGroupClick, userName, userMenuItems }: TopBarProps) {
  const [theme, setTheme] = useThemePreference();

  return (
    <header className={styles.root}>
      <Link to="/" className={styles.brand}>
        3C Folk
      </Link>
      <div className={styles.actions}>
        {groupName && (
          <button type="button" className={styles.group} onClick={onGroupClick}>
            <span className={styles.groupLabel}>Grupo</span>
            <span className={styles.groupName}>{groupName}</span>
          </button>
        )}
        <Menu
          items={userMenuItems}
          radioGroups={[
            {
              label: 'Tema',
              value: theme,
              options: THEME_OPTIONS,
              onValueChange: (value) => setTheme(value as ThemePreference),
            },
          ]}
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

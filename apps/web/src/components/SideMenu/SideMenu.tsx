import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router';

import { GroupBox } from '../GroupBox/GroupBox';
import { ACCOUNT_LINKS, SECTIONS } from '../navigation';
import styles from './SideMenu.module.scss';

interface SideMenuProps {
  groupName?: string;
  onGroupClick?: () => void;
  userName: string;
  userEmail?: string;
}

const LINKS = [...SECTIONS, ...ACCOUNT_LINKS];

/** Mobile hamburger menu: user, group box, then the app's sections. */
export function SideMenu({ groupName, onGroupClick, userName, userEmail }: SideMenuProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={styles.trigger} aria-label="Abrir menú">
          <span className={styles.bars} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined}>
          <Dialog.Title className={styles.srOnly}>Menú</Dialog.Title>
          <div className={styles.header}>
            <div className={styles.user}>
              <span className={styles.avatar} aria-hidden="true">
                {userName.slice(0, 1).toUpperCase()}
              </span>
              <span className={styles.identity}>
                <span className={styles.name}>{userName}</span>
                {userEmail && <span className={styles.email}>{userEmail}</span>}
              </span>
            </div>
            <Dialog.Close className={styles.close} aria-label="Cerrar menú">
              <X size={20} aria-hidden="true" />
            </Dialog.Close>
          </div>

          {groupName && (
            <GroupBox
              name={groupName}
              onClick={() => {
                // Closes the panel first so "Elegir grupo" is not hidden behind it.
                close();
                onGroupClick?.();
              }}
            />
          )}

          <hr className={styles.divider} />

          <nav aria-label="Secciones">
            <ul className={styles.links}>
              {LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink to={link.to} className={styles.link} onClick={close}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

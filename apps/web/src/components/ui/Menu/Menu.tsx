import { DropdownMenu } from 'radix-ui';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

import styles from './Menu.module.scss';

export interface MenuItem {
  label: string;
  /** Shown instead of the label (e.g. a person's chip); the label is still what is read. */
  content?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Single-choice section shown above the regular items. */
export interface MenuRadioGroup {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
}

/** Items under a title of their own, after the regular items. */
export interface MenuSection {
  label: string;
  items: MenuItem[];
}

interface MenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  radioGroups?: MenuRadioGroup[];
  sections?: MenuSection[];
  /** Shown when there are no items at all. */
  empty?: string;
  align?: 'start' | 'center' | 'end';
}

export function Menu({
  trigger,
  items,
  radioGroups = [],
  sections = [],
  empty,
  align = 'end',
}: MenuProps) {
  const item = (entry: MenuItem) => (
    <DropdownMenu.Item
      key={entry.label}
      className={styles.item}
      data-danger={entry.danger ? '' : undefined}
      disabled={entry.disabled}
      onSelect={entry.onSelect}
      textValue={entry.label}
      data-rich={entry.content ? '' : undefined}
    >
      {entry.content ?? entry.label}
    </DropdownMenu.Item>
  );
  const shown = sections.filter((section) => section.items.length);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={sections.length ? `${styles.content} ${styles.long}` : styles.content}
          align={align}
          sideOffset={4}
        >
          {radioGroups.map((group) => (
            <DropdownMenu.Group key={group.label}>
              <DropdownMenu.Label className={styles.label}>{group.label}</DropdownMenu.Label>
              <DropdownMenu.RadioGroup value={group.value} onValueChange={group.onValueChange}>
                {group.options.map((option) => (
                  <DropdownMenu.RadioItem
                    key={option.value}
                    value={option.value}
                    className={styles.item}
                    onSelect={(event) => event.preventDefault()}
                  >
                    <span className={styles.check} aria-hidden="true">
                      <DropdownMenu.ItemIndicator>
                        <Check size={16} />
                      </DropdownMenu.ItemIndicator>
                    </span>
                    {option.label}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
              <DropdownMenu.Separator className={styles.separator} />
            </DropdownMenu.Group>
          ))}
          {items.map(item)}
          {shown.map((section) => (
            <DropdownMenu.Group key={section.label}>
              <DropdownMenu.Label className={styles.label}>{section.label}</DropdownMenu.Label>
              {section.items.map(item)}
            </DropdownMenu.Group>
          ))}
          {empty && !items.length && !shown.length && <p className={styles.empty}>{empty}</p>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

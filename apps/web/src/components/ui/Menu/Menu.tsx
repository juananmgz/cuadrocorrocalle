import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';

import styles from './Menu.module.scss';

export interface MenuItem {
  label: string;
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

interface MenuProps {
  trigger: ReactNode;
  items: MenuItem[];
  radioGroups?: MenuRadioGroup[];
  align?: 'start' | 'center' | 'end';
}

export function Menu({ trigger, items, radioGroups = [], align = 'end' }: MenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.content} align={align} sideOffset={4}>
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
                      <DropdownMenu.ItemIndicator>✓</DropdownMenu.ItemIndicator>
                    </span>
                    {option.label}
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
              <DropdownMenu.Separator className={styles.separator} />
            </DropdownMenu.Group>
          ))}
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              className={styles.item}
              data-danger={item.danger ? '' : undefined}
              disabled={item.disabled}
              onSelect={item.onSelect}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

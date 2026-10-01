import { Tabs as RadixTabs } from 'radix-ui';
import type { ReactNode } from 'react';

import styles from './Tabs.module.scss';

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  label: string;
  defaultValue?: string;
}

export function Tabs({ items, label, defaultValue = items[0]?.value }: TabsProps) {
  return (
    <RadixTabs.Root className={styles.root} defaultValue={defaultValue}>
      <RadixTabs.List className={styles.list} aria-label={label}>
        {items.map((item) => (
          <RadixTabs.Trigger key={item.value} value={item.value} className={styles.trigger}>
            {item.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content key={item.value} value={item.value} className={styles.content}>
          {item.content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}

import { DropdownMenu } from 'radix-ui';

import styles from './FilterMenu.module.scss';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterMenuProps<T extends string> {
  label: string;
  options: FilterOption<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
}

/** Button that opens a list of options to show or hide; every option starts on. */
export function FilterMenu<T extends string>({
  label,
  options,
  selected,
  onChange,
}: FilterMenuProps<T>) {
  const all = selected.length === options.length;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={styles.trigger} data-filtered={all ? undefined : ''}>
          {label}
          {!all && <span className={styles.count}>{selected.length}</span>}
          <span aria-hidden="true">▾</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.content} align="start" sideOffset={4}>
          {options.map((option) => (
            <DropdownMenu.CheckboxItem
              key={option.value}
              className={styles.item}
              checked={selected.includes(option.value)}
              // Keeps the menu open to change several options.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) =>
                onChange(
                  options
                    .map((item) => item.value)
                    .filter((value) =>
                      value === option.value ? checked : selected.includes(value),
                    ),
                )
              }
            >
              <span className={styles.check} aria-hidden="true">
                <DropdownMenu.ItemIndicator>✓</DropdownMenu.ItemIndicator>
              </span>
              {option.label}
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

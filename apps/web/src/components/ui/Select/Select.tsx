import { Label, Select as RadixSelect } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { useId } from 'react';

import { LabelText } from '../LabelText/LabelText';
import styles from './Select.module.scss';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onValueChange?: (value: string) => void;
}

export function Select({
  label,
  options,
  placeholder = 'Elige una opción',
  ...props
}: SelectProps) {
  const id = useId();

  return (
    <div className={styles.root}>
      <Label.Root className={styles.label} htmlFor={id}>
        <LabelText text={label} />
      </Label.Root>
      <RadixSelect.Root {...props}>
        <RadixSelect.Trigger id={id} className={styles.trigger}>
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon className={styles.icon}>
            <ChevronDown size={16} aria-hidden="true" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content className={styles.content} position="popper" sideOffset={4}>
            <RadixSelect.Viewport className={styles.viewport}>
              {options.map((option) => (
                <RadixSelect.Item key={option.value} value={option.value} className={styles.item}>
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className={styles.indicator}>
                    <Check size={16} aria-hidden="true" />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </div>
  );
}

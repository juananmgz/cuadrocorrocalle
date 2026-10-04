import { type Figure, PERSON_ROLES, type PersonRole, ROLE_LABELS } from '@cuadrocorrocalle/shared';
import { RadioGroup } from 'radix-ui';

import { FIGURE_LABELS } from '../../people/peopleApi';
import styles from './PersonFields.module.scss';

interface GenderToggleProps {
  value: Figure | null;
  onChange: (figure: Figure) => void;
  /** Accessible name: the id of a visible label or a text. */
  labelledBy?: string;
  label?: string;
  compact?: boolean;
}

/** Chico or chica, as two toggle buttons. */
export function GenderToggle({ value, onChange, labelledBy, label, compact }: GenderToggleProps) {
  return (
    <RadioGroup.Root
      className={styles.genders}
      data-compact={compact ? '' : undefined}
      aria-labelledby={labelledBy}
      aria-label={label}
      orientation="horizontal"
      value={value ?? ''}
      onValueChange={(next) => onChange(next as Figure)}
    >
      {(Object.keys(FIGURE_LABELS) as Figure[]).map((id) => (
        <RadioGroup.Item key={id} value={id} className={styles.toggle}>
          {FIGURE_LABELS[id]}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}

interface RoleTogglesProps {
  value: PersonRole[];
  onChange: (roles: PersonRole[]) => void;
  labelledBy?: string;
  label?: string;
  compact?: boolean;
}

/** Baile, música and canto; several can be on, always kept in the same order. */
export function RoleToggles({ value, onChange, labelledBy, label, compact }: RoleTogglesProps) {
  const toggle = (role: PersonRole) =>
    onChange(
      value.includes(role)
        ? value.filter((item) => item !== role)
        : PERSON_ROLES.filter((item) => item === role || value.includes(item)),
    );

  return (
    <div
      className={styles.roles}
      data-compact={compact ? '' : undefined}
      role="group"
      aria-labelledby={labelledBy}
      aria-label={label}
    >
      {PERSON_ROLES.map((role) => (
        <button
          key={role}
          type="button"
          className={styles.toggle}
          aria-pressed={value.includes(role)}
          onClick={() => toggle(role)}
        >
          {ROLE_LABELS[role]}
        </button>
      ))}
    </div>
  );
}

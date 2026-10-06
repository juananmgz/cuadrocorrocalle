import { Label } from 'radix-ui';
import { Minus, Plus, X } from 'lucide-react';
import { type KeyboardEvent, useId, useState } from 'react';

import styles from './TagField.module.scss';

interface TagFieldProps {
  label: string;
  /** The tags, in order; with `counted`, a tag repeated means it is needed that many times. */
  values: string[];
  onChange: (values: string[]) => void;
  hint?: string;
  placeholder?: string;
  /** Tags offered while typing, in a list under the field. */
  suggestions?: string[];
  /** Title of that list. */
  suggestionsTitle?: string;
  /** Repeated tags show once with how many there are, and − and + to change it. */
  counted?: boolean;
  /** Most tags allowed (counting repeats), and longest one. */
  max?: number;
  maxLength?: number;
  /** Just the text, without a box or a visible label (e.g. a new row's name). */
  inline?: boolean;
  autoFocus?: boolean;
  /** Escape, or leaving the field empty: nothing is added. */
  onCancel?: () => void;
}

const key = (value: string) => value.toLocaleLowerCase('es');

/** Normalises a typed tag: trimmed, single spaces, first letter in capitals. */
const tidy = (value: string) => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
};

/** "2 dulzainas", "Dulzaina x2" or "Dulzaina ×2": the tag and how many; one otherwise. */
function readCount(value: string): { tag: string; count: number } {
  const before = /^(\d+)\s*[x×]?\s+(.+)$/i.exec(value.trim());
  if (before) return { tag: before[2]!, count: Number(before[1]) };
  const after = /^(.+?)\s*[x×]\s*(\d+)$/i.exec(value.trim());
  if (after) return { tag: after[1]!, count: Number(after[2]) };
  return { tag: value, count: 1 };
}

/**
 * A list of tags in a field: typed and added with Enter or a comma, taken out with their ×
 * (or Backspace on an empty field). Counted, the same tag can go several times.
 */
export function TagField({
  label,
  values,
  onChange,
  hint,
  placeholder,
  suggestions = [],
  suggestionsTitle = 'Sugerencias: elige una o escribe la tuya',
  counted = false,
  max = 20,
  maxLength = 40,
  inline = false,
  autoFocus = false,
  onCancel,
}: TagFieldProps) {
  const id = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Each tag once, in the order it first appears, with how many times it is there.
  const tags = values.reduce<{ tag: string; count: number }[]>((list, value) => {
    const found = list.find((item) => key(item.tag) === key(value));
    if (found) found.count += 1;
    else list.push({ tag: value, count: 1 });
    return list;
  }, []);
  const known = (tag: string) => tags.find((item) => key(item.tag) === key(tag));

  /** The values with a tag `count` times more (or fewer, below zero). */
  const changeCount = (tag: string, change: number) => {
    if (change > 0) {
      const room = Math.max(0, max - values.length);
      return onChange([...values, ...Array<string>(Math.min(change, room)).fill(tag)]);
    }
    // The last ones go first.
    const kept = [...values];
    for (let left = -change, index = kept.length - 1; left > 0 && index >= 0; index -= 1) {
      if (key(kept[index]!) !== key(tag)) continue;
      kept.splice(index, 1);
      left -= 1;
    }
    onChange(kept);
  };

  const add = (value: string) => {
    setText('');
    const read = counted ? readCount(value) : { tag: value, count: 1 };
    const tag = tidy(read.tag).slice(0, maxLength);
    if (!tag) return;
    const existing = known(tag);
    if (existing && !counted) return;
    changeCount(existing?.tag ?? tag, read.count);
  };
  const remove = (tag: string) => onChange(values.filter((value) => key(value) !== key(tag)));

  // Suggestions not chosen yet that contain what is typed (ignoring accents and case).
  const plain = (value: string) =>
    key(value)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  const offered = suggestions.filter(
    (suggestion) =>
      (counted || !known(suggestion)) && plain(suggestion).includes(plain(text.trim())),
  );
  const listOpen = open && offered.length > 0;
  const pick = (value: string) => {
    add(value);
    setActive(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Several words ("Flauta y tamboril") make one tag: only Enter or a comma add it.
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (listOpen && active >= 0 && offered[active]) pick(offered[active]!);
      else add(text);
    } else if (event.key === 'ArrowDown' && offered.length) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % offered.length);
    } else if (event.key === 'ArrowUp' && offered.length) {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index <= 0 ? offered.length - 1 : index - 1));
    } else if (event.key === 'Escape' && listOpen) {
      event.preventDefault();
      setOpen(false);
    } else if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      setText('');
      onCancel();
    } else if (event.key === 'Backspace' && !text && tags.length) {
      remove(tags[tags.length - 1]!.tag);
    }
  };

  return (
    <div className={styles.root} data-inline={inline ? '' : undefined}>
      <Label.Root className={inline ? styles.srOnly : styles.label} htmlFor={id}>
        {label}
      </Label.Root>
      <div className={styles.box}>
        {tags.map(({ tag, count }) => (
          <span key={tag} className={styles.tag}>
            {tag}
            {counted && (
              // How many: one less, the number, one more.
              <span className={styles.count}>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Uno menos de ${tag}`}
                  disabled={count <= 1}
                  onClick={() => changeCount(tag, -1)}
                >
                  <Minus size={12} aria-hidden="true" />
                </button>
                <span aria-label={`${count} en total`}>×{count}</span>
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Uno más de ${tag}`}
                  disabled={values.length >= max}
                  onClick={() => changeCount(tag, 1)}
                >
                  <Plus size={12} aria-hidden="true" />
                </button>
              </span>
            )}
            <button
              type="button"
              className={styles.remove}
              aria-label={`Quitar ${tag}`}
              onClick={() => remove(tag)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          className={styles.input}
          value={text}
          placeholder={values.length ? undefined : placeholder}
          maxLength={maxLength}
          role={suggestions.length ? 'combobox' : undefined}
          aria-expanded={suggestions.length ? listOpen : undefined}
          aria-controls={suggestions.length ? `${id}-suggestions` : undefined}
          aria-activedescendant={listOpen && active >= 0 ? `${id}-option-${active}` : undefined}
          aria-autocomplete={suggestions.length ? 'list' : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
            if (text.trim()) add(text);
            else onCancel?.();
          }}
        />
        {listOpen && (
          // Examples to pick from; anything else can still be typed.
          <div className={styles.suggestions}>
            <p className={styles.suggestionsTitle}>{suggestionsTitle}</p>
            <ul id={`${id}-suggestions`} role="listbox" aria-label={suggestionsTitle}>
              {offered.map((suggestion, index) => (
                <li
                  key={suggestion}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={styles.option}
                  // Keeps the focus in the field, so the list stays open for the next one.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(suggestion)}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

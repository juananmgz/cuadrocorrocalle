export const PERSON_COLORS = [
  { id: 'blue', label: 'Azul', fill: 'var(--p1)', ink: 'var(--p1-ink)' },
  { id: 'red', label: 'Rojo', fill: 'var(--p2)', ink: 'var(--p2-ink)' },
  { id: 'yellow', label: 'Amarillo', fill: 'var(--p3)', ink: 'var(--p3-ink)' },
  { id: 'green', label: 'Verde', fill: 'var(--p4)', ink: 'var(--p4-ink)' },
  { id: 'orange', label: 'Naranja', fill: 'var(--p5)', ink: 'var(--p5-ink)' },
  { id: 'purple', label: 'Morado', fill: 'var(--p6)', ink: 'var(--p6-ink)' },
  { id: 'skyblue', label: 'Celeste', fill: 'var(--p7)', ink: 'var(--p7-ink)' },
  { id: 'pink', label: 'Rosa', fill: 'var(--p8)', ink: 'var(--p8-ink)' },
] as const;

export type PersonColor = (typeof PERSON_COLORS)[number]['id'];

export function getPersonColor(id: PersonColor) {
  return PERSON_COLORS.find((color) => color.id === id) ?? PERSON_COLORS[0];
}

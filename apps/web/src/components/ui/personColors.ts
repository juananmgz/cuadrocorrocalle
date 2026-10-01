export const PERSON_COLORS = [
  { id: 'blue', label: 'Azul', fill: 'var(--p1)', ink: 'var(--p1-ink)' },
  { id: 'red', label: 'Rojo', fill: 'var(--p2)', ink: 'var(--p2-ink)' },
  { id: 'yellow', label: 'Amarillo', fill: 'var(--p3)', ink: 'var(--p3-ink)' },
  { id: 'green', label: 'Verde', fill: 'var(--p4)', ink: 'var(--p4-ink)' },
  { id: 'orange', label: 'Naranja', fill: 'var(--p5)', ink: 'var(--p5-ink)' },
  { id: 'purple', label: 'Morado', fill: 'var(--p6)', ink: 'var(--p6-ink)' },
  { id: 'skyblue', label: 'Celeste', fill: 'var(--p7)', ink: 'var(--p7-ink)' },
  { id: 'pink', label: 'Rosa', fill: 'var(--p8)', ink: 'var(--p8-ink)' },
  { id: 'maroon', label: 'Granate', fill: 'var(--p9)', ink: 'var(--p9-ink)' },
  { id: 'lime', label: 'Lima', fill: 'var(--p10)', ink: 'var(--p10-ink)' },
  { id: 'turquoise', label: 'Turquesa', fill: 'var(--p11)', ink: 'var(--p11-ink)' },
  { id: 'brown', label: 'Marrón', fill: 'var(--p12)', ink: 'var(--p12-ink)' },
  { id: 'lavender', label: 'Lavanda', fill: 'var(--p13)', ink: 'var(--p13-ink)' },
  { id: 'black', label: 'Negro', fill: 'var(--p14)', ink: 'var(--p14-ink)' },
  { id: 'gray', label: 'Gris', fill: 'var(--p15)', ink: 'var(--p15-ink)' },
  { id: 'white', label: 'Blanco', fill: 'var(--p16)', ink: 'var(--p16-ink)' },
  { id: 'salmon', label: 'Salmón', fill: 'var(--p17)', ink: 'var(--p17-ink)' },
  { id: 'fuchsia', label: 'Fucsia', fill: 'var(--p18)', ink: 'var(--p18-ink)' },
  { id: 'ice', label: 'Hielo', fill: 'var(--p19)', ink: 'var(--p19-ink)' },
  { id: 'mustard', label: 'Mostaza', fill: 'var(--p20)', ink: 'var(--p20-ink)' },
] as const;

export type PersonColor = (typeof PERSON_COLORS)[number]['id'];

export function getPersonColor(id: PersonColor) {
  return PERSON_COLORS.find((color) => color.id === id) ?? PERSON_COLORS[0];
}

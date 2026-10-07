/** "15 de agosto de 2026" from "2026-08-15", with ", 20:30" when its time is known. */
export function formatDay(day: string | null, time: string | null = null) {
  if (!day) return null;
  const date = new Date(`${day}T00:00:00`).toLocaleDateString('es-ES', { dateStyle: 'long' });
  return time ? `${date}, ${time}` : date;
}

/** "45–60 min", "desde 45 min" or "hasta 60 min". */
export function formatDuration(min: number | null, max: number | null) {
  if (min && max) return min === max ? `${min} min` : `${min}–${max} min`;
  if (min) return `desde ${min} min`;
  if (max) return `hasta ${max} min`;
  return null;
}

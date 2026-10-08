const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "15/ago/26" from "2026-08-15", with ", 20:30" when its time is known. */
export function formatDay(day: string | null, time: string | null = null) {
  const parts = day?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const [, year, month, date] = parts;
  const short = `${Number(date)}/${MONTHS[Number(month) - 1]}/${year!.slice(2)}`;
  return time ? `${short}, ${time}` : short;
}

/** "45–60 min", "desde 45 min" or "hasta 60 min". */
export function formatDuration(min: number | null, max: number | null) {
  if (min && max) return min === max ? `${min} min` : `${min}–${max} min`;
  if (min) return `desde ${min} min`;
  if (max) return `hasta ${max} min`;
  return null;
}

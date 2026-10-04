/** "3:30" from 210 seconds; null when there is no duration. */
export function formatClock(seconds: number | null) {
  if (seconds == null) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Seconds from "3:30", "3.30" or "3" (minutes); null when blank, NaN when invalid. */
export function parseClock(text: string) {
  const value = text.trim();
  if (!value) return null;
  const match = /^(\d{1,2})(?:[:.,](\d{1,2}))?$/.exec(value);
  if (!match) return NaN;
  const seconds = Number(match[2] ?? 0);
  return seconds < 60 ? Number(match[1]) * 60 + seconds : NaN;
}

// Input filters for the performance form: each field only keeps the characters it can use.

/** Letters (accents included), digits, spaces and common punctuation for names and places. */
export const cleanText = (value: string) =>
  value.replace(/[^\p{L}\p{M}\p{N} .,;:'’"«»()¿?¡!&/#+ºª-]/gu, '');

/** Whole numbers only, up to `digits` digits. */
export const cleanInteger = (value: string, digits: number) =>
  value.replace(/\D/g, '').slice(0, digits);

/** Decimal numbers with a comma or a dot and up to two decimals. */
export function cleanDecimal(value: string) {
  const [whole = '', ...rest] = value.replace(/[^\d.,]/g, '').split(/[.,]/);
  const separator = value.match(/[.,]/)?.[0];
  if (!separator) return whole.slice(0, 3);
  return `${whole.slice(0, 3)}${separator}${rest.join('').slice(0, 2)}`;
}

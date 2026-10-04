// Relates pasted names to the group's people with a similarity score, without a nickname list:
// accents, case and punctuation are ignored, and initials, typos and nicknames made of name
// parts ("Malú" from María Luisa, "MLuisa", "M. Luisa") still match.

export interface NamedPerson {
  id: string;
  name: string;
}

export type MatchState = 'matched' | 'doubtful' | 'missing';

export interface NameMatch {
  /** Name as it was pasted. */
  original: string;
  /** Best person found, or null when nobody is close enough. */
  personId: string | null;
  /** Similarity with that person, from 0 to 1. */
  score: number;
  /** matched: clear; doubtful: worth a look (low score or a tie); missing: not in the group. */
  state: MatchState;
}

const SURE = 0.75;
const POSSIBLE = 0.5;

/** Lower case without accents or punctuation, split into words. */
export const normalizeName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j]!;
      row[j] = Math.min(above + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length]!;
}

/** 1 for equal strings, 0 for completely different ones. */
const likeness = (a: string, b: string) =>
  a && b ? 1 - distance(a, b) / Math.max(a.length, b.length) : 0;

/**
 * Whether text can be built from the start of each word, in order, skipping words:
 * "malu" from "maria luisa", "mluisa" from "m luisa". Returns the pieces used or null.
 */
function compose(text: string, words: string[]): string[] | null {
  const walk = (start: number, word: number): string[] | null => {
    if (start === text.length) return [];
    for (let w = word; w < words.length; w += 1) {
      const candidate = words[w]!;
      for (let length = Math.min(candidate.length, text.length - start); length >= 1; length -= 1) {
        if (text.startsWith(candidate.slice(0, length), start)) {
          const rest = walk(start + length, w + 1);
          if (rest) return [candidate.slice(0, length), ...rest];
        }
      }
    }
    return null;
  };
  return walk(0, 0);
}

/** Similarity between a pasted name and a person's name, from 0 to 1. */
export function nameScore(pasted: string, personName: string) {
  const a = normalizeName(pasted);
  const b = normalizeName(personName);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const pastedWords = a.split(' ');
  const words = b.split(' ');
  let score = likeness(a, b);

  // One word that is (or nearly is) one of the person's words: "Pablo" for "Pablo García".
  if (pastedWords.length === 1) {
    const best = Math.max(...words.map((word) => likeness(a, word)));
    score = Math.max(score, best * (words[0] && likeness(a, words[0]) === best ? 0.85 : 0.8));
  }

  // Every pasted word matches a different word of the name, in order, allowing typos.
  if (pastedWords.length > 1 && pastedWords.length <= words.length) {
    let word = 0;
    let total = 0;
    for (const pastedWord of pastedWords) {
      let best = 0;
      let bestIndex = -1;
      for (let w = word; w < words.length; w += 1) {
        const target = words[w]!;
        // A single letter is an initial: "M. Luisa".
        const value =
          pastedWord.length === 1
            ? target.startsWith(pastedWord)
              ? 0.9
              : 0
            : likeness(pastedWord, target);
        if (value > best) {
          best = value;
          bestIndex = w;
        }
      }
      if (bestIndex < 0) {
        total = 0;
        break;
      }
      total += best;
      word = bestIndex + 1;
    }
    score = Math.max(score, (total / pastedWords.length) * 0.95);
  }

  // Nicknames made of the start of several words: "Malú", "MLuisa".
  const joined = a.replace(/ /g, '');
  const pieces = joined.length >= 3 ? compose(joined, words) : null;
  if (pieces && (pieces.length > 1 || words.includes(pieces[0]!))) {
    score = Math.max(score, pieces.every((piece) => piece.length >= 2) ? 0.85 : 0.78);
  }

  return Math.min(score, 0.99);
}

/** Best person for each pasted name; ties and low scores are marked as doubtful. */
export function matchNames(names: string[], people: NamedPerson[]): NameMatch[] {
  const matches = names.map((original): NameMatch => {
    const ranked = people
      .map((person) => ({ person, score: nameScore(original, person.name) }))
      .sort((x, y) => y.score - x.score);
    const [best, second] = ranked;
    if (!best || best.score < POSSIBLE) {
      return { original, personId: null, score: best?.score ?? 0, state: 'missing' };
    }
    const tie = second !== undefined && best.score - second.score < 0.05;
    return {
      original,
      personId: best.person.id,
      score: best.score,
      state: best.score >= SURE && !tie ? 'matched' : 'doubtful',
    };
  });

  // The same person found for two names: both need a look.
  const counts = new Map<string, number>();
  matches.forEach((match) => {
    if (match.personId) counts.set(match.personId, (counts.get(match.personId) ?? 0) + 1);
  });
  return matches.map((match) =>
    match.personId && counts.get(match.personId)! > 1 ? { ...match, state: 'doubtful' } : match,
  );
}

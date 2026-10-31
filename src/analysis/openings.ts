import { positionKey } from '../lib/chess';

/** Position key -> [eco, name] for named positions, null for intermediate book positions. */
export type OpeningBook = Record<string, [string, string] | null>;

let bookPromise: Promise<OpeningBook> | null = null;

export function loadOpeningBook(): Promise<OpeningBook> {
  bookPromise ??= fetch('/data/openings.json').then((r) => r.json() as Promise<OpeningBook>);
  return bookPromise;
}

/** Deepest named opening reached by the game, plus how many plies stayed in book. */
export function identifyOpening(
  fensAfter: string[],
  book: OpeningBook,
): { eco?: string; name?: string; bookPlies: number } {
  let eco: string | undefined;
  let name: string | undefined;
  let bookPlies = 0;
  for (const fen of fensAfter) {
    const key = positionKey(fen);
    if (!(key in book)) break;
    bookPlies++;
    const entry = book[key];
    if (entry) [eco, name] = entry;
  }
  return { eco, name, bookPlies };
}

/** "Sicilian Defense: Najdorf Variation" -> "Sicilian Defense" */
export function openingFamily(name?: string): string | undefined {
  return name?.split(':')[0].trim();
}

import { Chess } from 'chess.js';

/**
 * A player's opening repertoire: how often each opening family ("Sicilian Defense") and each variation
 * ("Sicilian Defense: Najdorf Variation") shows up in their games, per colour. Openings are the one signal
 * that is both a trait of the player and independent of rating, so they carry most of the style match.
 *
 * Self-contained (only chess.js) so scripts/build-styles.mjs can use it too.
 */

/** Position key -> [eco, name] for named positions, null for intermediate book positions (public/data/openings.json). */
export type OpeningBook = Record<string, [string, string] | null>;

/** Plies replayed to find the opening: enough to tell the main systems apart, before the game is its own. */
export const REPERTOIRE_PLIES = 16;

/** Entries below this share are dropped from stored profiles, to keep the data file small. */
const MIN_SHARE = 0.004;
/** Fewest games of a colour for its repertoire to count. */
export const MIN_REPERTOIRE_GAMES = 10;

export interface OpeningKey {
  family: string;
  /** Family plus the first named variation ("Sicilian Defense: Najdorf Variation"); the family when it has none. */
  variation: string;
}

/** FEN without the move counters; identifies a position for the book. */
const positionKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ');

/** Deepest named opening the game reaches within the first REPERTOIRE_PLIES, or null. */
export function openingKey(moves: string[], book: OpeningBook): OpeningKey | null {
  const chess = new Chess();
  let name: string | undefined;
  try {
    for (const san of moves.slice(0, REPERTOIRE_PLIES)) {
      chess.move(san);
      const key = positionKey(chess.fen());
      if (!(key in book)) break;
      const entry = book[key];
      if (entry) name = entry[1];
    }
  } catch {
    return null;
  }
  if (!name) return null;
  const [family, rest] = name.split(':').map((s) => s.trim());
  const variation = rest?.split(',')[0].trim();
  return { family, variation: variation ? `${family}: ${variation}` : family };
}

/** Shares summing to 1. */
export type Distribution = Record<string, number>;

export interface ColourRepertoire {
  games: number;
  family: Distribution;
  variation: Distribution;
}

export interface Repertoire {
  white?: ColourRepertoire;
  black?: ColourRepertoire;
}

function distribution(keys: string[]): Distribution {
  const counts: Record<string, number> = {};
  for (const k of keys) counts[k] = (counts[k] ?? 0) + 1;
  const out: Distribution = {};
  for (const [k, n] of Object.entries(counts)) out[k] = n / keys.length;
  return out;
}

/** Repertoire from the opening of each game (null for games the book does not recognise: left out). */
export function buildRepertoire(games: { color: 'white' | 'black'; key: OpeningKey | null }[]): Repertoire {
  const out: Repertoire = {};
  for (const color of ['white', 'black'] as const) {
    const keys = games.flatMap((g) => (g.color === color && g.key ? [g.key] : []));
    if (keys.length < MIN_REPERTOIRE_GAMES) continue;
    out[color] = { games: keys.length, family: distribution(keys.map((k) => k.family)), variation: distribution(keys.map((k) => k.variation)) };
  }
  return out;
}

/** The same repertoire without the rarest entries, for storing. */
export function pruneRepertoire(rep: Repertoire): Repertoire {
  const prune = (d: Distribution): Distribution =>
    Object.fromEntries(Object.entries(d).filter(([, v]) => v >= MIN_SHARE).map(([k, v]) => [k, +v.toFixed(4)]));
  const out: Repertoire = {};
  for (const color of ['white', 'black'] as const) {
    const r = rep[color];
    if (r) out[color] = { games: r.games, family: prune(r.family), variation: prune(r.variation) };
  }
  return out;
}

/** Bhattacharyya coefficient: 1 for identical distributions, 0 for ones that share nothing. */
export function overlap(p: Distribution, q: Distribution): number {
  let sum = 0;
  for (const [k, v] of Object.entries(p)) if (k in q) sum += Math.sqrt(v * q[k]);
  return Math.min(1, sum);
}

/** Weight of the family level against the variation level: variations are finer but sparser. */
const FAMILY_SHARE = 0.5;

/** How alike two repertoires are, 0-1, averaged over the colours both have; undefined when none is shared. */
export function repertoireSimilarity(a: Repertoire, b: Repertoire): { overall: number; white?: number; black?: number } | undefined {
  const parts: { white?: number; black?: number } = {};
  for (const color of ['white', 'black'] as const) {
    const x = a[color];
    const y = b[color];
    if (!x || !y) continue;
    parts[color] = FAMILY_SHARE * overlap(x.family, y.family) + (1 - FAMILY_SHARE) * overlap(x.variation, y.variation);
  }
  const values = Object.values(parts);
  if (!values.length) return undefined;
  return { overall: values.reduce((s, v) => s + v, 0) / values.length, ...parts };
}

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

/** Shortest game worth profiling, in plies. */
export const MIN_PLIES = 20;

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

/** What the average legend plays, per colour: the baseline that "common" is measured against. */
export type RepertoireMean = Partial<Record<'white' | 'black', { family: Distribution; variation: Distribution }>>;

/** The average of the repertoires, per colour (a colour a repertoire lacks counts as nothing played). */
export function meanRepertoire(reps: Repertoire[]): RepertoireMean {
  const out: RepertoireMean = {};
  for (const color of ['white', 'black'] as const) {
    const have = reps.filter((r) => r[color]);
    if (!have.length) continue;
    const avg = (level: 'family' | 'variation'): Distribution => {
      const sum: Distribution = {};
      for (const r of have) for (const [k, v] of Object.entries(r[color]![level])) sum[k] = (sum[k] ?? 0) + v;
      return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, +(v / have.length).toFixed(5)]));
    };
    out[color] = { family: avg('family'), variation: avg('variation') };
  }
  return out;
}

/**
 * How much of `p` is unusual: the square root of each share minus the square root of the average share.
 * Everyone plays 1.e4 and 1...e5 sometimes; what tells players apart is how far they go from the usual.
 */
function unusual(p: Distribution, mean: Distribution): Distribution {
  const out: Distribution = {};
  for (const k of new Set([...Object.keys(p), ...Object.keys(mean)])) out[k] = Math.sqrt(p[k] ?? 0) - Math.sqrt(mean[k] ?? 0);
  return out;
}

function cosine(a: Distribution, b: Distribution): number {
  let dot = 0;
  let x = 0;
  let y = 0;
  for (const [k, v] of Object.entries(a)) {
    x += v * v;
    if (k in b) dot += v * b[k];
  }
  for (const v of Object.values(b)) y += v * v;
  return x && y ? dot / Math.sqrt(x * y) : 0;
}

/**
 * Openings both play that are NOT the usual ones, the ones that add most first: product of how far each is
 * above the average (square-root scale), so a line both favour that most legends avoid ranks above 1.e4.
 */
export function distinctiveShared(a: ColourRepertoire, b: ColourRepertoire, mean: Distribution): { family: string; you: number; legend: number; score: number }[] {
  const out: { family: string; you: number; legend: number; score: number }[] = [];
  for (const [family, p] of Object.entries(a.family)) {
    const q = b.family[family];
    if (q === undefined) continue;
    const m = Math.sqrt(mean[family] ?? 0);
    const score = (Math.sqrt(p) - m) * (Math.sqrt(q) - m);
    if (Math.sqrt(p) > m && Math.sqrt(q) > m) out.push({ family, you: p, legend: q, score });
  }
  return out.sort((x, y) => y.score - x.score);
}

/**
 * How alike two repertoires are, 0-1, averaged over the colours both have; undefined when none is shared.
 * With `mean` the shares are first taken relative to the average repertoire (cosine of the unusual parts,
 * floored at 0), so the openings everybody plays count for little; without it, plain overlap.
 */
export function repertoireSimilarity(a: Repertoire, b: Repertoire, mean?: RepertoireMean): { overall: number; white?: number; black?: number } | undefined {
  const parts: { white?: number; black?: number } = {};
  for (const color of ['white', 'black'] as const) {
    const x = a[color];
    const y = b[color];
    if (!x || !y) continue;
    const m = mean?.[color];
    parts[color] = m
      ? Math.max(0, FAMILY_SHARE * cosine(unusual(x.family, m.family), unusual(y.family, m.family)) + (1 - FAMILY_SHARE) * cosine(unusual(x.variation, m.variation), unusual(y.variation, m.variation)))
      : FAMILY_SHARE * overlap(x.family, y.family) + (1 - FAMILY_SHARE) * overlap(x.variation, y.variation);
  }
  const values = Object.values(parts);
  if (!values.length) return undefined;
  return { overall: values.reduce((s, v) => s + v, 0) / values.length, ...parts };
}

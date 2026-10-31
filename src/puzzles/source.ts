// Hybrid puzzle source: the bundled subset in public/data/puzzles/ (see scripts/build-puzzles.mjs) first,
// the Lichess API when the subset has nothing left for the requested theme and rating range. Every puzzle
// shown is saved in IndexedDB, so anything played can be replayed offline later.
import { Chess } from 'chess.js';
import { db } from '../db';
import type { Puzzle } from '../types';

interface PuzzleIndex {
  version: number;
  themes: string[];
  openings: string[];
  /** [bucket start rating, puzzle count] */
  buckets: [number, number][];
}

type Row = [id: string, fen: string, moves: string, rating: number, themes: number[], opening: number];

let indexPromise: Promise<PuzzleIndex | null> | null = null;
const bucketCache = new Map<number, Promise<Puzzle[]>>();

/** The bundled subset's index, or null when it hasn't been built. */
export function loadIndex(): Promise<PuzzleIndex | null> {
  indexPromise ??= fetch('/data/puzzles/index.json')
    .then((r) => (r.ok ? (r.json() as Promise<PuzzleIndex>) : null))
    .catch(() => null);
  return indexPromise;
}

function loadBucket(index: PuzzleIndex, bucket: number): Promise<Puzzle[]> {
  if (!bucketCache.has(bucket))
    bucketCache.set(
      bucket,
      fetch(`/data/puzzles/${bucket}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<Row[]>) : []))
        .then((rows) =>
          rows.map(([id, fen, moves, rating, themes, opening]) => ({
            id,
            fen,
            moves: moves.split(' '),
            rating,
            themes: themes.map((t) => index.themes[t]),
            opening: opening >= 0 ? index.openings[opening] : undefined,
            origin: 'local' as const,
            addedAt: 0,
          })),
        )
        .catch(() => {
          bucketCache.delete(bucket);
          return [];
        }),
    );
  return bucketCache.get(bucket)!;
}

/** Themes available in the bundled subset (empty when it isn't built). */
export async function localThemes(): Promise<string[]> {
  return (await loadIndex())?.themes ?? [];
}

export interface PuzzleFilter {
  /** Lichess theme key, or undefined for any. */
  theme?: string;
  min: number;
  max: number;
}

/** Ids of every puzzle the player has already attempted. */
export async function playedIds(): Promise<Set<string>> {
  return new Set((await db.puzzleAttempts.orderBy('puzzleId').uniqueKeys()) as string[]);
}

/** Bundled puzzles matching the filter (empty when the subset isn't built). */
async function localMatches(filter: PuzzleFilter): Promise<Puzzle[]> {
  const index = await loadIndex();
  if (!index) return [];
  const buckets = index.buckets.map(([b]) => b).filter((b) => b + 100 > filter.min && b <= filter.max);
  const pools = await Promise.all(buckets.map((b) => loadBucket(index, b)));
  return pools
    .flat()
    .filter((p) => p.rating >= filter.min && p.rating <= filter.max && (!filter.theme || p.themes.includes(filter.theme)));
}

async function fromLocal(filter: PuzzleFilter, exclude: Set<string>): Promise<Puzzle | undefined> {
  const candidates = (await localMatches(filter)).filter((p) => !exclude.has(p.id));
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Up to `n` random bundled puzzles matching the filter, unplayed ones first. */
export async function sampleLocal(filter: PuzzleFilter, n: number): Promise<Puzzle[]> {
  const played = await playedIds();
  const matches = shuffle(await localMatches(filter));
  return [...matches.filter((p) => !played.has(p.id)), ...matches.filter((p) => played.has(p.id))].slice(0, n);
}

/** Fisher–Yates, returning a new array. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface LichessPuzzleResponse {
  game: { id: string; pgn: string };
  puzzle: { id: string; rating: number; solution: string[]; themes: string[]; initialPly: number };
}

/**
 * Converts the API format (game PGN up to and including the setup move, plus the solution) to the
 * database format used everywhere else (FEN before the setup move, setup move + solution).
 */
export function fromLichessResponse(res: LichessPuzzleResponse): Puzzle {
  const chess = new Chess();
  const sans = res.game.pgn.trim().split(/\s+/).slice(0, res.puzzle.initialPly + 1);
  for (const san of sans.slice(0, -1)) chess.move(san);
  const fen = chess.fen();
  const setup = chess.move(sans[sans.length - 1]);
  const moves = [setup.from + setup.to + (setup.promotion ?? ''), ...res.puzzle.solution];
  // Fails loudly on a format change instead of serving an unsolvable puzzle.
  chess.move({ from: moves[1].slice(0, 2), to: moves[1].slice(2, 4), promotion: moves[1][4] });
  return {
    id: res.puzzle.id,
    fen,
    moves,
    rating: res.puzzle.rating,
    themes: res.puzzle.themes,
    origin: 'lichess',
    addedAt: Date.now(),
  };
}

/** Lichess picks puzzles relative to the (anonymous, ~1500) user's rating; map the target to its buckets. */
function difficultyFor(target: number): string {
  const d = target - 1500;
  if (d < -450) return 'easiest';
  if (d < -150) return 'easier';
  if (d <= 150) return 'normal';
  if (d <= 450) return 'harder';
  return 'hardest';
}

async function fetchLichess(path: string): Promise<Puzzle> {
  const res = await fetch(`https://lichess.org/api/puzzle/${path}`, { headers: { Accept: 'application/json' } });
  if (res.status === 429) throw new Error('rateLimited');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return fromLichessResponse((await res.json()) as LichessPuzzleResponse);
}

async function fromLichess(filter: PuzzleFilter, exclude: Set<string>): Promise<Puzzle | undefined> {
  const params = new URLSearchParams({
    angle: filter.theme ?? 'mix',
    difficulty: difficultyFor((filter.min + filter.max) / 2),
  });
  // The API knows nothing about local history, so skip anything already played.
  for (let i = 0; i < 3; i++) {
    const p = await fetchLichess(`next?${params}`);
    if (!exclude.has(p.id)) return p;
  }
  return undefined;
}

/** Next unplayed puzzle matching the filter; call savePuzzle once it is actually shown. */
export async function nextPuzzle(filter: PuzzleFilter, skip: string[] = []): Promise<Puzzle | undefined> {
  const exclude = await playedIds();
  for (const id of skip) exclude.add(id);
  return (await fromLocal(filter, exclude)) ?? (await fromLichess(filter, exclude));
}

/** A specific puzzle: from IndexedDB if seen before, else from Lichess. */
export async function getPuzzle(id: string): Promise<Puzzle> {
  const stored = await db.puzzles.get(id);
  if (stored) return stored;
  return fetchLichess(encodeURIComponent(id));
}

/** Keeps a shown puzzle in IndexedDB so it can be replayed offline. */
export async function savePuzzle(puzzle: Puzzle): Promise<void> {
  const existing = await db.puzzles.get(puzzle.id);
  if (!existing) await db.puzzles.put({ ...puzzle, addedAt: Date.now() });
}

/**
 * Fetches the bundled buckets around a rating so the service worker keeps them for offline use (the ones
 * actually played from are cached anyway). Skipped when the user asked to save data.
 */
export async function warmBuckets(rating: number, span = 200): Promise<void> {
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData || !navigator.onLine) return;
  const index = await loadIndex();
  for (const [start] of index?.buckets ?? [])
    if (start + 100 > rating - span && start < rating + span) void fetch(`/data/puzzles/${start}.json`).catch(() => {});
}

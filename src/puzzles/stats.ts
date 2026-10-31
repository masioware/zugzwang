// Aggregations over puzzle attempts for the statistics and Woodpecker pages.
import type { PuzzleAttempt, WoodpeckerCycle } from '../types';

export interface Group {
  key: string;
  n: number;
  solved: number;
  /** Share solved at the first try, 0–100. */
  rate: number;
  /** Median time to the result. */
  medianMs: number;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function toGroup(key: string, list: PuzzleAttempt[]): Group {
  const solved = list.filter((a) => a.solved).length;
  return { key, n: list.length, solved, rate: list.length ? (solved / list.length) * 100 : 0, medianMs: median(list.map((a) => a.timeMs)) };
}

/** Groups attempts by one or more keys each (an attempt with several themes counts in each). */
export function groupBy(attempts: PuzzleAttempt[], keys: (a: PuzzleAttempt) => string[]): Group[] {
  const map = new Map<string, PuzzleAttempt[]>();
  for (const a of attempts)
    for (const k of keys(a)) {
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(a);
    }
  return [...map].map(([k, list]) => toGroup(k, list));
}

/** Groups for a fixed list of keys, in that order, including empty ones. */
function ordered(attempts: PuzzleAttempt[], order: string[], key: (a: PuzzleAttempt) => string | undefined): Group[] {
  const groups = new Map(groupBy(attempts, (a) => {
    const k = key(a);
    return k === undefined ? [] : [k];
  }).map((g) => [g.key, g]));
  return order.map((k) => groups.get(k) ?? { key: k, n: 0, solved: 0, rate: 0, medianMs: 0 });
}

export interface Summary {
  n: number;
  solved: number;
  rate: number;
  medianSolvedMs: number;
  /** Time spent on puzzles, to the end of each line when known. */
  totalMs: number;
  avgPuzzleRating: number;
  /** Longest run of consecutive first-try solves. */
  bestStreak: number;
}

export function summary(attempts: PuzzleAttempt[]): Summary {
  const solved = attempts.filter((a) => a.solved);
  let streak = 0;
  let bestStreak = 0;
  for (const a of [...attempts].sort((x, y) => x.startedAt - y.startedAt)) {
    streak = a.solved ? streak + 1 : 0;
    bestStreak = Math.max(bestStreak, streak);
  }
  return {
    n: attempts.length,
    solved: solved.length,
    rate: attempts.length ? (solved.length / attempts.length) * 100 : 0,
    medianSolvedMs: median(solved.map((a) => a.timeMs)),
    totalMs: attempts.reduce((s, a) => s + (a.totalMs ?? a.timeMs), 0),
    avgPuzzleRating: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.puzzleRating, 0) / attempts.length) : 0,
    bestStreak,
  };
}

/** Themes that say where in the game or how long the puzzle is, not what the tactic is. */
const META_THEMES = new Set(['opening', 'middlegame', 'endgame', 'short', 'long', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM', 'crushing', 'advantage', 'equality', 'mate']);

/** Accuracy per tactical theme, weakest first; themes seen fewer than `minN` times are left out. */
export function byTheme(attempts: PuzzleAttempt[], minN = 3): Group[] {
  return groupBy(attempts, (a) => (a.themes ?? []).filter((t) => !META_THEMES.has(t)))
    .filter((g) => g.n >= minN)
    .sort((a, b) => a.rate - b.rate || b.n - a.n);
}

export const PHASES = ['opening', 'middlegame', 'endgame'];
export function byPhase(attempts: PuzzleAttempt[]): Group[] {
  return ordered(attempts, PHASES, (a) => PHASES.find((p) => a.themes?.includes(p)));
}

export function byColor(attempts: PuzzleAttempt[]): Group[] {
  return ordered(attempts, ['white', 'black'], (a) => a.color);
}

export const LENGTHS = ['1', '2', '3', '4+'];
/** By number of moves the player has to find. */
export function byLength(attempts: PuzzleAttempt[]): Group[] {
  return ordered(attempts, LENGTHS, (a) => (a.length ? (a.length >= 4 ? '4+' : String(a.length)) : undefined));
}

/** By puzzle rating, in `step`-wide buckets keyed by their lower bound; only buckets with attempts. */
export function byRating(attempts: PuzzleAttempt[], step = 200): Group[] {
  return groupBy(attempts, (a) => [String(Math.floor(a.puzzleRating / step) * step)]).sort((a, b) => +a.key - +b.key);
}

/** Time buckets (upper bound in seconds; the last is open-ended). */
export const TIME_BUCKETS = [10, 20, 40, 60, 120, Infinity];
export function timeBucket(ms: number): string {
  const s = ms / 1000;
  return String(TIME_BUCKETS.find((b) => s < b));
}
/** Accuracy by how long the result took: does thinking longer pay off? */
export function byTime(attempts: PuzzleAttempt[]): Group[] {
  return ordered(attempts, TIME_BUCKETS.map(String), (a) => timeBucket(a.timeMs));
}

export interface RatingPoint {
  t: number;
  rating: number;
}
export function ratingHistory(attempts: PuzzleAttempt[]): RatingPoint[] {
  return attempts
    .filter((a) => a.ratingAfter !== undefined)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((a) => ({ t: a.startedAt, rating: a.ratingAfter! }));
}

export interface Day {
  /** Local midnight. */
  t: number;
  solved: number;
  failed: number;
}
/** Puzzles per day over the last `days` days, oldest first. */
export function daily(attempts: PuzzleAttempt[], days: number, now = Date.now()): Day[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const out: Day[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push({ t: d.getTime(), solved: 0, failed: 0 });
  }
  const index = new Map(out.map((d, i) => [d.t, i]));
  for (const a of attempts) {
    const d = new Date(a.startedAt);
    d.setHours(0, 0, 0, 0);
    const i = index.get(d.getTime());
    if (i !== undefined) out[i][a.solved ? 'solved' : 'failed']++;
  }
  return out;
}

export interface CycleStats {
  index: number;
  done: number;
  total: number;
  solved: number;
  rate: number;
  activeMs: number;
  /** Mean time per puzzle played. */
  avgMs: number;
  finished: boolean;
}
export function cycleStats(cycles: WoodpeckerCycle[]): CycleStats[] {
  return cycles.map((c) => ({
    index: c.index,
    done: c.position,
    total: c.order.length,
    solved: c.solved,
    rate: c.position ? (c.solved / c.position) * 100 : 0,
    activeMs: c.activeMs,
    avgMs: c.position ? c.activeMs / c.position : 0,
    finished: !!c.finishedAt,
  }));
}

export interface PuzzleTrack {
  puzzleId: string;
  rating: number;
  /** Result per cycle index (undefined when not played in that cycle yet). */
  results: Map<number, boolean>;
  misses: number;
}
/** How each puzzle of a set went across cycles; the most missed first. */
export function puzzleTracks(cycles: WoodpeckerCycle[], attempts: PuzzleAttempt[]): PuzzleTrack[] {
  const indexOf = new Map(cycles.map((c) => [c.id, c.index]));
  const map = new Map<string, PuzzleTrack>();
  for (const a of attempts) {
    const cycle = a.cycleId === undefined ? undefined : indexOf.get(a.cycleId);
    if (cycle === undefined) continue;
    if (!map.has(a.puzzleId)) map.set(a.puzzleId, { puzzleId: a.puzzleId, rating: a.puzzleRating, results: new Map(), misses: 0 });
    const track = map.get(a.puzzleId)!;
    track.results.set(cycle, a.solved);
    if (!a.solved) track.misses++;
  }
  return [...map.values()].sort((a, b) => b.misses - a.misses || b.rating - a.rating);
}

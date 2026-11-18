import type { PuzzleAttempt } from '../types';
import type { Weakness } from './diagnose';

/** Clean solves in a row that count as having drilled a weakness (fewer when the lesson has fewer exercises). */
export const DRILL_STREAK = 5;

/** What the weakness looked like when the drills were passed: the yardstick for checking it in later games. */
export interface Baseline {
  rate: number;
  count: number;
  opportunities: number;
}

/**
 * - verifying: drills passed; waiting to see the weakness shrink in new games (records from before this
 *   field existed are verifying too).
 * - mastered: it shrank; still watched for a relapse.
 * - redo: back to drills, because it did not shrink or it came back; `resetAt` restarts the streak.
 */
export type ProgressStatus = 'verifying' | 'mastered' | 'redo';

/** A weakness the user has worked on; stored in the `trainProgress` table. */
export interface Progress {
  /** WeaknessId. */
  id: string;
  status?: ProgressStatus;
  /** When the drills were passed; games played after it are the ones that verify them. */
  passedAt: number;
  baseline: Baseline;
  masteredAt?: number;
  /** Drill attempts before this moment do not count towards the streak. */
  resetAt?: number;
  /** Why the lesson was reopened. */
  reason?: 'unproven' | 'relapse';
}

export type NodeStatus = 'done' | 'verifying' | 'active' | 'locked';

export const statusOf = (p: Progress): ProgressStatus => p.status ?? 'verifying';

/** New games, analysed, that must be played after the drills before they are judged. */
export const VERIFY_GAMES = 10;
/** The rate must fall to this share of the baseline (or lower) to count as fixed. */
export const IMPROVEMENT = 0.5;
/** A mastered weakness is reopened when its recent rate climbs back to this share of the baseline. */
export const RELAPSE = 0.8;

export type Verdict =
  | { kind: 'waiting'; games: number }
  | { kind: 'mastered' }
  | { kind: 'redo'; reason: 'unproven' | 'relapse' }
  | { kind: 'ok' };

/**
 * Judges a weakness from its measurement over the games played since the drills (verifying) or since
 * mastery (mastered; the most recent window of them).
 */
export function verdict(p: Progress, m: { games: number; rate: number }): Verdict {
  const status = statusOf(p);
  if (status === 'redo') return { kind: 'ok' };
  if (m.games < VERIFY_GAMES) return status === 'verifying' ? { kind: 'waiting', games: m.games } : { kind: 'ok' };
  if (status === 'verifying') return m.rate <= p.baseline.rate * IMPROVEMENT ? { kind: 'mastered' } : { kind: 'redo', reason: 'unproven' };
  return m.rate >= p.baseline.rate * RELAPSE ? { kind: 'redo', reason: 'relapse' } : { kind: 'ok' };
}

/** Records changed by what the new games show, given a `measureFor(id, since, latest)` over analysed own games. */
export function settle(
  progress: Progress[],
  measureFor: (id: string, since: number, latest?: number) => { games: number; rate: number; opportunities: number; count: number },
  now: number,
): Progress[] {
  const changed: Progress[] = [];
  for (const p of progress) {
    const status = statusOf(p);
    if (status === 'redo') continue;
    const m = status === 'verifying' ? measureFor(p.id, p.passedAt) : measureFor(p.id, p.masteredAt ?? p.passedAt, VERIFY_GAMES);
    const v = verdict(p, m);
    if (v.kind === 'mastered') changed.push({ ...p, status: 'mastered', masteredAt: now });
    else if (v.kind === 'redo') changed.push({ ...p, status: 'redo', resetAt: now, reason: v.reason });
  }
  return changed;
}

export interface PathNode {
  weakness: Weakness;
  status: NodeStatus;
}

/** Consecutive clean solves at the end of the attempts (oldest first or not: they are sorted here). */
export function cleanStreak(attempts: Pick<PuzzleAttempt, 'solved' | 'startedAt'>[]): number {
  let n = 0;
  for (const a of [...attempts].sort((x, y) => y.startedAt - x.startedAt)) {
    if (!a.solved) break;
    n++;
  }
  return n;
}

/** Streak needed for a lesson of `total` exercises. */
export function drillTarget(total: number): number {
  return Math.max(1, Math.min(DRILL_STREAK, total));
}

export const baselineOf = (w: Weakness): Baseline => ({ rate: w.rate, count: w.count, opportunities: w.opportunities });

/**
 * The learning path: mastered weaknesses first (they stay put), then the one being worked on, then the
 * rest in ranking order. Only the first of those is open (a lesson being verified keeps the path
 * closed until it is mastered); the others unlock one at a time. A weakness the diagnosis no longer
 * finds drops off the path.
 */
export function buildPath(weaknesses: Weakness[], progress: Progress[]): PathNode[] {
  const byId = new Map(progress.map((p) => [p.id, p]));
  const state = (w: Weakness) => (byId.has(w.id) ? statusOf(byId.get(w.id)!) : undefined);
  const mastered = weaknesses.filter((w) => state(w) === 'mastered').sort((a, b) => byId.get(a.id)!.passedAt - byId.get(b.id)!.passedAt);
  const verifying = weaknesses.filter((w) => state(w) === 'verifying').sort((a, b) => byId.get(a.id)!.passedAt - byId.get(b.id)!.passedAt);
  const rest = weaknesses.filter((w) => state(w) === undefined || state(w) === 'redo');
  // A lesson sent back to drills comes before untouched ones.
  rest.sort((a, b) => Number(state(b) === 'redo') - Number(state(a) === 'redo'));
  const open = [...verifying, ...rest];
  return [
    ...mastered.map((weakness) => ({ weakness, status: 'done' as const })),
    ...open.map((weakness, i) => ({
      weakness,
      status: i > 0 ? ('locked' as const) : state(weakness) === 'verifying' ? ('verifying' as const) : ('active' as const),
    })),
  ];
}

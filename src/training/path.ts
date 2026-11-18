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

/** A weakness whose drills were passed; stored in the `trainProgress` table. */
export interface Progress {
  /** WeaknessId. */
  id: string;
  passedAt: number;
  baseline: Baseline;
}

export type NodeStatus = 'done' | 'active' | 'locked';

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
 * The learning path: weaknesses already drilled first (they stay put), then the rest in ranking order.
 * Only the first of those is open; the others unlock one at a time as the one before is drilled.
 * A drilled weakness that the diagnosis no longer finds drops off the path.
 */
export function buildPath(weaknesses: Weakness[], progress: Progress[]): PathNode[] {
  const passed = new Map(progress.map((p) => [p.id, p.passedAt]));
  const done = weaknesses.filter((w) => passed.has(w.id)).sort((a, b) => passed.get(a.id)! - passed.get(b.id)!);
  const todo = weaknesses.filter((w) => !passed.has(w.id));
  return [
    ...done.map((weakness) => ({ weakness, status: 'done' as const })),
    ...todo.map((weakness, i) => ({ weakness, status: i === 0 ? ('active' as const) : ('locked' as const) })),
  ];
}

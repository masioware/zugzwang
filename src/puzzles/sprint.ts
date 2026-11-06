// Sprint: solve as many puzzles as possible before the clock or three strikes end the run.
import { sampleLocal } from './source';
import { puzzleFacts } from './solve';
import type { SolveResult } from './useSolver';
import type { Puzzle, PuzzleAttempt, SprintMode, SprintRun } from '../types';

export const MAX_STRIKES = 3;

/** Time limit per mode, in ms; survival has none. */
export const SPRINT_LIMITS: Record<SprintMode, number | undefined> = {
  '3min': 3 * 60_000,
  '5min': 5 * 60_000,
  survival: undefined,
};
export const SPRINT_MODES = Object.keys(SPRINT_LIMITS) as SprintMode[];

const START_RATING = 500;
const RATING_STEP = 40;
/** The bundled subset thins out above this. */
const MAX_RATING = 2700;

/** Target rating of the nth puzzle of a run (from 0): starts easy and climbs with every puzzle shown. */
export function sprintTarget(index: number): number {
  return Math.min(START_RATING + index * RATING_STEP, MAX_RATING);
}

/** Rating windows tried in turn: offline, only the buckets already cached can answer. */
const WINDOWS = [50, 200, 500, 3000];

/** The run's next puzzle from the bundled subset, never one already in `used`; added to it when found. */
export async function pickSprintPuzzle(index: number, used: Set<string>): Promise<Puzzle | undefined> {
  const target = sprintTarget(index);
  for (const w of WINDOWS) {
    const candidates = await sampleLocal({ min: target - w, max: target + w }, used.size + 1);
    const puzzle = candidates.find((p) => !used.has(p.id));
    if (puzzle) {
      used.add(puzzle.id);
      return puzzle;
    }
  }
  return undefined;
}

/** The attempt saved for a puzzle of a run; the rating isn't touched, as speed solving says little about it. */
export function sprintAttempt(puzzle: Puzzle, r: SolveResult): PuzzleAttempt {
  return {
    puzzleId: puzzle.id,
    mode: 'sprint',
    startedAt: r.startedAt,
    timeMs: r.timeMs,
    totalMs: r.timeMs,
    solved: r.solved,
    completed: r.solved,
    mistakes: r.mistakes,
    usedHint: false,
    usedSolution: false,
    wrongMoves: r.wrongMoves,
    moveTimes: r.moveTimes,
    puzzleRating: puzzle.rating,
    ...puzzleFacts(puzzle),
  };
}

/** Best score per mode; modes never played are left out. */
export function bestScores(runs: SprintRun[]): Partial<Record<SprintMode, number>> {
  const best: Partial<Record<SprintMode, number>> = {};
  for (const r of runs) best[r.mode] = Math.max(best[r.mode] ?? 0, r.score);
  return best;
}

/** Whether a run beat every earlier run of its mode. */
export function isRecord(run: SprintRun, runs: SprintRun[]): boolean {
  return run.score > 0 && runs.every((r) => r.mode !== run.mode || r.startedAt >= run.startedAt || r.score < run.score);
}

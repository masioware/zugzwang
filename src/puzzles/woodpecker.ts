// The Woodpecker Method: one fixed set of puzzles solved again and again, each cycle faster than the last.
import { db } from '../db';
import { puzzleFacts } from './solve';
import { sampleLocal, savePuzzle, shuffle, type PuzzleFilter } from './source';
import type { FinishResult } from './useSolver';
import type { Puzzle, PuzzleAttempt, WoodpeckerCycle, WoodpeckerSet } from '../types';

export const SET_SIZES = [25, 50, 100, 200, 300, 500];

/** Creates a set from bundled puzzles matching a filter. Returns undefined when nothing matches. */
export async function createFromFilter(name: string, filter: PuzzleFilter, size: number): Promise<WoodpeckerSet | undefined> {
  const puzzles = await sampleLocal(filter, size);
  if (!puzzles.length) return undefined;
  await Promise.all(puzzles.map(savePuzzle));
  return saveSet(name, puzzles, { kind: 'filter', theme: filter.theme, min: filter.min, max: filter.max });
}

/** Creates a set from puzzles failed in free play, most recent first. */
export async function createFromFailed(name: string, size: number): Promise<WoodpeckerSet | undefined> {
  const failed = await db.puzzleAttempts
    .orderBy('startedAt')
    .reverse()
    .filter((a) => !a.solved && a.mode !== 'woodpecker')
    .toArray();
  const ids = [...new Set(failed.map((a) => a.puzzleId))].slice(0, size);
  const puzzles = (await db.puzzles.bulkGet(ids)).filter((p): p is Puzzle => !!p);
  if (!puzzles.length) return undefined;
  return saveSet(name, puzzles, { kind: 'failed' });
}

async function saveSet(name: string, puzzles: Puzzle[], origin: WoodpeckerSet['origin']): Promise<WoodpeckerSet> {
  const set: WoodpeckerSet = { id: crypto.randomUUID(), name, puzzleIds: puzzles.map((p) => p.id), createdAt: Date.now(), origin };
  await db.woodpeckerSets.add(set);
  return set;
}

export async function cyclesOf(setId: string): Promise<WoodpeckerCycle[]> {
  return db.woodpeckerCycles.where('setId').equals(setId).sortBy('index');
}

/** The cycle in progress, if any. */
export async function openCycle(setId: string): Promise<WoodpeckerCycle | undefined> {
  const cycles = await cyclesOf(setId);
  const last = cycles[cycles.length - 1];
  return last && !last.finishedAt ? last : undefined;
}

/** Starts the next cycle with a fresh shuffle, so the order itself can't be memorised. */
export async function startCycle(set: WoodpeckerSet): Promise<WoodpeckerCycle> {
  const cycles = await cyclesOf(set.id);
  const cycle: WoodpeckerCycle = {
    setId: set.id,
    index: (cycles[cycles.length - 1]?.index ?? 0) + 1,
    order: shuffle(set.puzzleIds),
    position: 0,
    solved: 0,
    startedAt: Date.now(),
    activeMs: 0,
  };
  cycle.id = (await db.woodpeckerCycles.add(cycle)) as number;
  return cycle;
}

/** Saves the attempt and moves the cycle on to the next puzzle, atomically. */
export async function recordResult(cycle: WoodpeckerCycle, puzzle: Puzzle, r: FinishResult): Promise<WoodpeckerCycle> {
  const attempt: PuzzleAttempt = {
    puzzleId: puzzle.id,
    mode: 'woodpecker',
    startedAt: r.startedAt,
    timeMs: r.timeMs,
    totalMs: r.totalMs,
    solved: r.solved,
    completed: r.completed,
    mistakes: r.mistakes,
    usedHint: false,
    usedSolution: false,
    wrongMoves: r.wrongMoves,
    moveTimes: r.moveTimes,
    puzzleRating: puzzle.rating,
    setId: cycle.setId,
    cycleId: cycle.id,
    ...puzzleFacts(puzzle),
  };
  const position = cycle.position + 1;
  const next: WoodpeckerCycle = {
    ...cycle,
    position,
    solved: cycle.solved + (r.solved ? 1 : 0),
    // Time to the result: the solution playback after a miss isn't solving time.
    activeMs: cycle.activeMs + r.timeMs,
    ...(position >= cycle.order.length && { finishedAt: Date.now() }),
  };
  await db.transaction('rw', db.puzzleAttempts, db.woodpeckerCycles, async () => {
    await db.puzzleAttempts.add(attempt);
    await db.woodpeckerCycles.put(next);
  });
  return next;
}

/** Deletes a set with its cycles and attempts. */
export async function deleteSet(setId: string): Promise<void> {
  await db.transaction('rw', db.woodpeckerSets, db.woodpeckerCycles, db.puzzleAttempts, async () => {
    await db.woodpeckerSets.delete(setId);
    await db.woodpeckerCycles.where('setId').equals(setId).delete();
    await db.puzzleAttempts.where('setId').equals(setId).delete();
  });
}

/** Time goal for the next cycle: half of the previous one, as the method prescribes. */
export function nextTarget(cycles: WoodpeckerCycle[]): number | undefined {
  const last = [...cycles].reverse().find((c) => c.finishedAt);
  return last ? last.activeMs / 2 : undefined;
}

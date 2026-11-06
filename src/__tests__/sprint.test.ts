import { describe, expect, it } from 'vitest';
import { bestScores, isRecord, sprintAttempt, sprintTarget } from '../puzzles/sprint';
import type { Puzzle, SprintRun } from '../types';

const run = (mode: SprintRun['mode'], startedAt: number, score: number): SprintRun => ({
  mode,
  startedAt,
  durationMs: 1000,
  score,
  results: [],
});

describe('sprintTarget', () => {
  it('starts easy, climbs with each puzzle and stops at the top of the subset', () => {
    expect(sprintTarget(0)).toBe(500);
    expect(sprintTarget(1)).toBeGreaterThan(sprintTarget(0));
    expect(sprintTarget(1000)).toBe(2700);
  });
});

describe('bestScores', () => {
  it('keeps the best score per mode only', () => {
    expect(bestScores([run('3min', 1, 10), run('3min', 2, 7), run('survival', 3, 4)])).toEqual({ '3min': 10, survival: 4 });
  });
});

describe('isRecord', () => {
  const earlier = run('3min', 1, 10);
  it('needs to beat every earlier run of the same mode', () => {
    const better = run('3min', 2, 11);
    expect(isRecord(better, [earlier, better])).toBe(true);
    const tied = run('3min', 2, 10);
    expect(isRecord(tied, [earlier, tied])).toBe(false);
  });
  it('ignores other modes and later runs', () => {
    const r = run('3min', 2, 5);
    expect(isRecord(r, [run('5min', 1, 50), r, run('3min', 3, 9)])).toBe(true);
  });
  it('does not call an empty first run a record', () => {
    const r = run('survival', 1, 0);
    expect(isRecord(r, [r])).toBe(false);
  });
});

describe('sprintAttempt', () => {
  it('records the result under its own mode, with no rating change', () => {
    const puzzle: Puzzle = { id: 'x', fen: '6k1/8/8/8/8/8/8/6K1 w - - 0 1', moves: ['g1g2', 'g8g7'], rating: 700, themes: ['fork'], origin: 'local', addedAt: 0 };
    const a = sprintAttempt(puzzle, { solved: false, mistakes: 1, usedHint: false, usedSolution: false, startedAt: 5, timeMs: 900, wrongMoves: ['g8h8'], moveTimes: [900] });
    expect(a).toMatchObject({ puzzleId: 'x', mode: 'sprint', solved: false, puzzleRating: 700, themes: ['fork'], color: 'black' });
    expect(a.ratingAfter).toBeUndefined();
  });
});

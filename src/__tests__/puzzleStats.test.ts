import { describe, expect, it } from 'vitest';
import { byLength, byPhase, byTheme, byTime, cycleStats, daily, median, puzzleTracks, summary } from '../puzzles/stats';
import { nextTarget } from '../puzzles/woodpecker';
import { playerColor } from '../puzzles/solve';
import { shuffle } from '../puzzles/source';
import type { PuzzleAttempt, WoodpeckerCycle } from '../types';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 30, 12).getTime();

function attempt(over: Partial<PuzzleAttempt>): PuzzleAttempt {
  return {
    puzzleId: 'p',
    mode: 'rated',
    startedAt: NOW,
    timeMs: 10_000,
    solved: true,
    mistakes: 0,
    usedHint: false,
    usedSolution: false,
    puzzleRating: 1500,
    themes: ['fork', 'middlegame', 'short'],
    color: 'white',
    length: 2,
    ...over,
  };
}

describe('puzzle stats', () => {
  const list = [
    attempt({ solved: true, timeMs: 5_000 }),
    attempt({ solved: false, timeMs: 30_000, themes: ['pin', 'endgame'], length: 1 }),
    attempt({ solved: true, timeMs: 15_000, themes: ['pin', 'endgame'], length: 5 }),
    attempt({ solved: false, timeMs: 90_000, startedAt: NOW - DAY }),
  ];

  it('summarises accuracy, median solve time and streaks', () => {
    const s = summary(list);
    expect(s.n).toBe(4);
    expect(s.rate).toBe(50);
    expect(s.medianSolvedMs).toBe(10_000);
    expect(s.bestStreak).toBe(1);
  });

  it('groups by tactical theme only, weakest first', () => {
    const themes = byTheme(list, 1);
    expect(themes.map((g) => g.key)).toEqual(['fork', 'pin']);
    expect(themes.find((g) => g.key === 'fork')).toMatchObject({ n: 2, solved: 1, rate: 50 });
  });

  it('buckets by phase, length and time', () => {
    expect(byPhase(list).map((g) => g.n)).toEqual([0, 2, 2]);
    expect(byLength(list).map((g) => g.n)).toEqual([1, 2, 0, 1]);
    expect(byTime(list).map((g) => g.n)).toEqual([1, 1, 1, 0, 1, 0]);
  });

  it('counts puzzles per day', () => {
    const days = daily(list, 3, NOW);
    expect(days.map((d) => [d.solved, d.failed])).toEqual([[0, 0], [0, 1], [2, 1]]);
  });

  it('median of even and odd lists', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('woodpecker', () => {
  const cycles: WoodpeckerCycle[] = [
    { id: 1, setId: 's', index: 1, order: ['a', 'b'], position: 2, solved: 1, startedAt: 0, finishedAt: 10, activeMs: 60_000 },
    { id: 2, setId: 's', index: 2, order: ['b', 'a'], position: 1, solved: 1, startedAt: 20, activeMs: 10_000 },
  ];

  it('summarises each cycle', () => {
    expect(cycleStats(cycles)).toMatchObject([
      { index: 1, done: 2, rate: 50, avgMs: 30_000, finished: true },
      { index: 2, done: 1, rate: 100, avgMs: 10_000, finished: false },
    ]);
  });

  it('sets the next goal to half the last finished cycle', () => {
    expect(nextTarget(cycles)).toBe(30_000);
    expect(nextTarget([])).toBeUndefined();
  });

  it('tracks each puzzle across cycles, most missed first', () => {
    const tracks = puzzleTracks(cycles, [
      attempt({ puzzleId: 'a', cycleId: 1, solved: true }),
      attempt({ puzzleId: 'b', cycleId: 1, solved: false }),
      attempt({ puzzleId: 'b', cycleId: 2, solved: true }),
    ]);
    expect(tracks[0].puzzleId).toBe('b');
    expect([...tracks[0].results]).toEqual([[1, false], [2, true]]);
  });

  it('shuffles without losing items', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect([...shuffle(items)].sort((a, b) => a - b)).toEqual(items);
  });
});

describe('playerColor', () => {
  it('is the side not to move before the setup move', () => {
    expect(playerColor({ fen: '8/8/8/8/8/8/8/8 b - - 0 1' })).toBe('white');
    expect(playerColor({ fen: '8/8/8/8/8/8/8/8 w - - 0 1' })).toBe('black');
  });
});

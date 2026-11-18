import { describe, expect, it } from 'vitest';
import { highlights } from '../stats/highlights';
import type { Game } from '../types';

const NOW = new Date('2026-06-15T12:00:00').getTime();
const DAY = 86_400_000;

function game(i: number, over: Partial<Game> = {}): Game {
  return {
    id: `g${i}`,
    endTime: NOW - i * DAY,
    outcome: 'win',
    userColor: 'white',
    opening: { name: 'Sicilian Defense: Najdorf' },
    moves: [],
    ...over,
  } as unknown as Game;
}

describe('highlights', () => {
  it('says nothing without enough games', () => {
    expect(highlights([game(1), game(2)], new Map(), NOW)).toEqual([]);
  });

  it('reports recent form and compares it with the 30 days before', () => {
    const recent = Array.from({ length: 6 }, (_, i) => game(i, { outcome: i < 4 ? 'win' : 'loss' }));
    const before = Array.from({ length: 5 }, (_, i) => game(40 + i, { outcome: 'loss' }));
    const form = highlights([...recent, ...before], new Map(), NOW).find((h) => h.kind === 'form');
    expect(form).toMatchObject({ kind: 'form', games: 6 });
    expect(form && form.kind === 'form' && form.score).toBeCloseTo(66.7, 0);
    expect(form && form.kind === 'form' && form.previous).toBe(0);
  });

  it('flags an opening that scores under 50% over enough games, grouped by family', () => {
    const games = Array.from({ length: 6 }, (_, i) => game(i, { outcome: i < 1 ? 'win' : 'loss' }));
    const h = highlights(games, new Map(), NOW).find((x) => x.kind === 'opening');
    expect(h).toMatchObject({ kind: 'opening', name: 'Sicilian Defense', color: 'white', games: 6 });
  });

  it('does not flag an opening you do well in', () => {
    const games = Array.from({ length: 6 }, (_, i) => game(i));
    expect(highlights(games, new Map(), NOW).some((x) => x.kind === 'opening')).toBe(false);
  });
});

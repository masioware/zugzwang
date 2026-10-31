import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, errorsByClock, filterGames, openingStats, ratingHistory, scorePct, summarize } from '../stats/aggregate';
import type { Game, GameAnalysis, MoveAnalysis } from '../types';

const base: Game = {
  id: 'g1',
  source: 'lichess',
  accountId: 'lichess:me',
  url: '',
  pgn: '',
  moves: [],
  white: { name: 'me', rating: 1500 },
  black: { name: 'opp', rating: 1500 },
  userColor: 'white',
  outcome: 'win',
  termination: 'checkmate',
  timeClass: 'blitz',
  timeControl: '180+0',
  initialTime: 180,
  endTime: Date.UTC(2026, 0, 1),
  rated: true,
  opening: { eco: 'B20', name: 'Sicilian Defense: Alapin Variation' },
};

const games: Game[] = [
  base,
  { ...base, id: 'g2', outcome: 'draw', white: { name: 'me', rating: 1510 }, endTime: Date.UTC(2026, 0, 2) },
  { ...base, id: 'g3', outcome: 'loss', userColor: 'black', timeClass: 'rapid', opening: { name: 'French Defense' } },
];

describe('aggregate', () => {
  it('summarizes results', () => {
    const s = summarize(games);
    expect(s).toEqual({ games: 3, win: 1, draw: 1, loss: 1 });
    expect(scorePct(s)).toBeCloseTo(50);
  });
  it('filters', () => {
    expect(filterGames(games, { ...DEFAULT_FILTERS, timeClass: 'rapid' })).toHaveLength(1);
    expect(filterGames(games, { ...DEFAULT_FILTERS, search: 'sicilian' })).toHaveLength(2);
  });
  it('groups openings by family', () => {
    const rows = openingStats(games, new Map(), 'white', true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Sicilian Defense', games: 2, win: 1, draw: 1 });
  });
  it('builds rating series per time control', () => {
    const series = ratingHistory(games);
    expect(series[0].points.map((p) => p.rating)).toEqual([1500, 1510]);
  });
  it('buckets moves by clock left', () => {
    const move = (clockBefore: number, classification: MoveAnalysis['classification']): MoveAnalysis => ({
      ply: 0, san: 'e4', uci: 'e2e4', color: 'white', classification, winBefore: 50, winAfter: 50,
      accuracy: 90, scoreAfter: { cp: 0 }, phase: 'middlegame', clockBefore,
    });
    const analysis: GameAnalysis = {
      gameId: 'g1', depth: 10, version: 1, positions: [], createdAt: 0, accuracy: { white: 90, black: 90 },
      moves: [move(170, 'best'), move(10, 'blunder')],
    };
    const buckets = errorsByClock(games, new Map([['g1', analysis]]));
    expect(buckets.map((b) => [b.key, b.moves, b.blunder])).toEqual([['>50%', 1, 0], ['<10%', 1, 1]]);
  });
});

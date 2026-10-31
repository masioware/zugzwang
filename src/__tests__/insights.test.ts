import { describe, expect, it } from 'vitest';
import { computeFacts } from '../stats/facts';
import {
  accuracyByMoveNumber,
  accuracyByResult,
  bookMastery,
  byDayPart,
  byOpponentRating,
  byWeekday,
  castlingStats,
  moveQuality,
  openingPerformance,
  pieceStats,
} from '../stats/insights';
import { DEFAULT_FILTERS, filterGames } from '../stats/aggregate';
import { replay, positionKey } from '../lib/chess';
import type { OpeningBook } from '../analysis/openings';
import type { Game, GameAnalysis, MoveAnalysis } from '../types';

const MOVES = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'Nf6', 'd3', 'O-O-O'].slice(0, 9);
const plies = replay(MOVES);
const key = (i: number) => positionKey(plies[i].fenAfter);
// Book: 1. e4 e5 2. Nf3 Nc6 3. Bc4 (Italian), then out of book.
const book: OpeningBook = {
  [key(0)]: ['B00', "King's Pawn Game"],
  [key(1)]: ['C20', "King's Pawn Game"],
  [key(2)]: ['C40', "King's Knight Opening"],
  [key(3)]: ['C44', "King's Knight Opening: Normal Variation"],
  [key(4)]: ['C50', 'Italian Game'],
};

const game = (over: Partial<Game>): Game => ({
  id: 'g',
  source: 'lichess',
  accountId: 'lichess:me',
  url: '',
  pgn: '',
  moves: MOVES,
  white: { name: 'me', rating: 1500 },
  black: { name: 'opp', rating: 1450 },
  userColor: 'white',
  outcome: 'win',
  termination: 'resignation',
  timeClass: 'blitz',
  timeControl: '180+0',
  endTime: new Date(2026, 9, 5, 21, 0).getTime(), // Monday 21:00 local
  rated: true,
  opening: { name: 'Italian Game' },
  ...over,
});

const move = (ply: number, accuracy: number, classification: MoveAnalysis['classification'] = 'best'): MoveAnalysis => ({
  ply,
  san: MOVES[ply],
  uci: '',
  color: ply % 2 ? 'black' : 'white',
  classification,
  winBefore: 50,
  winAfter: 50,
  accuracy,
  scoreAfter: { cp: 0 },
  phase: 'opening',
});

describe('facts', () => {
  it('finds castling, book exit and opening lines', () => {
    const f = computeFacts(game({}), book);
    expect(f.castle).toEqual({ ply: 6, side: 'short', phase: 'opening' });
    expect(f.bookPlies).toBe(5);
    // Ply 5 (…Bc5) is black's: the opponent left the book first, on move 3.
    expect(f.userLeftBook).toBe(false);
    expect(f.leftBookAtMove).toBe(3);
    expect(f.openingLine).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    expect(f.pieces.slice(0, 3)).toEqual(['p', 'p', 'n']);
    expect(f.endPhase).toBe('opening');
  });
  it('credits the book exit to the user when they deviate', () => {
    const f = computeFacts(game({ userColor: 'black' }), book);
    expect(f.userLeftBook).toBe(true);
    expect(bookMastery([game({ userColor: 'black', id: 'b' })], new Map([['b', f]]), 'black').average).toBe(3);
  });
});

describe('insights', () => {
  const g1 = game({ id: 'g1' });
  const g2 = game({ id: 'g2', outcome: 'loss', black: { name: 'opp', rating: 1720 }, rated: false, endTime: new Date(2026, 9, 7, 9, 0).getTime() });
  const games = [g1, g2];
  const analysis = (id: string, acc: number, moves: MoveAnalysis[]): GameAnalysis => ({
    gameId: id, depth: 10, version: 1, positions: [], createdAt: 0, accuracy: { white: acc, black: 50 }, moves,
  });
  const analyses = new Map([
    ['g1', analysis('g1', 90, [move(0, 100, 'book'), move(1, 80), move(2, 70, 'mistake')])],
    ['g2', analysis('g2', 60, [move(0, 100, 'book'), move(2, 50, 'blunder')])],
  ]);
  const facts = new Map(games.map((g) => [g.id, computeFacts(g, book)]));

  it('filters casual games out', () => {
    expect(filterGames(games, { ...DEFAULT_FILTERS, rated: 'rated' }).map((g) => g.id)).toEqual(['g1']);
  });
  it('buckets opponent ratings by 100', () => {
    expect(byOpponentRating(games, analyses).map((b) => [b.key, b.win, b.loss])).toEqual([['1400', 1, 0], ['1700', 0, 1]]);
  });
  it('averages accuracy by result and by move number', () => {
    expect(accuracyByResult(games, analyses)).toEqual({ win: 90, draw: undefined, loss: 60 });
    expect(accuracyByMoveNumber(games, analyses, 1)).toEqual([
      { move: 1, accuracy: 100, samples: 2 },
      { move: 2, accuracy: 60, samples: 2 },
    ]);
  });
  it('counts move quality for the user only', () => {
    const q = Object.fromEntries(moveQuality(games, analyses).map((r) => [r.classification, r.count]));
    expect(q).toMatchObject({ book: 2, mistake: 1, blunder: 1, best: 0 });
  });
  it('splits by piece, castling, time of day and weekday', () => {
    const pieces = Object.fromEntries(pieceStats(games, analyses, facts).map((r) => [r.piece, r.moves]));
    expect(pieces).toMatchObject({ p: 4, n: 2, b: 2, k: 2 });
    expect(castlingStats(games, analyses, facts).bySide.find((b) => b.key === 'short')?.games).toBe(2);
    expect(byDayPart(games, analyses).map((b) => b.games)).toEqual([0, 1, 0, 1]);
    expect(byWeekday(games, analyses).map((b) => b.games)).toEqual([0, 1, 0, 1, 0, 0, 0]);
  });
  it('reports opening performance with the most common line', () => {
    const [row] = openingPerformance(games, analyses, facts, 'white', true);
    expect(row).toMatchObject({ name: 'Italian Game', games: 2, win: 1, loss: 1, accuracy: 75 });
    expect(row.line).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
  });
});

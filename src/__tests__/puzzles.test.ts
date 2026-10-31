import { describe, expect, it } from 'vitest';
import { fromLichessResponse } from '../puzzles/source';
import { fenAt, judgeMove } from '../puzzles/solve';
import { INITIAL_RATING, updateRating } from '../puzzles/rating';

// Real /api/puzzle/next response (trimmed).
const API = {
  game: {
    id: 'SqZYEUHT',
    pgn: 'd4 e6 c4 d5 Nc3 Nf6 cxd5 exd5 Bg5 c6 e3 Bd6 Nf3 O-O Bd3 Bg4 O-O Nbd7 h3 Bh5 Qe2 Qc7 e4 dxe4 Nxe4 Nxe4 Qxe4 Bg6 Qe2 Bxd3 Qxd3 h6 Bd2 Rae8 Rac1 Re7 d5 c5 b4 b6 bxc5 Bxc5 Bb4 Rfe8',
  },
  puzzle: { id: '5Y95l', rating: 1498, solution: ['d5d6', 'c7d6', 'd3d6', 'c5d6', 'b4d6'], themes: ['fork'], initialPly: 43 },
};

describe('fromLichessResponse', () => {
  it('converts to FEN before the setup move + setup move and solution', () => {
    const p = fromLichessResponse(API);
    expect(p.moves).toEqual(['f8e8', 'd5d6', 'c7d6', 'd3d6', 'c5d6', 'b4d6']);
    // Same as the database row for this puzzle.
    expect(p.fen).toBe('5rk1/p1qnrpp1/1p5p/2bP4/1B6/3Q1N1P/P4PP1/2R2RK1 b - - 1 22');
    // The player's side is the one to move after the setup move.
    expect(fenAt(p.fen, p.moves, 1).split(' ')[1]).toBe('w');
  });
});

describe('judgeMove', () => {
  const p = fromLichessResponse(API);
  it('accepts the solution move and reports the end of the line', () => {
    expect(judgeMove(p.fen, p.moves, 1, 'd5d6')).toBe('correct');
    expect(judgeMove(p.fen, p.moves, 5, 'b4d6')).toBe('solved');
  });
  it('rejects other moves', () => {
    expect(judgeMove(p.fen, p.moves, 1, 'd3d1')).toBe('wrong');
    expect(judgeMove(p.fen, p.moves, 1, 'a1a8')).toBe('wrong');
  });
  it('accepts any checkmate', () => {
    // Back-rank mate where both Re8# and Rd8# work; the line only lists one.
    const fen = '6k1/p4ppp/8/8/8/8/5PPP/3RR1K1 b - - 0 1';
    const moves = ['a7a6', 'e1e8'];
    expect(judgeMove(fen, moves, 1, 'd1d8')).toBe('solved');
  });
});

describe('updateRating', () => {
  it('moves up on a solve, down on a miss, and narrows the deviation', () => {
    const up = updateRating(INITIAL_RATING, 1500, true);
    const down = updateRating(INITIAL_RATING, 1500, false);
    expect(up.rating).toBeGreaterThan(1500);
    expect(down.rating).toBeLessThan(1500);
    expect(up.rd).toBeLessThan(INITIAL_RATING.rd);
  });
  it('gains little for beating a much easier puzzle', () => {
    const r = { rating: 2000, rd: 60 };
    expect(updateRating(r, 1200, true).rating - 2000).toBeLessThan(2);
  });
});

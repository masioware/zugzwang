import { describe, expect, it } from 'vitest';
import { START_FEN } from '../lib/chess';
import { parseMove } from '../blindfold/parseMove';
import { describePosition, spokenMove } from '../blindfold/speech';
import { isBlindfoldFriendly, nextRating } from '../blindfold/prefs';

const san = (text: string, fen = START_FEN) => {
  const r = parseMove(text, fen);
  return r.ok ? r.san : r.reason;
};

describe('parseMove', () => {
  it('reads plain SAN, any case', () => {
    expect(san('e4')).toBe('e4');
    expect(san('Nf3')).toBe('Nf3');
    expect(san('nf3')).toBe('Nf3');
    expect(san('NF3')).toBe('Nf3');
  });

  it('reads coordinates', () => {
    expect(san('e2e4')).toBe('e4');
    expect(san('e2-e4')).toBe('e4');
    expect(san('g1 f3')).toBe('Nf3');
  });

  it('reads spoken Portuguese and English', () => {
    expect(san('cavalo f 3')).toBe('Nf3');
    expect(san('cavalo f três')).toBe('Nf3');
    expect(san('knight f3')).toBe('Nf3');
    expect(san('peão e quatro')).toBe('e4');
  });

  it('reads castling in all forms', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    expect(san('O-O', fen)).toBe('O-O');
    expect(san('0-0-0', fen)).toBe('O-O-O');
    expect(san('roque pequeno', fen)).toBe('O-O');
    expect(san('roque grande', fen)).toBe('O-O-O');
    expect(san('castles long', fen)).toBe('O-O-O');
  });

  it('tells a pawn capture from a bishop move', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3p4/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 0 1';
    expect(san('dxe4', fen)).toBe('dxe4');
    const bishop = '4k3/8/8/8/8/2p5/8/B3K3 w - - 0 1';
    expect(san('bxc3', bishop)).toBe('Bxc3');
  });

  it('reads promotions', () => {
    const fen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
    expect(san('a8=Q', fen)).toBe('a8=Q+');
    expect(san('a8n', fen)).toBe('a8=N');
    const r = parseMove('a7a8r', fen);
    expect(r.ok && r.promotion).toBe('r');
  });

  it('returns the piece for the solver', () => {
    const r = parseMove('e4', START_FEN);
    expect(r.ok && r.piece).toBe('wP');
    const n = parseMove('nf6', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(n.ok && n.piece).toBe('bN');
  });

  it('rejects illegal moves and empty input', () => {
    expect(san('e5')).toBe('invalid');
    expect(san('Nf6')).toBe('invalid');
    expect(san('   ')).toBe('empty');
    expect(san('banana')).toBe('invalid');
  });
});

describe('spokenMove', () => {
  it('speaks pieces, captures, check and mate', () => {
    expect(spokenMove('Nf3', 'pt')).toBe('Cavalo f 3');
    expect(spokenMove('Nxe5+', 'en')).toBe('Knight takes e 5 check');
    expect(spokenMove('exd5', 'en')).toBe('e takes d 5');
    expect(spokenMove('Qh7#', 'pt')).toBe('Dama h 7 xeque-mate');
    expect(spokenMove('O-O', 'pt')).toBe('roque pequeno');
    expect(spokenMove('e8=Q', 'en')).toBe('e 8 promotes to Queen');
    expect(spokenMove('Rad1', 'en')).toBe('Rook a d 1');
  });
});

describe('describePosition', () => {
  it('lists every piece by kind', () => {
    const d = describePosition(START_FEN, 'en');
    expect(d.white).toBe('King e1. Queen d1. Rook a1 h1. Bishop c1 f1. Knight b1 g1. Pawn a2 b2 c2 d2 e2 f2 g2 h2');
    expect(describePosition(START_FEN, 'pt').black.startsWith('Rei e8')).toBe(true);
  });
});

describe('level', () => {
  it('moves the rating with the result, within bounds', () => {
    expect(nextRating(600, true)).toBe(650);
    expect(nextRating(600, false)).toBe(550);
    expect(nextRating(400, false)).toBe(400);
    expect(nextRating(2400, true)).toBe(2400);
  });

  it('keeps short lines only', () => {
    expect(isBlindfoldFriendly({ moves: ['a', 'b', 'c'] })).toBe(true);
    expect(isBlindfoldFriendly({ moves: ['a', 'b', 'c', 'd', 'e'] })).toBe(true);
    expect(isBlindfoldFriendly({ moves: ['a', 'b', 'c', 'd', 'e', 'f'] })).toBe(false);
  });
});

import { Chess } from 'chess.js';
import { makeQuestion, knightMoves, sameDiagonal, squareColor, nextLevel, DRILL_KINDS } from '../blindfold/drills';
import { drillSummaries, gameSummary, puzzleSummary } from '../blindfold/stats';
import type { Game, PuzzleAttempt } from '../types';

/** Deterministic RNG (mulberry32). */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('drill geometry', () => {
  it('colours squares', () => {
    expect(squareColor('a1')).toBe('dark');
    expect(squareColor('h1')).toBe('light');
    expect(squareColor('e4')).toBe('light');
    expect(squareColor('d4')).toBe('dark');
  });

  it('knows knight and diagonal relations', () => {
    expect(knightMoves('g1').sort()).toEqual(['e2', 'f3', 'h3']);
    expect(knightMoves('d4')).toHaveLength(8);
    expect(sameDiagonal('a1', 'h8')).toBe(true);
    expect(sameDiagonal('a1', 'a2')).toBe(false);
    expect(sameDiagonal('c1', 'c1')).toBe(false);
  });
});

describe('makeQuestion', () => {
  it('always has a correct answer among its options', () => {
    for (const kind of DRILL_KINDS)
      for (let i = 0; i < 60; i++) {
        const q = makeQuestion(kind, seeded(i + 1), i % 4);
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(q.options.length);
      }
  });

  it('answers are true to the board', () => {
    for (let i = 0; i < 80; i++) {
      const rng = seeded(i + 100);
      const k = makeQuestion('knight', rng);
      expect(k.answer === 'yes').toBe(knightMoves(k.squares[0]).includes(k.squares[1]));
      const b = makeQuestion('bishop', rng);
      expect(b.answer === 'yes').toBe(sameDiagonal(b.squares[0], b.squares[1]));
      const c = makeQuestion('color', rng);
      expect(c.answer).toBe(squareColor(c.squares[0]));
      const p = makeQuestion('board', rng, 2);
      const chess = new Chess();
      p.moves!.forEach((m) => chess.move(m));
      const piece = chess.get(p.squares[0] as never);
      expect(p.answer).toBe(piece ? piece.color + piece.type.toUpperCase() : 'empty');
    }
  });

  it('balances yes and no', () => {
    let yes = 0;
    for (let i = 0; i < 200; i++) yes += makeQuestion('knight', seeded(i)).answer === 'yes' ? 1 : 0;
    expect(yes).toBeGreaterThan(60);
    expect(yes).toBeLessThan(140);
  });

  it('lengthens board lines with the level', () => {
    expect(makeQuestion('board', seeded(5), 0).moves!.length).toBeLessThanOrEqual(4);
    expect(makeQuestion('board', seeded(5), 3).moves!.length).toBeGreaterThan(4);
  });

  it('adjusts the level by round result', () => {
    expect(nextLevel(2, 10, 10)).toBe(3);
    expect(nextLevel(2, 7, 10)).toBe(2);
    expect(nextLevel(2, 3, 10)).toBe(1);
    expect(nextLevel(0, 0, 10)).toBe(0);
    expect(nextLevel(6, 10, 10)).toBe(6);
  });
});

describe('blindfold stats', () => {
  it('summarises drill rounds per kind', () => {
    const runs = [
      { kind: 'color' as const, startedAt: 1, durationMs: 20_000, correct: 8, total: 10 },
      { kind: 'color' as const, startedAt: 2, durationMs: 10_000, correct: 10, total: 10 },
    ];
    const [s] = drillSummaries(runs);
    expect(s).toMatchObject({ kind: 'color', rounds: 2, best: 1, recent: 0.9, secondsPerQuestion: 1.5 });
    expect(drillSummaries([])).toEqual([]);
  });

  it('summarises puzzles and games', () => {
    const a = (mode: PuzzleAttempt['mode'], solved: boolean, puzzleRating: number) => ({ mode, solved, puzzleRating }) as PuzzleAttempt;
    expect(puzzleSummary([a('blindfold', true, 700), a('blindfold', false, 900), a('sprint', true, 2000)])).toEqual({ total: 2, solved: 1, hardest: 700 });
    expect(puzzleSummary([])).toEqual({ total: 0, solved: 0, hardest: undefined });
    const g = (outcome: Game['outcome'], blindfold?: boolean, blindfoldPeeks?: number) => ({ outcome, blindfold, blindfoldPeeks }) as Game;
    expect(gameSummary([g('win', true, 0), g('loss', true, 2), g('win'), g('draw', true)])).toEqual({ win: 1, draw: 1, loss: 1, clean: 2 });
  });
});

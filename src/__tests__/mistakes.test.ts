import { describe, expect, it } from 'vitest';
import { collectMistakes } from '../training/mistakes';
import { ownPuzzle } from '../training/exercises';
import { judgeMove } from '../puzzles/solve';
import type { Game, GameAnalysis, MoveAnalysis } from '../types';

const mv = (ply: number, over: Partial<MoveAnalysis>): MoveAnalysis => ({
  ply, san: 'x', uci: 'a2a3', color: 'white', classification: 'good', winBefore: 50, winAfter: 50,
  accuracy: 100, scoreAfter: { cp: 0 }, phase: 'middlegame', ...over,
});

// 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 (the user, white, plays Ng5 on ply 6 and the engine wanted d3)
const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5', 'd5'];
const game = { id: 'g', userColor: 'white', moves, white: { name: 'me' }, black: { name: 'them' } } as unknown as Game;
const analysisOf = (ms: MoveAnalysis[]) => new Map([['g', { gameId: 'g', moves: ms } as unknown as GameAnalysis]]);

describe('collectMistakes', () => {
  const blunder = mv(6, { uci: 'f3g5', classification: 'blunder', winBefore: 55, winAfter: 20, bestUci: 'd2d3', bestSan: 'd3' });

  it('turns a serious mistake into a candidate with the previous opponent move as setup', () => {
    const [m] = collectMistakes([game], analysisOf([blunder]));
    expect(m.id).toBe('own:g:6');
    expect(m.example.setup?.uci).toBe('g8f6');
    expect(m.example.loss).toBe(35);
    expect(m.themes).toContain('middlegame');
  });

  it('ignores small slips, the opponent\'s moves, and moves without a better alternative', () => {
    const small = { ...blunder, winAfter: 50 };
    const theirs = { ...blunder, color: 'black' as const };
    const noBest = { ...blunder, bestUci: undefined };
    const same = { ...blunder, bestUci: blunder.uci };
    expect(collectMistakes([game], analysisOf([small, theirs, noBest, same]))).toEqual([]);
  });

  it('skips a first move, which has no setup move, and sorts worst first', () => {
    const first = mv(0, { uci: 'e2e3', classification: 'blunder', winBefore: 60, winAfter: 10, bestUci: 'e2e4' });
    const out = collectMistakes([game], analysisOf([first, blunder, { ...blunder, ply: 4, winAfter: 30 }]));
    expect(out.map((m) => m.example.ply)).toEqual([6, 4]);
  });

  it('respects the minimum loss', () => {
    expect(collectMistakes([game], analysisOf([blunder]), 40)).toEqual([]);
  });

  it('builds a puzzle that accepts the engine move and rejects the mistake', () => {
    const [m] = collectMistakes([game], analysisOf([blunder]));
    const p = ownPuzzle(m.example, m.themes)!;
    expect(p.moves).toEqual(['g8f6', 'd2d3']);
    expect(judgeMove(p.fen, p.moves, 1, 'd2d3')).toBe('solved');
    expect(judgeMove(p.fen, p.moves, 1, 'f3g5')).toBe('wrong');
  });
});

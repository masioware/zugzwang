import { describe, expect, it } from 'vitest';
import { tacticTags } from '../training/tags';
import { diagnose } from '../training/diagnose';
import type { Game, GameAnalysis, MoveAnalysis } from '../types';

describe('tacticTags', () => {
  it('flags a move that leaves a piece hanging', () => {
    // Knight to h4 where the black queen takes it for free.
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 2';
    expect(tacticTags({ fenBefore: fen, playedUci: 'f3h4', bestUci: 'e2e4' })).toContain('hungPiece');
    expect(tacticTags({ fenBefore: fen, playedUci: 'e2e4', bestUci: 'e2e4' })).not.toContain('hungPiece');
  });
  it('flags a missed free piece', () => {
    const fen = 'rnb1kbnr/pppp1ppp/8/3q4/8/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 1';
    expect(tacticTags({ fenBefore: fen, playedUci: 'a2a3', bestUci: 'c3d5' })).toContain('missedCapture');
  });
  it('flags a missed mate from the best move notation', () => {
    expect(tacticTags({ fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', playedUci: 'a7a6', bestUci: 'd8h4', bestSan: 'Qh4#' })).toContain('missedMate');
  });
  it('flags a queen taken by a defended pawn target', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3';
    expect(tacticTags({ fenBefore: fen, playedUci: 'h5e5', bestUci: 'f1c4' })).toContain('hungPiece');
  });
  it('flags a missed knight fork', () => {
    // Nc7+ forks king on e8 and rook on a8.
    const fen = 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1';
    expect(tacticTags({ fenBefore: fen, playedUci: 'e1e2', bestUci: 'd5c7' })).toContain('missedFork');
  });
});

const mv = (ply: number, over: Partial<MoveAnalysis>): MoveAnalysis => ({
  ply, san: 'x', uci: 'a2a3', color: 'white', classification: 'good', winBefore: 50, winAfter: 50,
  accuracy: 100, scoreAfter: { cp: 0 }, phase: 'middlegame', ...over,
});

describe('diagnose', () => {
  it('only reports contexts clearly worse than the baseline, with enough samples', () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6'];
    const game = { id: 'g', userColor: 'white', moves, opening: { name: 'Ruy Lopez: Morphy' } } as unknown as Game;
    const ms: MoveAnalysis[] = [];
    for (let i = 1; i <= 8; i += 2) ms.push(mv(i, { phase: i < 5 ? 'opening' : 'endgame', classification: i < 5 ? 'good' : 'blunder', winAfter: 20 }));
    const analysis = { gameId: 'g', moves: ms } as unknown as GameAnalysis;
    // Not enough samples (< MIN_CONTEXT) from one game of 4 moves.
    expect(diagnose([game], new Map([['g', analysis]]))).toEqual([]);
    const games = Array.from({ length: 4 }, (_, i) => ({ ...game, id: `g${i}` }) as Game);
    const map = new Map(games.map((g) => [g.id, { ...analysis, gameId: g.id }]));
    const found = diagnose(games, map);
    expect(found.map((w) => w.id)).toContain('phase:endgame');
    expect(found.map((w) => w.id)).not.toContain('phase:opening');
  });
});

import { ownPuzzle, solutionLine, themeFor } from '../training/exercises';
import { judgeMove } from '../puzzles/solve';

describe('exercises', () => {
  const example = {
    gameId: 'g', ply: 2, fenBefore: 'x', playedUci: 'a2a3', bestUci: 'd5c7', loss: 30,
    setup: { fen: 'r3k3/8/8/3N4/8/8/8/4K3 b - - 0 1', uci: 'a8a7' },
  };
  it('builds a puzzle that lands on the position of the mistake and accepts the best move', () => {
    const p = ownPuzzle(example, ['fork'])!;
    expect(p.moves).toEqual(['a8a7', 'd5c7']);
    expect(p.origin).toBe('own');
    expect(judgeMove(p.fen, p.moves, 1, 'd5c7')).toBe('solved');
    expect(judgeMove(p.fen, p.moves, 1, 'e1e2')).toBe('wrong');
  });
  it('has nothing to solve without a setup move or an engine move', () => {
    expect(ownPuzzle({ ...example, setup: undefined }, [])).toBeUndefined();
    expect(ownPuzzle({ ...example, bestUci: undefined }, [])).toBeUndefined();
  });
  it('keeps the forced mate as the solution, ending on the player move', () => {
    const top = { mate: 2, pv: ['d5c7', 'e8d8', 'c7a8', 'd8e8'], depth: 16 };
    expect(solutionLine(example, top)).toEqual(['d5c7', 'e8d8', 'c7a8']);
    expect(solutionLine(example, { cp: 300, pv: ['d5c7'], depth: 16 })).toEqual(['d5c7']);
  });
  it('maps weaknesses to Lichess themes', () => {
    expect(themeFor({ kind: 'tactic', key: 'missedFork' })).toBe('fork');
    expect(themeFor({ kind: 'time', key: 'lowClock' })).toBeUndefined();
  });
});

describe('diagnose examples', () => {
  it('points at the position before the mistaken move and carries the opponent setup move', () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'];
    const game = { id: 'g', userColor: 'white', moves, opening: { name: 'Ruy Lopez' } } as unknown as Game;
    // White's third move (index 4, Bb5) is flagged as a blunder.
    const ms = moves.map((_, i) => mv(i, { color: i % 2 ? 'black' : 'white', san: moves[i], uci: 'x', phase: i < 4 ? 'opening' : 'middlegame', classification: i === 4 ? 'blunder' : 'good', winAfter: i === 4 ? 10 : 50 }));
    const games = Array.from({ length: 5 }, (_, i) => ({ ...game, id: `g${i}` }) as Game);
    const map = new Map(games.map((g) => [g.id, { gameId: g.id, moves: ms } as unknown as GameAnalysis]));
    const found = diagnose(games, map).find((w) => w.id === 'phase:middlegame');
    const e = found?.examples[0];
    expect(e?.ply).toBe(4);
    expect(e?.fenBefore.split(' ')[1]).toBe('w');
    expect(e?.setup?.uci).toBe('b8c6');
  });
});

import { buildPath, cleanStreak, drillTarget, DRILL_STREAK } from '../training/path';
import type { Weakness } from '../training/diagnose';

const weak = (id: string): Weakness => ({ id: id as Weakness['id'], kind: 'tactic', key: id, count: 5, opportunities: 100, rate: 5, loss: 50, examples: [] });

describe('path', () => {
  it('counts only the clean solves at the end', () => {
    const a = (solved: boolean, startedAt: number) => ({ solved, startedAt });
    expect(cleanStreak([a(true, 1), a(false, 2), a(true, 3), a(true, 4)])).toBe(2);
    expect(cleanStreak([a(true, 4), a(false, 5)])).toBe(0);
    expect(cleanStreak([])).toBe(0);
  });
  it('asks for fewer solves when the lesson is short, never none', () => {
    expect(drillTarget(20)).toBe(DRILL_STREAK);
    expect(drillTarget(3)).toBe(3);
    expect(drillTarget(0)).toBe(1);
  });
  it('opens one lesson at a time, in ranking order', () => {
    const ws = [weak('a'), weak('b'), weak('c')];
    expect(buildPath(ws, []).map((n) => n.status)).toEqual(['active', 'locked', 'locked']);
    const b = { id: 'a', passedAt: 1, baseline: { rate: 5, count: 5, opportunities: 100 } };
    const path = buildPath(ws, [b]);
    expect(path.map((n) => [n.weakness.id, n.status])).toEqual([['a', 'done'], ['b', 'active'], ['c', 'locked']]);
  });
  it('keeps drilled lessons in place when the ranking changes, and drops those no longer found', () => {
    const progress = [
      { id: 'c', passedAt: 1, baseline: { rate: 1, count: 1, opportunities: 1 } },
      { id: 'gone', passedAt: 2, baseline: { rate: 1, count: 1, opportunities: 1 } },
    ];
    const path = buildPath([weak('a'), weak('b'), weak('c')], progress);
    expect(path.map((n) => n.weakness.id)).toEqual(['c', 'a', 'b']);
    expect(path.map((n) => n.status)).toEqual(['done', 'active', 'locked']);
  });
  it('has nothing locked when everything is drilled', () => {
    const p = { passedAt: 1, baseline: { rate: 1, count: 1, opportunities: 1 } };
    expect(buildPath([weak('a')], [{ id: 'a', ...p }]).map((n) => n.status)).toEqual(['done']);
  });
});

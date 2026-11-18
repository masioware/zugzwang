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

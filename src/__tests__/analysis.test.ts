import { describe, expect, it } from 'vitest';
import { formatScore, winPercent, winPercentFor } from '../analysis/winprob';
import { gameAccuracy, moveAccuracy } from '../analysis/accuracy';
import { analyseMoves, classifyByLoss, isSacrifice, positionScore } from '../analysis/classify';
import { phaseOf } from '../analysis/phases';
import { identifyOpening, openingFamily } from '../analysis/openings';
import { replay } from '../lib/chess';
import type { EngineLine } from '../types';

describe('winPercent', () => {
  it('is 50 for an equal position and symmetric', () => {
    expect(winPercent({ cp: 0 })).toBeCloseTo(50);
    expect(winPercent({ cp: 300 }) + winPercent({ cp: -300 })).toBeCloseTo(100);
  });
  it('matches the Lichess curve', () => {
    expect(winPercent({ cp: 100 })).toBeCloseTo(59.1, 1);
  });
  it('treats mate like a capped advantage', () => {
    expect(winPercent({ mate: 3 })).toBeCloseTo(winPercent({ cp: 1000 }));
    expect(winPercent({ mate: -1 })).toBeLessThan(5);
    expect(winPercentFor({ mate: 2 }, 'black')).toBeLessThan(5);
  });
  it('formats scores', () => {
    expect(formatScore({ cp: 124 })).toBe('+1.24');
    expect(formatScore({ cp: -30 })).toBe('-0.30');
    expect(formatScore({ mate: -2 })).toBe('-M2');
  });
});

describe('accuracy', () => {
  it('is 100 when the position does not get worse', () => {
    expect(moveAccuracy(60, 60)).toBe(100);
    expect(moveAccuracy(60, 70)).toBe(100);
  });
  it('drops sharply with large win% losses', () => {
    expect(moveAccuracy(50, 45)).toBeGreaterThan(80);
    expect(moveAccuracy(80, 20)).toBeLessThan(10);
  });
  it('computes per-side game accuracy', () => {
    const wins = [50, 50, 50, 50, 20];
    const accs = [100, 100, 100, moveAccuracy(50, 20)];
    const acc = gameAccuracy(wins, accs);
    expect(acc.white).toBeCloseTo(100);
    expect(acc.black).toBeLessThan(acc.white);
  });
});

describe('classification', () => {
  it('maps win% loss to categories', () => {
    expect(classifyByLoss(1)).toBe('excellent');
    expect(classifyByLoss(3)).toBe('good');
    expect(classifyByLoss(7)).toBe('inaccuracy');
    expect(classifyByLoss(15)).toBe('mistake');
    expect(classifyByLoss(40)).toBe('blunder');
  });

  it('detects a piece left en prise', () => {
    // 1. e4 e5 2. Bc4 Nc6 3. Bxf7+ gives a bishop for a pawn.
    const plies = replay(['e4', 'e5', 'Bc4', 'Nc6', 'Bxf7+']);
    expect(isSacrifice(plies[4])).toBe(true);
    // A normal developing move is not a sacrifice.
    expect(isSacrifice(plies[2])).toBe(false);
  });

  it('scores checkmate positions without engine lines', () => {
    const plies = replay(['f3', 'e5', 'g4', 'Qh4#']);
    expect(winPercent(positionScore([], plies[3].fenAfter))).toBeLessThan(5);
  });

  it('classifies a blunder and a best move', () => {
    const plies = replay(['f3', 'e5', 'g4', 'Qh4#']);
    const line = (cp: number | undefined, pv: string, mate?: number): EngineLine[] => [
      { cp, mate, pv: [pv], depth: 10 },
    ];
    const positions: EngineLine[][] = [
      line(30, 'e2e4'),
      line(-40, 'e7e5'),
      line(-40, 'e2e4'),
      line(undefined, 'd8h4', -1),
      [],
    ];
    const { moves, accuracy } = analyseMoves({ plies, positions, bookPlies: 0 });
    expect(moves[2].classification).toBe('blunder');
    expect(moves[3].classification).toBe('best');
    expect(moves[3].bestSan).toBe('Qh4#');
    expect(accuracy.black).toBeGreaterThan(accuracy.white);
  });

  it('marks book moves', () => {
    const plies = replay(['e4', 'e5']);
    const positions: EngineLine[][] = [[{ cp: 30, pv: ['e2e4'], depth: 10 }], [{ cp: 30, pv: ['e7e5'], depth: 10 }], [{ cp: 30, pv: ['g1f3'], depth: 10 }]];
    const { moves } = analyseMoves({ plies, positions, bookPlies: 2 });
    expect(moves.map((m) => m.classification)).toEqual(['book', 'book']);
  });
});

describe('phases & openings', () => {
  it('detects phases by material', () => {
    expect(phaseOf('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 0, false)).toBe('opening');
    expect(phaseOf('4k3/8/8/8/8/8/4P3/4K2R w - - 0 1', 60, false)).toBe('endgame');
  });
  it('finds the deepest named opening and book length', () => {
    const plies = replay(['e4', 'c5', 'Nf3', 'Qc7']);
    const book = {
      [plies[0].fenAfter.split(' ').slice(0, 4).join(' ')]: ['B00', "King's Pawn Game"] as [string, string],
      [plies[1].fenAfter.split(' ').slice(0, 4).join(' ')]: ['B20', 'Sicilian Defense'] as [string, string],
      [plies[2].fenAfter.split(' ').slice(0, 4).join(' ')]: null,
    };
    expect(identifyOpening(plies.map((p) => p.fenAfter), book)).toEqual({ eco: 'B20', name: 'Sicilian Defense', bookPlies: 3 });
    expect(openingFamily('Sicilian Defense: Najdorf Variation')).toBe('Sicilian Defense');
  });
});

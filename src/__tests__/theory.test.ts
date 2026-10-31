import { describe, expect, it } from 'vitest';
import { inOpening, theoryMove, theoryMoves, type Theory } from '../play/theory';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

const theory: Theory = {
  names: ['Sicilian Defense', 'Sicilian Defense: Najdorf Variation', 'Sicilian Defense: Najdorf Variation, English Attack', 'French Defense', "Queen's Pawn Game"],
  tree: {
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -': [['e4', [0, 1, 2, 3]], ['d4', [4]]],
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -': [['c5', [0, 1, 2]], ['e6', [3]]],
  },
};

describe('theory', () => {
  it('matches an opening and its sub-variations only', () => {
    expect(inOpening('Sicilian Defense: Najdorf Variation, English Attack', 'Sicilian Defense: Najdorf Variation')).toBe(true);
    expect(inOpening('Sicilian Defense: Najdorf Variation', 'Sicilian Defense')).toBe(true);
    expect(inOpening('Sicilian Defense', 'Sicilian Defense: Najdorf Variation')).toBe(false);
    expect(inOpening('Sicilian Defenses', 'Sicilian Defense')).toBe(false);
  });

  it('lists the moves on the target\'s lines, most lines first', () => {
    expect(theoryMoves(theory, START)).toEqual([{ san: 'e4', n: 4 }, { san: 'd4', n: 1 }]);
    expect(theoryMoves(theory, START, 'Sicilian Defense: Najdorf Variation')).toEqual([{ san: 'e4', n: 2 }]);
    expect(theoryMoves(theory, AFTER_E4, 'French Defense')).toEqual([{ san: 'e6', n: 1 }]);
  });

  it('has nothing to say out of theory', () => {
    expect(theoryMoves(theory, AFTER_E4, "Queen's Pawn Game")).toEqual([]);
    expect(theoryMove(theory, 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2')).toBeUndefined();
  });
});

describe('theory data', () => {
  it('reaches the Najdorf from the start position through its own lines', async () => {
    const { readFileSync } = await import('node:fs');
    const real = JSON.parse(readFileSync('public/data/theory.json', 'utf8')) as Theory;
    const { Chess } = await import('chess.js');
    const chess = new Chess();
    // Follow the most-lines theory move for the Najdorf until it's reached.
    for (let i = 0; i < 10; i++) {
      const san = theoryMoves(real, chess.fen(), 'Sicilian Defense: Najdorf Variation')[0]?.san;
      if (!san) break;
      chess.move(san);
    }
    expect(chess.history().slice(0, 10)).toEqual(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']);
  });
});

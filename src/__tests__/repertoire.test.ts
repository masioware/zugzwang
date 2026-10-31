import { describe, expect, it } from 'vitest';
import { bookMove, buildRepertoire, movesAt, sourceColor, variations, weightedPick } from '../play/repertoire';
import type { Game } from '../types';
import type { GameFacts } from '../stats/facts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

describe('repertoire', () => {
  const games = [
    { moves: ['e4', 'c5', 'Nf3'], userColor: 'white' as const },
    { moves: ['e4', 'c5', 'Nc3'], userColor: 'white' as const },
    { moves: ['e4', 'e5', 'Nf3'], userColor: 'white' as const },
    { moves: ['d4', 'd5'], userColor: 'black' as const },
  ];
  const rep = buildRepertoire(games);

  it('splits moves into the user\'s and the opponents\'', () => {
    expect(movesAt(rep, START, 'mine')).toEqual([{ san: 'e4', n: 3 }]);
    expect(movesAt(rep, START, 'theirs')).toEqual([{ san: 'd4', n: 1 }]);
    expect(movesAt(rep, AFTER_E4, 'theirs')).toEqual([{ san: 'c5', n: 2 }, { san: 'e5', n: 1 }]);
    expect(movesAt(rep, AFTER_E4, 'mine')).toEqual([]);
  });

  it('meets transpositions in the same position', () => {
    const t = buildRepertoire([
      { moves: ['Nf3', 'Nf6', 'd4', 'd5'], userColor: 'white' },
      { moves: ['d4', 'Nf6', 'Nf3', 'e6'], userColor: 'white' },
    ]);
    // 1.Nf3 Nf6 2.d4 and 1.d4 Nf6 2.Nf3 reach the same position; both replies are counted there.
    const fen = 'rnbqkb1r/pppppppp/5n2/8/3P4/5N2/PPP1PPPP/RNBQKB1R b KQkq - 2 2';
    expect(movesAt(t, fen, 'theirs')).toEqual([{ san: 'd5', n: 1 }, { san: 'e6', n: 1 }]);
  });

  it('picks moves in proportion to how often they were played', () => {
    const moves = [{ san: 'c5', n: 2 }, { san: 'e5', n: 1 }];
    expect(weightedPick(moves, 0)).toBe('c5');
    expect(weightedPick(moves, 0.66)).toBe('c5');
    expect(weightedPick(moves, 0.67)).toBe('e5');
    expect(weightedPick([], 0.5)).toBeUndefined();
  });

  it('lists openings with their most common line', () => {
    const g = (id: string, name: string) => ({ id, opening: { name, eco: 'B20' } }) as unknown as Game;
    const f = (line: string[]) => ({ openingLine: line }) as GameFacts;
    const list = variations(
      [g('1', 'Sicilian'), g('2', 'Sicilian'), g('3', 'Sicilian'), g('4', 'French')],
      new Map([['1', f(['e4', 'c5'])], ['2', f(['e4', 'c5'])], ['3', f(['c4', 'c5', 'e4'])], ['4', f(['e4', 'e6'])]]),
    );
    expect(list).toEqual([
      { name: 'Sicilian', eco: 'B20', n: 3, line: ['e4', 'c5'] },
      { name: 'French', eco: 'B20', n: 1, line: ['e4', 'e6'] },
    ]);
  });

  it('feeds the bot from the right games', () => {
    expect(sourceColor('white', 'opponents')).toBe('white');
    expect(sourceColor('white', 'me')).toBe('black');
  });

  it('follows the chosen line, then the repertoire, then hands over to the engine', () => {
    const line = ['e4', 'e5'];
    // On the line: the line's move, whatever the repertoire says.
    expect(bookMove(['e4'], AFTER_E4, rep, 'theirs', line, 0)).toEqual({ san: 'e5', source: 'line' });
    // Off the line (the game went 1.d4): back to the repertoire.
    expect(bookMove([], START, rep, 'theirs', ['c4'], 0)).toEqual({ san: 'c4', source: 'line' });
    expect(bookMove(['e4'], AFTER_E4, rep, 'theirs', ['d4', 'd5'], 0)).toEqual({ san: 'c5', source: 'repertoire', n: 2, total: 3 });
    // Nothing known here: the engine plays.
    expect(bookMove(['e4'], AFTER_E4, rep, 'mine', undefined, 0)).toBeUndefined();
  });
});

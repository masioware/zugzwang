import { Chess } from 'chess.js';
import type { Color, Outcome, Termination } from '../types';

export interface Result {
  outcome: Outcome;
  termination: Termination;
}

/** The game's result after the last move, from chess.js (which needs the whole history for repetitions). */
export function gameOver(moves: string[], userColor: Color): Result | null {
  const chess = new Chess();
  for (const m of moves) chess.move(m);
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) {
    const loser: Color = chess.turn() === 'w' ? 'white' : 'black';
    return { outcome: loser === userColor ? 'loss' : 'win', termination: 'checkmate' };
  }
  const termination: Termination = chess.isStalemate()
    ? 'stalemate'
    : chess.isThreefoldRepetition()
      ? 'repetition'
      : chess.isInsufficientMaterial()
        ? 'insufficient'
        : chess.isDrawByFiftyMoves()
          ? 'fiftyMove'
          : 'other';
  return { outcome: 'draw', termination };
}

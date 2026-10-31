import { Chess } from 'chess.js';
import type { Color, Puzzle } from '../types';

export type MoveVerdict = 'correct' | 'solved' | 'wrong';

/**
 * Judges the player's move at `ply` (an index into puzzle.moves, always a player move). Any checkmate is
 * accepted, as on Lichess, since mate-in-N puzzles can have alternative mating moves on the last move.
 */
export function judgeMove(fen: string, moves: string[], ply: number, uci: string): MoveVerdict {
  const chess = new Chess(fen);
  for (const m of moves.slice(0, ply)) chess.move(toMove(m));
  try {
    chess.move(toMove(uci));
  } catch {
    return 'wrong';
  }
  if (chess.isCheckmate()) return 'solved';
  if (uci !== moves[ply]) return 'wrong';
  // The opponent's reply is part of the line, so the puzzle ends after the player's last move.
  return ply + 1 >= moves.length ? 'solved' : 'correct';
}

export function toMove(uci: string) {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

/** FEN after the first `ply` moves of the puzzle line. */
export function fenAt(fen: string, moves: string[], ply: number): string {
  const chess = new Chess(fen);
  for (const m of moves.slice(0, ply)) chess.move(toMove(m));
  return chess.fen();
}

/** The side the player solves for: the one to move after the setup move. */
export function playerColor(puzzle: Pick<Puzzle, 'fen'>): Color {
  // The setup move is the opponent's, so the player is whoever is *not* to move in the stored FEN.
  return puzzle.fen.split(' ')[1] === 'w' ? 'black' : 'white';
}

/** Puzzle facts copied onto each attempt for statistics. */
export function puzzleFacts(puzzle: Puzzle): { themes: string[]; color: Color; length: number } {
  return { themes: puzzle.themes, color: playerColor(puzzle), length: Math.floor(puzzle.moves.length / 2) };
}

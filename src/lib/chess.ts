import { Chess } from 'chess.js';

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** FEN without the halfmove/fullmove counters; identifies a position for opening lookup. */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function parseClock(text: string): number {
  const parts = text.split(':').map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Extracts SAN moves and `[%clk]` annotations (seconds) from a PGN. */
export function parsePgn(pgn: string): { moves: string[]; clocks: number[] } {
  const chess = new Chess();
  chess.loadPgn(pgn);
  const moves = chess.history();
  const clocks = [...pgn.matchAll(/\[%clk\s+([\d:.]+)\]/g)].map((m) => parseClock(m[1]));
  return { moves, clocks: clocks.length === moves.length ? clocks : [] };
}

export interface Ply {
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  color: 'white' | 'black';
  from: string;
  to: string;
  captured?: string;
  piece: string;
}

/** Replays SAN moves from the start position. */
export function replay(moves: string[]): Ply[] {
  const chess = new Chess();
  return moves.map((san) => {
    const fenBefore = chess.fen();
    const m = chess.move(san);
    return {
      san: m.san,
      uci: m.from + m.to + (m.promotion ?? ''),
      fenBefore,
      fenAfter: chess.fen(),
      color: m.color === 'w' ? 'white' : 'black',
      from: m.from,
      to: m.to,
      captured: m.captured,
      piece: m.piece,
    };
  });
}

export function uciToSan(fen: string, uci: string): string | undefined {
  try {
    const chess = new Chess(fen);
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
  } catch {
    return undefined;
  }
}

/** Converts a UCI principal variation into SAN, stopping at the first illegal move. */
export function pvToSan(fen: string, pv: string[]): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv) {
    try {
      out.push(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
    } catch {
      break;
    }
  }
  return out;
}

export function sideToMove(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'w' ? 'white' : 'black';
}

export function fullmoveNumber(fen: string): number {
  return Number(fen.split(' ')[5] ?? 1);
}

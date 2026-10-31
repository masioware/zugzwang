import type { Phase } from '../types';

const VALUES: Record<string, number> = { q: 9, r: 5, b: 3, n: 3 };

/** Total non-pawn material on the board (both sides). */
export function nonPawnMaterial(fen: string): number {
  let total = 0;
  for (const ch of fen.split(' ')[0]) total += VALUES[ch.toLowerCase()] ?? 0;
  return total;
}

/**
 * Coarse game phase of a position: endgame once little material is left, opening
 * while still in book or during the first moves, middlegame otherwise.
 */
export function phaseOf(fen: string, ply: number, inBook: boolean): Phase {
  const material = nonPawnMaterial(fen);
  if (material <= 26) return 'endgame';
  if (inBook || (ply < 20 && material >= 56)) return 'opening';
  return 'middlegame';
}

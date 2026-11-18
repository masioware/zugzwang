import { Chess, type Color as CjsColor, type PieceSymbol, type Square } from 'chess.js';

/**
 * Tactical tags for a mistake, derived from the position and the two moves (played vs. engine best).
 * They are heuristics, not proofs: the diagnosis only trusts a tag once it recurs (see diagnose.ts).
 */
export type TacticTag = 'hungPiece' | 'missedMate' | 'missedCapture' | 'missedFork';

export const TRAINING_VERSION = 1;

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const split = (uci: string) => ({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci[4] });

/** Squares of `by`'s pieces that attack `sq` in the current position of `chess`. */
function attackers(chess: Chess, sq: Square, by: CjsColor): PieceSymbol[] {
  return chess.attackers(sq, by).map((s) => chess.get(s)!.type);
}

/** True when the side to move in `chess` can win material by capturing a piece on `sq` (hanging, or trading up). */
function canWinPiece(chess: Chess, sq: Square, victimColor: CjsColor): boolean {
  const piece = chess.get(sq);
  if (!piece || piece.color !== victimColor || piece.type === 'k') return false;
  const hitters = attackers(chess, sq, victimColor === 'w' ? 'b' : 'w');
  if (!hitters.length) return false;
  const defended = attackers(chess, sq, victimColor).length > 0;
  const cheapest = Math.min(...hitters.map((t) => VALUE[t] || 99));
  return VALUE[piece.type] >= 3 && (!defended || cheapest + 2 <= VALUE[piece.type]);
}

/** Does `uci` leave one of the mover's pieces en prise, which it did not already have to lose? */
function leavesHanging(fenBefore: string, uci: string): boolean {
  const chess = new Chess(fenBefore);
  const mover = chess.turn();
  try {
    chess.move(split(uci));
  } catch {
    return false;
  }
  if (chess.isCheckmate()) return false;
  for (const row of chess.board())
    for (const p of row) if (p && p.color === mover && canWinPiece(chess, p.square, mover)) return true;
  return false;
}

/** Does the best move fork: the moved piece attacks two or more enemy pieces it can win (or the king + one)? */
function isFork(fenBefore: string, bestUci: string): boolean {
  const chess = new Chess(fenBefore);
  const mover = chess.turn();
  const enemy: CjsColor = mover === 'w' ? 'b' : 'w';
  let m;
  try {
    m = chess.move(split(bestUci));
  } catch {
    return false;
  }
  if (m.captured && VALUE[m.captured] >= 3) return false; // a plain capture, not a fork
  let targets = 0;
  for (const row of chess.board())
    for (const p of row) {
      if (!p || p.color !== enemy) continue;
      if (!chess.attackers(p.square, mover).includes(m.to)) continue;
      const defended = chess.attackers(p.square, enemy).length > 0;
      if (p.type === 'k' || VALUE[p.type] > VALUE[m.piece] || !defended) targets++;
    }
  return targets >= 2 && !leavesHanging(fenBefore, bestUci);
}

export interface MistakeInput {
  fenBefore: string;
  playedUci: string;
  bestUci?: string;
  bestSan?: string;
}

/** The tactical reasons behind one mistake; empty when none of the heuristics apply. */
export function tacticTags({ fenBefore, playedUci, bestUci, bestSan }: MistakeInput): TacticTag[] {
  const tags: TacticTag[] = [];
  if (bestSan?.endsWith('#')) tags.push('missedMate');
  if (leavesHanging(fenBefore, playedUci)) tags.push('hungPiece');
  if (bestUci && bestUci !== playedUci) {
    const chess = new Chess(fenBefore);
    const target = chess.get(split(bestUci).to);
    const playedTarget = chess.get(split(playedUci).to);
    if (target && target.type !== 'k' && VALUE[target.type] >= 3 && !(playedTarget && VALUE[playedTarget.type] >= VALUE[target.type]))
      tags.push('missedCapture');
    if (isFork(fenBefore, bestUci)) tags.push('missedFork');
  }
  return tags;
}

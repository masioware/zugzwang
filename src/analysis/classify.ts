import { Chess } from 'chess.js';
import type { Classification, EngineLine, GameAnalysis, MoveAnalysis, Score } from '../types';
import type { Ply } from '../lib/chess';
import { uciToSan } from '../lib/chess';
import { winPercent, winPercentFor } from './winprob';
import { gameAccuracy, moveAccuracy } from './accuracy';
import { phaseOf } from './phases';

export const ANALYSIS_VERSION = 1;

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Eval of a position; game-over positions (no engine lines) are scored directly. */
export function positionScore(lines: EngineLine[] | undefined, fen: string): Score {
  if (lines?.length) return { cp: lines[0].cp, mate: lines[0].mate };
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return { mate: 0, cp: chess.turn() === 'w' ? -1 : 1 };
  return { cp: 0 };
}

/** Thresholds on the mover's win% loss. */
export function classifyByLoss(loss: number): Classification {
  if (loss < 2) return 'excellent';
  if (loss < 5) return 'good';
  if (loss < 10) return 'inaccuracy';
  if (loss < 20) return 'mistake';
  return 'blunder';
}

/**
 * Whether the move leaves material en prise: after it, the opponent can win at least
 * two points (a minor piece, or the exchange) more than the move itself captured.
 */
export function isSacrifice(ply: Ply): boolean {
  const chess = new Chess(ply.fenAfter);
  const gainedByMove = ply.captured ? PIECE_VALUE[ply.captured] : 0;
  for (const m of chess.moves({ verbose: true })) {
    if (!m.captured || PIECE_VALUE[m.captured] < 3) continue;
    chess.move(m);
    const canRecapture = chess.moves({ verbose: true }).some((r) => r.to === m.to);
    chess.undo();
    const net = PIECE_VALUE[m.captured] - (canRecapture ? PIECE_VALUE[m.piece] : 0);
    if (net - gainedByMove >= 2) return true;
  }
  return false;
}

interface Context {
  plies: Ply[];
  positions: EngineLine[][];
  bookPlies: number;
  clocks?: number[];
  initialTime?: number;
}

export function analyseMoves(ctx: Context): Pick<GameAnalysis, 'moves' | 'accuracy'> {
  const { plies, positions, bookPlies } = ctx;
  const fens = plies.map((p) => p.fenBefore);
  if (plies.length) fens.push(plies[plies.length - 1].fenAfter);
  const scores = fens.map((fen, i) => positionScore(positions[i], fen));
  const whiteWins = scores.map(winPercent);

  const moves: MoveAnalysis[] = [];
  plies.forEach((ply, i) => {
    const color = ply.color;
    const lines = positions[i] ?? [];
    const winBefore = winPercentFor(scores[i], color);
    const winAfter = winPercentFor(scores[i + 1], color);
    const loss = Math.max(0, winBefore - winAfter);
    const best = lines[0]?.pv[0];
    const isBest = best === ply.uci;
    const legalMoves = new Chess(ply.fenBefore).moves().length;

    let classification: Classification;
    if (i < bookPlies) classification = 'book';
    else {
      classification = isBest ? 'best' : classifyByLoss(loss);

      const prev = moves[i - 1];
      if (
        (classification === 'mistake' || classification === 'blunder') &&
        prev && (prev.classification === 'mistake' || prev.classification === 'blunder' || prev.classification === 'miss') &&
        winAfter >= 100 - prev.winBefore - 5
      ) {
        // The opponent erred and we gave the advantage back without getting worse than before.
        classification = 'miss';
      }

      if ((isBest || loss < 2) && winBefore < 95 && winAfter >= 45 && legalMoves > 1 && isSacrifice(ply)) {
        classification = 'brilliant';
      } else if (isBest && lines.length > 1 && legalMoves > 1 && winBefore < 90) {
        // "Only move" in a position that isn't already won; finishing off a won game is just best.
        const second = winPercentFor(lines[1], color);
        const bestWin = winPercentFor(lines[0], color);
        const isRecapture = !!ply.captured && plies[i - 1]?.to === ply.to && !!plies[i - 1]?.captured;
        if (bestWin - second >= 15 && second < 85 && !isRecapture) classification = 'great';
      }
    }

    const accuracy = classification === 'book' ? 100 : moveAccuracy(winBefore, winAfter);
    moves.push({
      ply: i,
      san: ply.san,
      uci: ply.uci,
      color,
      classification,
      winBefore,
      winAfter,
      accuracy,
      bestUci: best,
      bestSan: best ? uciToSan(ply.fenBefore, best) : undefined,
      scoreAfter: scores[i + 1],
      phase: phaseOf(ply.fenBefore, i, i < bookPlies),
      clockBefore: ctx.clocks ? (i >= 2 ? ctx.clocks[i - 2] : ctx.initialTime) : undefined,
    });
  });

  return { moves, accuracy: gameAccuracy(whiteWins, moves.map((m) => m.accuracy)) };
}

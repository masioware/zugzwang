import { db } from '../db';
import type { EngineLine, Game, GameAnalysis } from '../types';
import { replay } from '../lib/chess';
import { ANALYSIS_VERSION } from '../analysis/classify';
import { classifyInWorker } from './classifyClient';
import { Chess } from 'chess.js';
import { enginePool } from './pool';

export const DEFAULT_DEPTH = 16;

export interface AnalysisProgress {
  gameId: string;
  done: number;
  total: number;
}

/**
 * Runs the engine over every position of the game and stores the result. All positions
 * are submitted to the worker pool at once, so a single game uses every worker.
 */
export async function analyseGame(
  game: Game,
  depth: number,
  onProgress?: (p: AnalysisProgress) => void,
  signal?: AbortSignal,
): Promise<GameAnalysis | null> {
  const plies = replay(game.moves);
  const fens = plies.length ? [plies[0].fenBefore, ...plies.map((p) => p.fenAfter)] : [];
  let done = 0;
  onProgress?.({ gameId: game.id, done, total: fens.length });

  const abort = () => enginePool.cancel(game.id);
  signal?.addEventListener('abort', abort);
  const results = await Promise.all(
    fens.map(async (fen) => {
      const lines = new Chess(fen).isGameOver() ? [] : await enginePool.run(fen, { depth, multiPv: 2 }, game.id);
      onProgress?.({ gameId: game.id, done: ++done, total: fens.length });
      // Short PVs keep stored analyses small; the live engine shows full lines on demand.
      return lines && lines.map((l) => ({ ...l, pv: l.pv.slice(0, 10) }));
    }),
  );
  signal?.removeEventListener('abort', abort);
  if (signal?.aborted || results.some((r) => r === null)) return null;
  const positions = results as EngineLine[][];

  const result = await classifyInWorker({ moves: game.moves, positions, clocks: game.clocks, initialTime: game.initialTime });
  if (signal?.aborted) return null;
  const analysis: GameAnalysis = {
    gameId: game.id,
    depth,
    version: ANALYSIS_VERSION,
    ...result,
    createdAt: Date.now(),
  };
  // Lines first: whoever reacts to the new analysis may read them right away.
  await db.transaction('rw', db.analyses, db.analysisLines, async () => {
    await db.analysisLines.put({ gameId: game.id, positions });
    await db.analyses.put(analysis);
  });
  return analysis;
}

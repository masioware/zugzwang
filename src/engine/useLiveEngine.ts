import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';
import type { EngineLine } from '../types';
import { getLiveEngine } from './stockfish';

const LIVE_DEPTH = 22;

/** Continuously analyses `fen` with MultiPV 3, restarting whenever the position changes. */
export function useLiveEngine(fen: string, enabled: boolean): EngineLine[] {
  const [result, setResult] = useState<{ fen: string; lines: EngineLine[] }>({ fen, lines: [] });

  useEffect(() => {
    if (!enabled || new Chess(fen).isGameOver()) return;
    const search = getLiveEngine().analyse(fen, { depth: LIVE_DEPTH, multiPv: 3 }, (lines) =>
      setResult({ fen, lines }),
    );
    return search.cancel;
  }, [fen, enabled]);

  // Never return lines computed for a previous position.
  return result.fen === fen ? result.lines : [];
}

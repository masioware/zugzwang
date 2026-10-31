import { db } from './index';
import type { GameAnalysis } from '../types';

/** Every analysis read so far, by game id; the newest createdAt seen tells what is new on the next read. */
const cache = new Map<string, GameAnalysis>();
let newest = 0;

/**
 * All analyses. Only those added or redone since the last call are read from IndexedDB (by createdAt), and
 * deleted ones drop out by their key: reading every analysis on each change made a batch analysis freeze
 * the pages listing them, more so the more games were analysed.
 */
export async function readAnalyses(): Promise<Map<string, GameAnalysis>> {
  const [keys, fresh] = await Promise.all([
    db.analyses.toCollection().primaryKeys(),
    // Equal, not just above: two analyses can be saved in the same millisecond.
    db.analyses.where('createdAt').aboveOrEqual(newest).toArray(),
  ]);
  for (const a of fresh) {
    cache.set(a.gameId, a);
    if (a.createdAt > newest) newest = a.createdAt;
  }
  const live = new Set(keys);
  for (const id of cache.keys()) if (!live.has(id)) cache.delete(id);
  return new Map(cache);
}

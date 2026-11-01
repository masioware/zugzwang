import { db } from '../db';
import type { Game } from '../types';
import { FACTS_VERSION, type FactsInput, type GameFacts, type StoredFacts } from './facts';

const CHUNK = 50;
/** Facts already loaded or computed this session, by game id. */
const cache = new Map<string, GameFacts>();

let workers: Worker[] | null = null;
let nextId = 0;
const pending = new Map<number, (facts: StoredFacts[]) => void>();

function pool(): Worker[] {
  if (!workers) {
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    workers = Array.from({ length: n }, () => {
      const w = new Worker(new URL('./facts.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; facts: StoredFacts[] }>) => {
        pending.get(e.data.id)?.(e.data.facts);
        pending.delete(e.data.id);
      };
      return w;
    });
  }
  return workers;
}

function compute(worker: Worker, games: FactsInput[]): Promise<StoredFacts[]> {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker.postMessage({ id, games });
  });
}

/**
 * Facts for every game when all are already in memory, without waiting; undefined otherwise. Lets a filter
 * change render the new statistics at once instead of going through a "preparing" render first.
 */
export function cachedFacts(games: Game[]): Map<string, GameFacts> | undefined {
  const map = new Map<string, GameFacts>();
  for (const g of games) {
    const f = cache.get(g.id);
    if (!f) return undefined;
    map.set(g.id, f);
  }
  return map;
}

/**
 * Facts for every game. Facts never change once a game is imported, so they are stored in IndexedDB and
 * only games never seen before are replayed, in a pool of workers so the page stays responsive.
 * `onProgress` reports how many of the games are ready.
 */
export async function factsFor(games: Game[], onProgress?: (done: number, total: number) => void): Promise<Map<string, GameFacts>> {
  const unseen = games.filter((g) => !cache.has(g.id));
  if (unseen.length) {
    const stored = await db.facts.bulkGet(unseen.map((g) => g.id));
    stored.forEach((f) => f && f.v === FACTS_VERSION && cache.set(f.gameId, f));
  }
  const missing = unseen.filter((g) => !cache.has(g.id));
  let done = games.length - missing.length;
  onProgress?.(done, games.length);

  if (missing.length) {
    const chunks: FactsInput[][] = [];
    for (let i = 0; i < missing.length; i += CHUNK)
      chunks.push(missing.slice(i, i + CHUNK).map(({ id, moves, userColor }) => ({ id, moves, userColor })));
    // Each worker takes the next chunk as soon as it's free.
    await Promise.all(
      pool().map(async (w) => {
        for (let chunk = chunks.shift(); chunk; chunk = chunks.shift()) {
          const facts = await compute(w, chunk);
          facts.forEach((f) => cache.set(f.gameId, f));
          void db.facts.bulkPut(facts);
          done += facts.length;
          onProgress?.(done, games.length);
        }
      }),
    );
  }
  return new Map(games.map((g) => [g.id, cache.get(g.id)!]));
}

import type { Game } from '../types';
import type { Repertoire } from './repertoire';

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, (r: Repertoire) => void>();
/** By the set of games it was built from, so a second game with the same setup starts at once. */
const cache = new Map<string, Promise<Repertoire>>();
const MAX_CACHED = 4;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./repertoire.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; repertoire: Repertoire }>) => {
      pending.get(e.data.id)?.(e.data.repertoire);
      pending.delete(e.data.id);
    };
  }
  return worker;
}

/** Same games, same key: their count and the newest and oldest ids (games only ever get added or removed). */
function keyOf(games: Pick<Game, 'id'>[]): string {
  return `${games.length}:${games[0]?.id}:${games[games.length - 1]?.id}`;
}

/**
 * The repertoire of these games, built in a worker (replaying hundreds of games takes the better part of a
 * second, which would freeze the page) and cached.
 */
export function getRepertoire(games: Pick<Game, 'id' | 'moves' | 'userColor'>[]): Promise<Repertoire> {
  const key = keyOf(games);
  let result = cache.get(key);
  if (!result) {
    const id = nextId++;
    result = new Promise<Repertoire>((resolve) => pending.set(id, resolve));
    getWorker().postMessage({ id, games: games.map(({ moves, userColor }) => ({ moves, userColor })) });
    cache.set(key, result);
    if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  }
  return result;
}

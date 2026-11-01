import type { EngineLine, GameAnalysis } from '../types';

export interface ClassifyInput {
  moves: string[];
  positions: EngineLine[][];
  clocks?: number[];
  initialTime?: number;
}

type Result = Pick<GameAnalysis, 'moves' | 'accuracy'>;

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (r: Result) => void; reject: (e: Error) => void }>();

/**
 * Move classification and accuracy for an analysed game, computed in a worker: on the main thread it took
 * ~100 ms per game, a freeze for every game finished during a batch.
 */
export function classifyInWorker(input: ClassifyInput): Promise<Result> {
  if (!worker) {
    worker = new Worker(new URL('./classify.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: Result; error?: string }>) => {
      const p = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (e.data.result) p?.resolve(e.data.result);
      else p?.reject(new Error(e.data.error ?? 'classification failed'));
    };
    // A dead worker must not leave games waiting forever (that would hold a queue slot and stall the batch).
    worker.onerror = (e) => {
      e.preventDefault();
      for (const p of pending.values()) p.reject(new Error(e.message || 'classification worker failed'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ id, input });
  });
}

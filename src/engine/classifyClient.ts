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
const pending = new Map<number, (r: Result) => void>();

/**
 * Move classification and accuracy for an analysed game, computed in a worker: on the main thread it took
 * ~100 ms per game, a freeze for every game finished during a batch.
 */
export function classifyInWorker(input: ClassifyInput): Promise<Result> {
  if (!worker) {
    worker = new Worker(new URL('./classify.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result: Result }>) => {
      pending.get(e.data.id)?.(e.data.result);
      pending.delete(e.data.id);
    };
  }
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker!.postMessage({ id, input });
  });
}

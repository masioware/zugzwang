import type { EngineLine } from '../types';
import { Engine, type SearchOptions } from './stockfish';

/** Each pooled engine is a separate single-threaded WASM worker with its own hash table. */
const POOL_HASH_MB = 16;

/** Sensible default: leave one core for the page and the live engine, cap memory use. */
export function defaultWorkers(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(cores - 1, 8));
}

export function maxWorkers(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(cores, 16));
}

/**
 * After the user clicks, types or scrolls, no new position starts for this long. A batch keeps every core
 * busy; searches in flight are short, so pausing new ones frees the CPU for the page right when the user
 * interacts, and the batch resumes at full speed once they stop.
 */
const YIELD_AFTER_INPUT_MS = 600;
let lastInput = 0;
if (typeof window !== 'undefined')
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const)
    window.addEventListener(type, () => (lastInput = performance.now()), { capture: true, passive: true });

interface Task {
  fen: string;
  opts: SearchOptions;
  /** Groups tasks so all positions of one game can be cancelled together. */
  tag: string;
  resolve: (lines: EngineLine[] | null) => void;
}

/**
 * A pool of independent single-threaded Stockfish workers fed from one FIFO queue.
 * Positions are independent searches, so spreading them over N workers scales almost
 * linearly — and, unlike multi-threaded Stockfish, needs no cross-origin isolation.
 */
class EnginePool {
  private size = defaultWorkers();
  private idle: Engine[] = [];
  private busy = new Map<Engine, { task: Task; cancel: () => void }>();
  private queue: Task[] = [];
  private created = 0;
  private resumeTimer: ReturnType<typeof setTimeout> | undefined;

  setSize(n: number) {
    this.size = Math.max(1, n);
    // Shrink lazily: surplus idle workers are terminated now, busy ones when they finish.
    while (this.created > this.size && this.idle.length) {
      this.idle.pop()!.terminate();
      this.created--;
    }
    this.pump();
  }

  getSize() {
    return this.size;
  }

  /** Analyses one position; resolves null if cancelled. */
  run(fen: string, opts: SearchOptions, tag: string): Promise<EngineLine[] | null> {
    return new Promise((resolve) => {
      this.queue.push({ fen, opts, tag, resolve });
      this.pump();
    });
  }

  /** Drops queued positions with this tag and stops the ones being searched. */
  cancel(tag: string) {
    this.queue = this.queue.filter((t) => {
      if (t.tag !== tag) return true;
      t.resolve(null);
      return false;
    });
    for (const { task, cancel } of this.busy.values()) if (task.tag === tag) cancel();
  }

  private pump() {
    const sinceInput = performance.now() - lastInput;
    if (this.queue.length && sinceInput < YIELD_AFTER_INPUT_MS) {
      this.resumeTimer ??= setTimeout(() => {
        this.resumeTimer = undefined;
        this.pump();
      }, YIELD_AFTER_INPUT_MS - sinceInput);
      return;
    }
    while (this.queue.length) {
      let engine = this.idle.pop();
      if (!engine && this.created < this.size) {
        // Quiet: a batch only needs each search's result, not the per-depth progress lines.
        engine = new Engine(POOL_HASH_MB, true);
        this.created++;
      }
      if (!engine) return;
      const task = this.queue.shift()!;
      const search = engine.analyse(task.fen, task.opts);
      let cancelled = false;
      this.busy.set(engine, {
        task,
        cancel: () => {
          cancelled = true;
          search.cancel();
        },
      });
      const worker = engine;
      void search.promise.then((lines) => {
        this.busy.delete(worker);
        task.resolve(cancelled ? null : lines);
        if (this.created > this.size) {
          worker.terminate();
          this.created--;
        } else this.idle.push(worker);
        this.pump();
      });
    }
  }
}

export const enginePool = new EnginePool();

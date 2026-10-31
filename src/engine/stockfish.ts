import type { EngineLine } from '../types';
import { sideToMove } from '../lib/chess';

const ENGINE_URL = '/stockfish/stockfish-19-lite-single.js';

export interface SearchOptions {
  depth: number;
  multiPv: number;
}

interface Job {
  fen: string;
  opts: SearchOptions;
  onUpdate?: (lines: EngineLine[]) => void;
  resolve: (lines: EngineLine[]) => void;
  lines: EngineLine[];
  cancelled: boolean;
}

/**
 * One Stockfish instance in a Web Worker. Searches are serialised: starting a new
 * search while one is running stops the current one (its promise resolves with
 * whatever lines it had) and the newest queued request wins.
 */
export class Engine {
  private worker: Worker;
  private ready: Promise<void>;
  private current: Job | null = null;
  private next: Job | null = null;
  private multiPv = 1;

  constructor(hashMb = 32) {
    this.worker = new Worker(ENGINE_URL);
    let markReady!: () => void;
    this.ready = new Promise((r) => (markReady = r));
    this.worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;
      if (line === 'readyok') markReady();
      else if (line.startsWith('info ')) this.onInfo(line);
      else if (line.startsWith('bestmove')) this.onBestMove();
    };
    this.send('uci');
    this.send(`setoption name Hash value ${hashMb}`);
    this.send('isready');
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  analyse(
    fen: string,
    opts: SearchOptions,
    onUpdate?: (lines: EngineLine[]) => void,
  ): { promise: Promise<EngineLine[]>; cancel: () => void } {
    let job!: Job;
    const promise = new Promise<EngineLine[]>((resolve) => {
      job = { fen, opts, onUpdate, resolve, lines: [], cancelled: false };
    });
    if (this.next) {
      this.next.cancelled = true;
      this.next.resolve([]);
    }
    this.next = job;
    if (this.current) this.send('stop');
    else void this.startNext();
    return {
      promise,
      cancel: () => {
        job.cancelled = true;
        if (this.next === job) {
          this.next = null;
          job.resolve([]);
        } else if (this.current === job) this.send('stop');
      },
    };
  }

  private async startNext() {
    const job = this.next;
    if (!job) return;
    this.next = null;
    this.current = job;
    await this.ready;
    if (job.opts.multiPv !== this.multiPv) {
      this.multiPv = job.opts.multiPv;
      this.send(`setoption name MultiPV value ${job.opts.multiPv}`);
    }
    this.send(`position fen ${job.fen}`);
    this.send(`go depth ${job.opts.depth}`);
    if (job.cancelled) this.send('stop');
  }

  private onInfo(line: string) {
    const job = this.current;
    if (!job || !line.includes(' pv ') || line.includes('lowerbound') || line.includes('upperbound')) return;
    const depth = Number(line.match(/ depth (\d+)/)?.[1]);
    const idx = Number(line.match(/ multipv (\d+)/)?.[1] ?? 1) - 1;
    const score = line.match(/ score (cp|mate) (-?\d+)/);
    const pv = line.split(' pv ')[1]?.trim().split(' ') ?? [];
    if (!score || !pv.length) return;
    // UCI scores are relative to the side to move; store them from White's point of view.
    const sign = sideToMove(job.fen) === 'white' ? 1 : -1;
    const value = Number(score[2]) * sign;
    const entry: EngineLine =
      score[1] === 'cp' ? { cp: value, pv, depth } : { mate: value, pv, depth };
    job.lines[idx] = entry;
    // Only report once every line has reached the same depth, to avoid flicker between depths.
    if (idx === job.lines.length - 1 && !job.cancelled) job.onUpdate?.([...job.lines]);
  }

  private onBestMove() {
    const job = this.current;
    this.current = null;
    if (job) job.resolve(job.lines.filter(Boolean));
    void this.startNext();
  }

  terminate() {
    this.worker.terminate();
  }
}

let liveEngine: Engine | null = null;

/** Engine for interactive analysis of the position on the board. */
export function getLiveEngine(): Engine {
  return (liveEngine ??= new Engine());
}

const ENGINE_URL = '/stockfish/stockfish-19-lite-single.js';

/** Stockfish's own UCI_Elo bounds (read from the engine); used until it answers. */
export const DEFAULT_ELO_RANGE = { min: 1320, max: 3190 };

/**
 * A Stockfish instance that plays moves at a chosen strength. Separate from the analysis engines: the
 * weakened move only shows up in `bestmove` (not in the principal variation the analysis reads), and a
 * game must not wait behind a batch analysis.
 */
export class BotEngine {
  private worker = new Worker(ENGINE_URL);
  private ready: Promise<void>;
  private pending: ((uci: string | undefined) => void) | null = null;
  private elo: number | null = null;
  /** Strength range the engine reports for UCI_Elo. */
  range = { ...DEFAULT_ELO_RANGE };

  constructor() {
    let markReady!: () => void;
    this.ready = new Promise((r) => (markReady = r));
    this.worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data;
      if (line === 'readyok') markReady();
      else if (line.startsWith('option name UCI_Elo')) {
        const min = Number(line.match(/ min (\d+)/)?.[1]);
        const max = Number(line.match(/ max (\d+)/)?.[1]);
        if (min && max) this.range = { min, max };
      } else if (line.startsWith('bestmove')) {
        const move = line.split(' ')[1];
        const resolve = this.pending;
        this.pending = null;
        resolve?.(move && move !== '(none)' ? move : undefined);
      }
    };
    this.send('uci');
    this.send('setoption name Hash value 16');
    this.send('isready');
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd);
  }

  /** The bot's move (UCI) in `fen`, thinking for about `movetime` ms; full strength at the top of the range. */
  async move(fen: string, elo: number, movetime: number): Promise<string | undefined> {
    await this.ready;
    if (this.pending) {
      // A newer request replaces the one in flight (e.g. a new game started mid-search).
      this.pending(undefined);
      this.pending = null;
      this.send('stop');
    }
    if (elo !== this.elo) {
      this.elo = elo;
      const limited = elo < this.range.max;
      this.send(`setoption name UCI_LimitStrength value ${limited}`);
      if (limited) this.send(`setoption name UCI_Elo value ${Math.max(this.range.min, Math.round(elo))}`);
    }
    return new Promise((resolve) => {
      this.pending = resolve;
      this.send(`position fen ${fen}`);
      this.send(`go movetime ${movetime}`);
    });
  }

  terminate() {
    this.pending?.(undefined);
    this.worker.terminate();
  }
}

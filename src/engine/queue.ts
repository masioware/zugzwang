import { create } from 'zustand';
import { db } from '../db';
import { ANALYSIS_VERSION } from '../analysis/classify';
import { useSettings } from '../lib/settings';
import { platformGameId } from '../api/importer';
import type { GameAnalysis } from '../types';
import { analyseGame, type AnalysisProgress } from './gameAnalysis';
import { enginePool } from './pool';

/**
 * Games analysed at the same time. Each game already spreads its positions over every
 * worker; a second game in flight keeps workers busy while the first one finishes.
 */
const GAMES_IN_FLIGHT = 2;

/** Least time between two progress updates of a game in flight. */
const PROGRESS_INTERVAL_MS = 250;

interface QueueState {
  queue: string[];
  /** Games being analysed right now, by id. */
  active: Record<string, AnalysisProgress>;
  completed: number;
  /** Positions analysed since the batch started and when it started (for speed / ETA). */
  positionsDone: number;
  startedAt: number | null;
  /** Average plies per finished game, used to estimate the remaining work. */
  avgPositions: number;
  /** Adds games to the queue; `front` puts them ahead of the batch (e.g. the game being viewed). */
  enqueue: (ids: string[], front?: boolean) => void;
  cancelAll: () => void;
}

const controllers = new Map<string, AbortController>();
let slots = 0;

export const useAnalysisQueue = create<QueueState>((set, get) => ({
  queue: [],
  active: {},
  completed: 0,
  positionsDone: 0,
  startedAt: null,
  avgPositions: 60,
  enqueue: (ids, front = false) => {
    const fresh = ids.filter((id) => !(id in get().active));
    const rest = get().queue.filter((id) => !fresh.includes(id));
    set({ queue: front ? [...fresh, ...rest] : [...rest, ...fresh], startedAt: get().startedAt ?? Date.now() });
    fill();
  },
  cancelAll: () => {
    set({ queue: [] });
    for (const c of controllers.values()) c.abort();
  },
}));

/** Starts games until all slots are taken or the queue is empty. */
function fill() {
  enginePool.setSize(useSettings.getState().workers);
  while (slots < GAMES_IN_FLIGHT && useAnalysisQueue.getState().queue.length) {
    const [id, ...rest] = useAnalysisQueue.getState().queue;
    useAnalysisQueue.setState({ queue: rest });
    slots++;
    void runOne(id).finally(() => {
      slots--;
      if (!slots && !useAnalysisQueue.getState().queue.length)
        useAnalysisQueue.setState({ completed: 0, positionsDone: 0, startedAt: null });
      else fill();
    });
  }
}

async function runOne(id: string) {
  const store = useAnalysisQueue;
  const depth = useSettings.getState().depth;
  // Mark the game active right away so the queue never looks idle while it loads.
  store.setState((s) => ({ active: { ...s.active, [id]: { gameId: id, done: 0, total: 0 } } }));
  const controller = new AbortController();
  controllers.set(id, controller);
  let last = 0;
  try {
    const [game, existing] = await Promise.all([db.games.get(id), db.analyses.get(id)]);
    const fresh = (a?: GameAnalysis) => !!a && a.version === ANALYSIS_VERSION && a.depth >= depth;
    if (!game || controller.signal.aborted || fresh(existing)) return;
    // The same game imported for another account (the user's and a friend's) needs no second engine run.
    const twin = (await db.analyses.where('gameId').startsWith(platformGameId(id)).toArray()).find(
      (a) => a.gameId !== id && platformGameId(a.gameId) === platformGameId(id) && fresh(a),
    );
    if (twin) {
      const lines = await db.analysisLines.get(twin.gameId);
      await db.transaction('rw', db.analyses, db.analysisLines, async () => {
        if (lines) await db.analysisLines.put({ ...lines, gameId: id });
        // A fresh createdAt so lists reading only new analyses pick the copy up.
        await db.analyses.put({ ...twin, gameId: id, createdAt: Date.now() });
      });
      return;
    }
    let lastEmit = 0;
    const result = await analyseGame(
      game,
      depth,
      (p) => {
        // Progress comes once per position; a few updates a second are plenty for the header, and each
        // one re-renders whatever shows the queue.
        const now = Date.now();
        if (p.done < p.total && now - lastEmit < PROGRESS_INTERVAL_MS) return;
        lastEmit = now;
        store.setState((s) => {
          const delta = p.done - last;
          last = p.done;
          return { active: { ...s.active, [id]: p }, positionsDone: s.positionsDone + delta };
        });
      },
      controller.signal,
    );
    if (result)
      store.setState((s) => ({
        completed: s.completed + 1,
        avgPositions: (s.avgPositions * s.completed + game.moves.length + 1) / (s.completed + 1),
      }));
  } finally {
    controllers.delete(id);
    store.setState((s) => {
      const { [id]: _done, ...active } = s.active;
      return { active };
    });
  }
}

/** Positions per second and estimated seconds left for the whole batch. */
export function queueEta(s: QueueState): { rate: number; seconds: number } | null {
  if (!s.startedAt || s.positionsDone < 20) return null;
  const rate = s.positionsDone / ((Date.now() - s.startedAt) / 1000);
  const activeLeft = Object.values(s.active).reduce((n, p) => n + (p.total - p.done), 0);
  const remaining = activeLeft + s.queue.length * s.avgPositions;
  return { rate, seconds: remaining / rate };
}

// Resize the pool as soon as the user changes the worker count, even mid-batch.
useSettings.subscribe((s, prev) => {
  if (s.workers !== prev.workers) enginePool.setSize(s.workers);
});

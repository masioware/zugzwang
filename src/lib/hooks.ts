import { useLiveQuery } from 'dexie-react-hooks';
import { liveQuery } from 'dexie';
import { readAnalyses } from '../db/analysesCache';
import { useAnalysisQueue } from '../engine/queue';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '../db';
import type { Game, GameAnalysis } from '../types';
import { DEFAULT_FILTERS, filterGames, type Filters } from '../stats/aggregate';
import type { GameFacts } from '../stats/facts';
import { factsFor } from '../stats/factsStore';
import { filtersFromParams, sameFilters, writeFilterParams } from './filterParams';

/**
 * Whose games the pages below show: a friend's name, or undefined for the user's own accounts.
 * Games, filters and statistics never mix across scopes.
 */
export const ScopeContext = createContext<string | undefined>(undefined);

export function useScope(): string | undefined {
  return useContext(ScopeContext);
}

/** Games of the current scope, newest first. `undefined` while loading. */
export function useGames(): Game[] | undefined {
  return useScopeGames(useScope());
}

/** Games of the given friend's accounts (or the user's own when undefined), newest first. */
export function useScopeGames(friend: string | undefined): Game[] | undefined {
  return useLiveQuery(async () => {
    const ids = (await db.accounts.toArray()).filter((a) => a.friend === friend).map((a) => a.id);
    const games = await db.games.where('accountId').anyOf(ids).toArray();
    return games.sort((a, b) => b.endTime - a.endTime);
  }, [friend]);
}

/** While games are being analysed, pages showing analyses update at most this often. */
const BUSY_INTERVAL_MS = 5000;

/**
 * Like useLiveQuery, but while the analysis queue runs, new results reach the page at most every
 * BUSY_INTERVAL_MS (the latest one, never dropped). Each finished game would otherwise re-render whole
 * statistics pages, freezing them for as long as the batch lasts. Idle, results pass straight through.
 */
function useCalmLiveQuery<T>(querier: () => Promise<T>): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let last = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: { value: T } | null = null;
    const flush = () => {
      timer = undefined;
      if (!pending) return;
      setValue(pending.value);
      pending = null;
      last = Date.now();
    };
    const subscription = liveQuery(querier).subscribe({
      next: (v) => {
        pending = { value: v };
        const q = useAnalysisQueue.getState();
        const busy = q.queue.length > 0 || Object.keys(q.active).length > 0;
        const wait = busy ? last + BUSY_INTERVAL_MS - Date.now() : 0;
        if (wait <= 0) flush();
        else timer ??= setTimeout(flush, wait);
      },
      error: (e) => console.error(e),
    });
    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
    // The queriers below are module-level functions: subscribe once.
  }, []);
  return value;
}

const readAnalysedIds = async () => new Set(await db.analyses.toCollection().primaryKeys());

export function useAnalyses(): Map<string, GameAnalysis> | undefined {
  return useCalmLiveQuery(readAnalyses);
}

/** Ids of analysed games only — cheap enough to use in lists. */
export function useAnalysedIds(): Set<string> | undefined {
  return useCalmLiveQuery(readAnalysedIds);
}

interface FilterState {
  /** Keyed by scope ('' for the user's own games). */
  byScope: Record<string, Filters>;
  setFilters: (scope: string, filters: Filters) => void;
}

/** Last filters used per scope, so a page opened without filters in its URL starts from them. */
const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      byScope: {},
      setFilters: (scope, filters) => set((s) => ({ byScope: { ...s.byScope, [scope]: filters } })),
    }),
    {
      name: 'zugzwang-filters',
      partialize: (s) => ({ byScope: s.byScope }),
      // Fill in filters added after the state was saved.
      merge: (saved, current) => {
        const byScope = (saved as Partial<FilterState> | undefined)?.byScope ?? {};
        return {
          ...current,
          byScope: Object.fromEntries(Object.entries(byScope).map(([k, f]) => [k, { ...DEFAULT_FILTERS, ...f }])),
        };
      },
    },
  ),
);

/**
 * Filters of the games list and stats page of the current scope. They live in the URL query string (so views
 * can be bookmarked, shared and linked to) and in a persisted store that remembers the last ones used.
 *
 * Pages render from the store, which updates synchronously: the router applies URL changes in a transition,
 * so rendering from the URL would let a typed search lag behind the input. The URL is copied into the store
 * whenever its filters change (a link, a pasted URL, Back), and a URL without filters gets the stored ones.
 */
export function useFilters() {
  const scope = useScope() ?? '';
  const [params, setParams] = useSearchParams();
  const filters = useFilterStore((s) => s.byScope[scope] ?? DEFAULT_FILTERS);
  const save = useFilterStore((s) => s.setFilters);
  const fromUrl = filtersFromParams(params);
  // Changes only when the filters in the URL do, not with other params such as the page.
  const urlKey = fromUrl ? writeFilterParams(new URLSearchParams(), fromUrl).toString() : null;

  useEffect(() => {
    const stored = useFilterStore.getState().byScope[scope] ?? DEFAULT_FILTERS;
    const url = urlKey === null ? null : filtersFromParams(new URLSearchParams(urlKey));
    if (url) {
      if (!sameFilters(url, stored)) save(scope, url);
    } else if (!sameFilters(stored, DEFAULT_FILTERS)) {
      setParams((p) => writeFilterParams(new URLSearchParams(p), stored), { replace: true });
    }
  }, [urlKey, scope, save, setParams]);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    const next = { ...filters, [key]: value };
    save(scope, next);
    setParams(
      (p) => {
        const out = writeFilterParams(new URLSearchParams(p), next);
        // Other filters, other pages: start the list over.
        out.delete('page');
        return out;
      },
      { replace: true },
    );
  };
  /** Back to the defaults (an empty query string). */
  const reset = () => {
    save(scope, DEFAULT_FILTERS);
    setParams(
      (p) => {
        const out = writeFilterParams(new URLSearchParams(p), DEFAULT_FILTERS);
        out.delete('page');
        return out;
      },
      { replace: true },
    );
  };
  return { filters, setFilter, reset };
}

export function useFilteredGames(): Game[] | undefined {
  const games = useGames();
  const { filters } = useFilters();
  return useMemo(() => (games ? filterGames(games, filters) : undefined), [games, filters]);
}

export interface FactsState {
  /** Undefined until every game's facts are ready. */
  facts: Map<string, GameFacts> | undefined;
  /** Games ready so far, of `total`; only meaningful while `facts` is undefined. */
  done: number;
  total: number;
}

/** Replay-derived facts for the given games (see stats/factsStore). */
export function useGameFacts(games: Game[] | undefined): FactsState {
  const [state, setState] = useState<{ games: Game[]; map?: Map<string, GameFacts>; done: number; total: number }>();
  useEffect(() => {
    if (!games) return;
    let cancelled = false;
    void factsFor(games, (done, total) => !cancelled && setState({ games, done, total })).then(
      (map) => !cancelled && setState({ games, map, done: games.length, total: games.length }),
    );
    return () => {
      cancelled = true;
    };
  }, [games]);
  const current = state && state.games === games ? state : undefined;
  return { facts: current?.map, done: current?.done ?? 0, total: current?.total ?? games?.length ?? 0 };
}

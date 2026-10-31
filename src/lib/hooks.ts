import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { db } from '../db';
import type { Game, GameAnalysis } from '../types';
import { DEFAULT_FILTERS, filterGames, type Filters } from '../stats/aggregate';
import { factsFor, type GameFacts } from '../stats/facts';
import { loadOpeningBook } from '../analysis/openings';

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

export function useAnalyses(): Map<string, GameAnalysis> | undefined {
  const list = useLiveQuery(() => db.analyses.toArray(), []);
  return useMemo(() => (list ? new Map(list.map((a) => [a.gameId, a])) : undefined), [list]);
}

/** Ids of analysed games only — cheap enough to use in lists. */
export function useAnalysedIds(): Set<string> | undefined {
  const keys = useLiveQuery(() => db.analyses.toCollection().primaryKeys(), []);
  return useMemo(() => (keys ? new Set(keys) : undefined), [keys]);
}

interface FilterState {
  /** Keyed by scope ('' for the user's own games). */
  byScope: Record<string, Filters>;
  setFilter: <K extends keyof Filters>(scope: string, key: K, value: Filters[K]) => void;
}

const useFilterStore = create<FilterState>((set) => ({
  byScope: {},
  setFilter: (scope, key, value) =>
    set((s) => ({ byScope: { ...s.byScope, [scope]: { ...(s.byScope[scope] ?? DEFAULT_FILTERS), [key]: value } } })),
}));

/** Filters are shared between the games list and the stats page of the same scope. */
export function useFilters() {
  const scope = useScope() ?? '';
  const filters = useFilterStore((s) => s.byScope[scope] ?? DEFAULT_FILTERS);
  const set = useFilterStore((s) => s.setFilter);
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => set(scope, key, value);
  return { filters, setFilter };
}

export function useFilteredGames(): Game[] | undefined {
  const games = useGames();
  const { filters } = useFilters();
  return useMemo(() => (games ? filterGames(games, filters) : undefined), [games, filters]);
}

/** Replay-derived facts for the given games (see stats/facts). */
export function useGameFacts(games: Game[] | undefined): Map<string, GameFacts> | undefined {
  const [facts, setFacts] = useState<{ games: Game[]; map: Map<string, GameFacts> }>();
  useEffect(() => {
    if (!games) return;
    let cancelled = false;
    void loadOpeningBook()
      .then((book) => factsFor(games, book))
      .then((map) => !cancelled && setFacts({ games, map }));
    return () => {
      cancelled = true;
    };
  }, [games]);
  return facts && facts.games === games ? facts.map : undefined;
}

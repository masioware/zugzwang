import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { db } from '../db';
import type { Game, GameAnalysis } from '../types';
import { DEFAULT_FILTERS, filterGames, type Filters } from '../stats/aggregate';
import { factsFor, type GameFacts } from '../stats/facts';
import { loadOpeningBook } from '../analysis/openings';

/** All games, newest first. `undefined` while loading. */
export function useGames(): Game[] | undefined {
  return useLiveQuery(() => db.games.orderBy('endTime').reverse().toArray(), []);
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
  filters: Filters;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
}

/** Filters are shared between the games list and the stats page. */
export const useFilters = create<FilterState>((set) => ({
  filters: DEFAULT_FILTERS,
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
}));

export function useFilteredGames(): Game[] | undefined {
  const games = useGames();
  const filters = useFilters((s) => s.filters);
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

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAnalyses, useGames } from '../lib/hooks';
import type { Game, GameAnalysis } from '../types';
import { isTrainable } from './diagnose';
import { measure, type Measure } from './measure';
import { settle, type Progress } from './path';

/** Analysed games played after `since`, newest first, at most `latest` of them. */
export function gamesSince(games: Game[], analyses: Map<string, GameAnalysis>, since: number, latest?: number): Game[] {
  const after = games.filter((g) => g.endTime > since && analyses.has(g.id)).sort((a, b) => b.endTime - a.endTime);
  return latest ? after.slice(0, latest) : after;
}

/**
 * Checks the weaknesses being worked on against the games played since: a verified one becomes mastered,
 * one that did not shrink (or came back) goes back to drills. Returns the records and what the new games
 * show for each, for the UI.
 */
export function useVerification(): { progress: Progress[] | undefined; measures: Map<string, Measure> } {
  const games = useGames();
  const analyses = useAnalyses();
  const progress = useLiveQuery(() => db.trainProgress.toArray(), []);
  const [measures, setMeasures] = useState<Map<string, Measure>>(new Map());

  useEffect(() => {
    if (!games || !analyses || !progress) return;
    const own = games.filter(isTrainable);
    const id = setTimeout(() => {
      const out = new Map<string, Measure>();
      const measureFor = (wid: string, since: number, latest?: number) => {
        const m = measure(wid, gamesSince(own, analyses, since, latest), analyses);
        out.set(wid, m);
        return m;
      };
      const changed = settle(progress, measureFor, Date.now());
      setMeasures(out);
      if (changed.length) void db.trainProgress.bulkPut(changed);
    }, 0);
    return () => clearTimeout(id);
  }, [games, analyses, progress]);

  return { progress, measures };
}

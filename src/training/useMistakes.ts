import { useMemo } from 'react';
import { useAnalyses, useGames } from '../lib/hooks';
import { collectMistakes, type OwnMistake } from './mistakes';

/** The user's serious mistakes as puzzle candidates, worst first; undefined while loading. */
export function useOwnMistakes(minLoss: number): OwnMistake[] | undefined {
  const games = useGames();
  const analyses = useAnalyses();
  return useMemo(() => (games && analyses ? collectMistakes(games, analyses, minLoss) : undefined), [games, analyses, minLoss]);
}

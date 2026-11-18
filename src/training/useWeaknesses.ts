import { useEffect, useState } from 'react';
import { useAnalyses, useGames } from '../lib/hooks';
import { me } from '../stats/aggregate';
import { diagnose, type Weakness } from './diagnose';

/** The user's recurring mistakes; undefined while loading or computing. */
export function useWeaknesses(): Weakness[] | undefined {
  const games = useGames();
  const analyses = useAnalyses();
  const [weaknesses, setWeaknesses] = useState<Weakness[]>();
  useEffect(() => {
    if (!games || !analyses) return;
    // Replaying every mistake is CPU work: let the page paint first.
    const id = setTimeout(() => setWeaknesses(diagnose(games.filter((g) => me(g)), analyses)), 0);
    return () => clearTimeout(id);
  }, [games, analyses]);
  return weaknesses;
}

export function weaknessLabel(t: (k: string, o?: Record<string, unknown>) => string, w: Pick<Weakness, 'kind' | 'key'>): string {
  return w.kind === 'opening' ? t('train.openingLabel', { name: w.key }) : t(`train.${w.kind}.${w.key}`);
}

/** Label from a bare weakness id (`kind:key`), for places that have no Weakness at hand. */
export function weaknessLabelOfId(t: (k: string, o?: Record<string, unknown>) => string, id: string): string {
  const cut = id.indexOf(':');
  return weaknessLabel(t, { kind: id.slice(0, cut) as Weakness['kind'], key: id.slice(cut + 1) });
}

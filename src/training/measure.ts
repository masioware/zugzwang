import type { Game, GameAnalysis } from '../types';
import { replay } from '../lib/chess';
import { openingFamily } from '../analysis/openings';
import { isLowClock, isMistake, isTrainable } from './diagnose';
import { tacticTags, type TacticTag } from './tags';

export interface Measure {
  /** Analysed games the numbers come from. */
  games: number;
  count: number;
  opportunities: number;
  /** Mistakes per 100 opportunities, as in Weakness.rate. */
  rate: number;
}

/**
 * How often one weakness (by id) happens in the given games, counted the way diagnose() counts it so a
 * later measurement is comparable with the rate the weakness was first found at.
 */
export function measure(id: string, games: Game[], analyses: Map<string, GameAnalysis>): Measure {
  const cut = id.indexOf(':');
  const kind = id.slice(0, cut);
  const key = id.slice(cut + 1);
  let analysed = 0;
  let count = 0;
  let opportunities = 0;

  for (const game of games) {
    const analysis = analyses.get(game.id);
    if (!analysis || !isTrainable(game)) continue;
    analysed++;
    const family = openingFamily(game.opening.name);
    let plies: ReturnType<typeof replay> | undefined;
    for (const m of analysis.moves) {
      if (m.color !== game.userColor) continue;
      const inContext =
        kind === 'phase' ? m.phase === key : kind === 'time' ? isLowClock(m, game.initialTime) : kind === 'opening' ? family === key : true;
      if (!inContext) continue;
      opportunities++;
      if (!isMistake(m)) continue;
      if (kind === 'tactic') {
        plies ??= replay(game.moves);
        const ply = plies[m.ply];
        if (!ply) continue;
        const tags = tacticTags({ fenBefore: ply.fenBefore, playedUci: m.uci, bestUci: m.bestUci, bestSan: m.bestSan });
        if (!tags.includes(key as TacticTag)) continue;
      }
      count++;
    }
  }
  return { games: analysed, count, opportunities, rate: opportunities ? (count / opportunities) * 100 : 0 };
}

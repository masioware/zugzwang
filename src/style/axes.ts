import type { FeatureKey, FeatureValues } from './features';
import { zscore, type StyleData } from './match';

/**
 * The 24 features folded into six axes people can read at a glance. Each axis is the average z-score of
 * its features, signed: a feature with weight -1 pulls the axis down when it is high.
 */
export const AXES = [
  { id: 'aggression', features: { checks: 1, pawnAdvance: 1, oppositeCastling: 1, castleQueen: 1, earlyQueenMove: 1 } },
  { id: 'risk', features: { sacrifices: 1, draws: -1, queensOff: -1 } },
  { id: 'simplification', features: { queensOff: 1, captures: 1, draws: 1 } },
  { id: 'activity', features: { knightMoves: 1, bishopMoves: 1, rookMoves: 1, queenMoves: 1, pawnMoves: -1 } },
  {
    id: 'openness',
    features: { whiteE4: 1, blackVsE4E5: 1, blackVsE4C5: 1, whiteD4: -1, whiteFlank: -1, blackVsD4D5: -1, blackVsD4Nf6: -1 },
  },
  { id: 'endurance', features: { length: 1, kingMoves: 1 } },
] as const satisfies readonly { id: string; features: Partial<Record<FeatureKey, 1 | -1>> }[];

export type AxisId = (typeof AXES)[number]['id'];

/** Z-score of one standard deviation is this many points on the 0-100 axis (50 = the legends' average). */
const POINTS_PER_Z = 20;

/** 0-100 score per axis (50 is the legends' average); axes with no data for the player are left out. */
export function axisScores(values: Partial<FeatureValues>, scale: StyleData['scale']): Partial<Record<AxisId, number>> {
  const out: Partial<Record<AxisId, number>> = {};
  for (const { id, features } of AXES) {
    const parts = (Object.entries(features) as [FeatureKey, 1 | -1][]).flatMap(([k, sign]) =>
      values[k] === undefined || Number.isNaN(values[k]) ? [] : [sign * zscore(k, values[k], scale)],
    );
    if (!parts.length) continue;
    const mean = parts.reduce((a, b) => a + b, 0) / parts.length;
    out[id] = Math.round(Math.max(0, Math.min(100, 50 + POINTS_PER_Z * mean)));
  }
  return out;
}

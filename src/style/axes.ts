import type { FeatureKey, FeatureValues } from './features';
import { featureWeight, zscore, type StyleData } from './match';

type Signs = Partial<Record<FeatureKey, 1 | -1>>;

/**
 * The style features folded into five axes people can read at a glance. Each axis is the weighted average z-score
 * of its features, signed: a feature with weight -1 pulls the axis down when it is high.
 */
export const AXES = [
  { id: 'aggression', features: { pawnAdvance: 1, pawnSpace30: 1, oppositeCastling: 1, castleQueen: 1 } },
  { id: 'closedPlay', features: { pawns30: 1, centerPawns30: 1, openFiles30: -1 } },
  { id: 'pieceplay', features: { knightMoves: 1, bishopMoves: 1, queenMoves: 1, pawnMoves: -1, bishopsOverKnights30: 1, bishopPairEdge30: 1 } },
  {
    id: 'openness',
    features: { whiteE4: 1, blackVsE4E5: 1, blackVsE4C5: 1, whiteD4: -1, whiteFlank: -1, blackVsD4D5: -1, blackVsD4Nf6: -1 },
  },
  { id: 'kingSafety', features: { castleKing: 1, castleQueen: -1, oppositeCastling: -1 } },
] as const satisfies readonly { id: string; features: Signs }[];

export type AxisId = (typeof AXES)[number]['id'];

/** One standard deviation is this many points on the 0-100 axis (50 = the legends' average). */
const POINTS_PER_Z = 20;

/** 0-100 score per axis (50 is the legends' average); axes with no data for the player are left out. */
export function axisScores(values: Partial<FeatureValues>, scale: StyleData['scale']): Partial<Record<AxisId, number>> {
  const out: Partial<Record<AxisId, number>> = {};
  for (const { id, features } of AXES) {
    let sum = 0;
    let total = 0;
    for (const [k, sign] of Object.entries(features) as [FeatureKey, 1 | -1][]) {
      const v = values[k];
      if (v === undefined || Number.isNaN(v) || !(k in scale)) continue;
      const w = featureWeight(k, scale);
      sum += w * sign * zscore(k, v, scale);
      total += w;
    }
    if (!total) continue;
    out[id] = Math.round(Math.max(0, Math.min(100, 50 + (POINTS_PER_Z * sum) / total)));
  }
  return out;
}

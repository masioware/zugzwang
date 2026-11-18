import { FEATURES, type FeatureKey, type Profile } from './features';

/** Shape of public/data/styles.json, written by scripts/build-styles.mjs. */
export interface StyleData {
  /** Mean and spread of each feature across the legends; features are compared in these units. */
  scale: Record<FeatureKey, { mean: number; std: number }>;
  legends: Legend[];
}

export interface Legend {
  id: string;
  name: string;
  games: number;
  values: Record<FeatureKey, number>;
}

export interface Match {
  legend: Legend;
  /** 0-100. */
  similarity: number;
  /** Features where user and legend agree most, then differ most (z-score units). */
  closest: FeatureKey[];
  furthest: FeatureKey[];
}

/** Standard deviations from the legends' average; capped so one odd feature cannot dominate. */
const Z_CAP = 3;
/** Fewest features a profile must share with a legend for the comparison to mean anything. */
const MIN_SHARED = 8;
/** Games needed before the result is more than a hint. */
export const MIN_GAMES = 30;

export function zscore(key: FeatureKey, value: number, scale: StyleData['scale']): number {
  const { mean, std } = scale[key];
  if (!std) return 0;
  return Math.max(-Z_CAP, Math.min(Z_CAP, (value - mean) / std));
}

/** Legends ranked from the closest to the furthest style. */
export function matchStyle(profile: Profile, data: StyleData): Match[] {
  const mine = FEATURES.flatMap((k) => (profile.values[k] === undefined ? [] : [{ k, z: zscore(k, profile.values[k], data.scale) }]));
  if (mine.length < MIN_SHARED) return [];

  return data.legends
    .map((legend) => {
      const diffs = mine
        .map(({ k, z }) => ({ k, d: Math.abs(z - zscore(k, legend.values[k], data.scale)) }))
        .sort((a, b) => a.d - b.d);
      const rms = Math.sqrt(diffs.reduce((s, x) => s + x.d * x.d, 0) / diffs.length);
      return {
        legend,
        similarity: Math.round(100 * Math.exp(-(rms * rms) / 2)),
        closest: diffs.slice(0, 3).map((x) => x.k),
        furthest: diffs.slice(-3).reverse().map((x) => x.k),
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

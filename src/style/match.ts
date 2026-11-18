import { FEATURES, FEATURE_GROUP, LEVEL_SENSITIVE, OPENING_WEIGHT, type FeatureGroup, type FeatureKey, type Profile } from './features';

/** Shape of public/data/styles.json, written by scripts/build-styles.mjs. */
export interface StyleData {
  /**
   * Mean and spread of each feature across the legends (features are compared in these units), and its
   * weight: how reliably the feature tells players apart (0-1, see build-styles.mjs).
   */
  scale: Record<FeatureKey, { mean: number; std: number; weight?: number }>;
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
  /** Same measure using only the features of each group the player has data for. */
  byGroup: Partial<Record<FeatureGroup, number>>;
  /** Reliable features where user and legend agree most, then where they differ most. */
  closest: FeatureKey[];
  furthest: FeatureKey[];
}

/** Standard deviations from the legends' average; capped so one odd feature cannot dominate. */
const Z_CAP = 3;
/** Fewest features a profile must share with a legend for the comparison to mean anything. */
const MIN_SHARED = 8;
/** Games needed before the result is more than a hint. */
export const MIN_GAMES = 30;
/** A feature must be at least this reliable to be named as a reason for (dis)similarity. */
const MIN_NAMED_WEIGHT = 0.4;

/** Whether the data has this feature; a file built before a feature existed does not. */
export function hasFeature(key: FeatureKey, data: Pick<StyleData, 'scale' | 'legends'>): boolean {
  return key in data.scale && data.legends.every((l) => typeof l.values[key] === 'number');
}

export function zscore(key: FeatureKey, value: number, scale: StyleData['scale']): number {
  const { mean, std } = scale[key];
  if (!std) return 0;
  return Math.max(-Z_CAP, Math.min(Z_CAP, (value - mean) / std));
}

/** How much a feature counts: its reliability, with the openings held back and level-driven ones left out. */
export function featureWeight(key: FeatureKey, scale: StyleData['scale']): number {
  if (LEVEL_SENSITIVE.has(key)) return 0;
  return (scale[key].weight ?? 1) * (FEATURE_GROUP[key] === 'openings' ? OPENING_WEIGHT : 1);
}

const similarity = (rms: number) => Math.round(100 * Math.exp(-(rms * rms) / 2));

/** Legends ranked from the closest to the furthest style. */
export function matchStyle(profile: Profile, data: StyleData): Match[] {
  const mine = FEATURES.flatMap((k) =>
    profile.values[k] === undefined || !hasFeature(k, data) ? [] : [{ k, z: zscore(k, profile.values[k], data.scale), w: featureWeight(k, data.scale) }],
  );
  if (mine.filter((x) => x.w > 0).length < MIN_SHARED) return [];

  const rms = (items: { d: number; w: number }[]) => {
    const total = items.reduce((s, x) => s + x.w, 0);
    return total ? Math.sqrt(items.reduce((s, x) => s + x.w * x.d * x.d, 0) / total) : NaN;
  };

  return data.legends
    .map((legend) => {
      const diffs = mine.map(({ k, z, w }) => ({ k, w, d: Math.abs(z - zscore(k, legend.values[k], data.scale)) }));
      const byGroup: Match['byGroup'] = {};
      for (const g of new Set(diffs.map((x) => FEATURE_GROUP[x.k]))) {
        const r = rms(diffs.filter((x) => FEATURE_GROUP[x.k] === g));
        if (!Number.isNaN(r)) byGroup[g] = similarity(r);
      }
      const named = diffs.filter((x) => x.w > 0 && (data.scale[x.k].weight ?? 1) >= MIN_NAMED_WEIGHT);
      return {
        legend,
        similarity: similarity(rms(diffs)),
        byGroup,
        closest: [...named].sort((a, b) => a.d - b.d).slice(0, 3).map((x) => x.k),
        furthest: [...named].sort((a, b) => b.d - a.d).slice(0, 3).map((x) => x.k),
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
}

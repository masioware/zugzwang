import { FEATURE_GROUP, HABITS, type FeatureGroup, type FeatureKey, type Profile } from './features';
import { repertoireSimilarity, type Repertoire } from './repertoire';

/** Shape of public/data/styles.json, written by scripts/build-styles.mjs. */
export interface StyleData {
  /**
   * Habits are compared in units of how much legends differ from each other on them; `weight` (0-1) is how
   * reliably the habit tells players apart (see build-styles.mjs).
   */
  scale: Partial<Record<FeatureKey, { mean: number; std: number; weight?: number }>>;
  legends: Legend[];
}

export interface Legend {
  id: string;
  name: string;
  games: number;
  /** Average of each habit over the legend's games, as the legend minus the opponent in the same game. */
  values: Partial<Record<FeatureKey, number>>;
  repertoire: Repertoire;
}

/** What is known about the player: the repertoire and the habits (see features.pairedFeatures), from their games. */
export interface YourStyle {
  habits: Profile;
  repertoire: Repertoire;
}

export interface SharedOpening {
  color: 'white' | 'black';
  family: string;
  /** Share of the player's games as that colour. */
  you: number;
  legend: number;
}

export interface Match {
  legend: Legend;
  /** 0-100: the repertoire and the habits together (see REPERTOIRE_WEIGHT). */
  similarity: number;
  /** 0-100 overlap of the opening repertoires, overall and per colour. */
  repertoire: { overall: number; white?: number; black?: number };
  /** 0-100, undefined when there are too few habits to compare. */
  habits?: number;
  /** Opening families both play, the ones that add most to the overlap first. */
  shared: SharedOpening[];
  /** Habits where user and legend agree most, then where they differ most (reliable ones only). */
  closest: FeatureKey[];
  furthest: FeatureKey[];
}

/**
 * How much of the similarity comes from the repertoire. Held-out tests on 57 legends (60 unseen games each,
 * training on the early career and testing on the late one) put the right legend first 59% of the time with
 * the repertoire alone and 58% at this weight, against 9% with the habits alone, and worse with more habit.
 */
export const REPERTOIRE_WEIGHT = 0.85;
/** Standard deviations from the legends' average; capped so one odd habit cannot dominate. */
const Z_CAP = 3;
/** Fewest habits a profile must share with the legends for them to be compared. */
const MIN_HABITS = 6;
/** Games needed before the result is more than a hint. */
export const MIN_GAMES = 30;
/** A habit must be at least this reliable to be named as a reason for (dis)similarity. */
const MIN_NAMED_WEIGHT = 0.3;
const SHARED_SHOWN = 4;

function zscore(key: FeatureKey, value: number, scale: StyleData['scale']): number {
  const s = scale[key];
  if (!s?.std) return 0;
  return Math.max(-Z_CAP, Math.min(Z_CAP, (value - s.mean) / s.std));
}

/** Whether the data knows this habit (a file built before a habit existed does not). */
export function hasHabit(key: FeatureKey, data: Pick<StyleData, 'scale' | 'legends'>): boolean {
  return key in data.scale && data.legends.every((l) => typeof l.values[key] === 'number');
}

const pct = (x: number) => Math.round(100 * x);

function shared(you: Repertoire, legend: Repertoire): SharedOpening[] {
  const out: (SharedOpening & { share: number })[] = [];
  for (const color of ['white', 'black'] as const) {
    const a = you[color]?.family;
    const b = legend[color]?.family;
    if (!a || !b) continue;
    for (const [family, p] of Object.entries(a)) if (family in b) out.push({ color, family, you: p, legend: b[family], share: Math.sqrt(p * b[family]) });
  }
  return out.sort((x, y) => y.share - x.share).slice(0, SHARED_SHOWN);
}

/** Legends ranked from the closest to the furthest style. Empty when the player has no repertoire to compare. */
export function matchStyle(you: YourStyle, data: StyleData): Match[] {
  const usable = HABITS.filter((k) => you.habits.values[k] !== undefined && hasHabit(k, data));
  const mine = usable.map((k) => ({ k, z: zscore(k, you.habits.values[k]!, data.scale), w: data.scale[k]!.weight ?? 1 }));
  const total = mine.reduce((s, x) => s + x.w, 0);
  const compareHabits = mine.length >= MIN_HABITS && total > 0;

  return data.legends
    .flatMap((legend): Match[] => {
      const rep = repertoireSimilarity(you.repertoire, legend.repertoire);
      if (!rep) return [];
      const diffs = mine.map(({ k, z, w }) => ({ k, w, d: Math.abs(z - zscore(k, legend.values[k]!, data.scale)) }));
      const rms = compareHabits ? Math.sqrt(diffs.reduce((s, x) => s + x.w * x.d * x.d, 0) / total) : NaN;
      const habits = compareHabits ? Math.exp(-(rms * rms) / 2) : undefined;
      const named = diffs.filter((x) => x.w >= MIN_NAMED_WEIGHT);
      const overall = habits === undefined ? rep.overall : REPERTOIRE_WEIGHT * rep.overall + (1 - REPERTOIRE_WEIGHT) * habits;
      return [
        {
          legend,
          similarity: pct(overall),
          repertoire: { overall: pct(rep.overall), white: rep.white === undefined ? undefined : pct(rep.white), black: rep.black === undefined ? undefined : pct(rep.black) },
          habits: habits === undefined ? undefined : pct(habits),
          shared: shared(you.repertoire, legend.repertoire),
          closest: [...named].sort((a, b) => a.d - b.d).slice(0, 3).map((x) => x.k),
          furthest: [...named].sort((a, b) => b.d - a.d).slice(0, 3).map((x) => x.k),
        },
      ];
    })
    .sort((a, b) => b.similarity - a.similarity);
}

/** Habits of one kind, in display order. */
export const habitsOf = (group: FeatureGroup): FeatureKey[] => HABITS.filter((k) => FEATURE_GROUP[k] === group);

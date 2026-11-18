import { matchStyle, type Legend, type Match, type StyleData, type YourStyle } from './match';

/** Legends with a known style, to check the match groups similar players together. */
export interface StyleLabels {
  attacking: string[];
  positional: string[];
}

export interface FaceValidity {
  /** Legends tested. */
  n: number;
  /** Share whose single closest labelled legend has the same label (chance: about 0.5). */
  nearest: number;
  /** Average share of the three closest labelled legends that have the same label. */
  top3: number;
}

/** A legend seen as a player, so it can be matched against the others. */
export function asPlayer(legend: Legend): YourStyle {
  return { repertoire: legend.repertoire };
}

/**
 * Face validity of a similarity: for each labelled legend, are its nearest labelled neighbours of the same
 * style (attacking or positional)? Null when the similarity has no value to rank by (the data lacks that part).
 * Identification of a player from their games rewards what is personal,
 * like the opening repertoire; this asks whether the similarity also reflects how a player plays.
 */
export function faceValidity(data: StyleData, labels: StyleLabels, score: (m: Match) => number | undefined): FaceValidity | null {
  const label = (id: string) => (labels.attacking.includes(id) ? 'attacking' : labels.positional.includes(id) ? 'positional' : null);
  const labelled = data.legends.filter((l) => label(l.id));
  let nearest = 0;
  let top3 = 0;
  let scored = 0;
  for (const legend of labelled) {
    const others = { ...data, legends: labelled.filter((l) => l.id !== legend.id) };
    const ranked = matchStyle(asPlayer(legend), others)
      .map((m) => ({ id: m.legend.id, s: score(m) ?? -1 }))
      .sort((a, b) => b.s - a.s);
    if (!ranked.length || ranked.every((r) => r.s < 0)) continue;
    scored++;
    if (label(ranked[0].id) === label(legend.id)) nearest++;
    top3 += ranked.slice(0, 3).filter((r) => label(r.id) === label(legend.id)).length / Math.min(3, ranked.length);
  }
  return scored ? { n: scored, nearest: nearest / scored, top3: top3 / scored } : null;
}

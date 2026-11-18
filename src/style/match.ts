import { distinctiveShared, repertoireSimilarity, type Repertoire, type RepertoireMean } from './repertoire';

/** Shape of public/data/styles.json, written by scripts/build-styles.mjs. */
export interface StyleData {
  /** The average repertoire of the legends; with it the openings everybody plays count for little. */
  repertoireMean?: RepertoireMean;
  legends: Legend[];
}

export interface Legend {
  id: string;
  name: string;
  games: number;
  repertoire: Repertoire;
}

/** What is known about the player: their opening repertoire, from their games. */
export interface YourStyle {
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
  /** 0-100: how alike the repertoires are, averaged over the colours both have. */
  similarity: number;
  /** The same per colour. */
  white?: number;
  black?: number;
  /** Opening families both play that the average legend does not, the most distinctive first. */
  shared: SharedOpening[];
}

/** Games needed before the result is more than a hint. */
export const MIN_GAMES = 30;
const SHARED_SHOWN = 4;

const pct = (x: number) => Math.round(100 * x);

function shared(you: Repertoire, legend: Repertoire, mean?: RepertoireMean): SharedOpening[] {
  const out: (SharedOpening & { share: number })[] = [];
  for (const color of ['white', 'black'] as const) {
    const a = you[color];
    const b = legend[color];
    if (!a || !b) continue;
    const m = mean?.[color]?.family;
    if (m) {
      // Distinctive lines first: the ones both favour that the average legend does not play as much.
      for (const x of distinctiveShared(a, b, m)) out.push({ color, family: x.family, you: x.you, legend: x.legend, share: x.score });
    } else {
      for (const [family, p] of Object.entries(a.family)) if (family in b.family) out.push({ color, family, you: p, legend: b.family[family], share: Math.sqrt(p * b.family[family]) });
    }
  }
  return out.sort((x, y) => y.share - x.share).slice(0, SHARED_SHOWN);
}

/**
 * Legends ranked from the closest to the furthest repertoire. Empty when the player has no repertoire to
 * compare.
 *
 * Only the repertoire is compared. Move habits (captures, checks, castling), the shape of the position (pawn
 * structures, pieces left) and the engine's view of the player's choices (sharpness, and picking captures
 * and checks among moves it rates as equal) were each tested against 36 legends of known style and none
 * told attacking from positional players, or found a legend from unseen games, better than chance and the
 * repertoire; see scripts/eval-styles.ts and the commit that removed them.
 */
export function matchStyle(you: YourStyle, data: StyleData): Match[] {
  return data.legends
    .flatMap((legend): Match[] => {
      const rep = repertoireSimilarity(you.repertoire, legend.repertoire, data.repertoireMean);
      if (!rep) return [];
      return [
        {
          legend,
          similarity: pct(rep.overall),
          white: rep.white === undefined ? undefined : pct(rep.white),
          black: rep.black === undefined ? undefined : pct(rep.black),
          shared: shared(you.repertoire, legend.repertoire, data.repertoireMean),
        },
      ];
    })
    .sort((a, b) => b.similarity - a.similarity);
}

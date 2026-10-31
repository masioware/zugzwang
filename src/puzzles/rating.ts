// Glicko-1 rating for the player's puzzle results, updated one puzzle at a time (like Lichess does).

export interface Rating {
  rating: number;
  rd: number;
}

export const INITIAL_RATING: Rating = { rating: 1500, rd: 350 };
/** Keeps the rating responsive after many puzzles. */
const MIN_RD = 60;
/** Deviation assumed for every puzzle (their ratings are well established). */
const PUZZLE_RD = 80;
/** Above this deviation the rating is shown as provisional. */
export const PROVISIONAL_RD = 110;

const Q = Math.log(10) / 400;
const g = (rd: number) => 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));

export function expectedScore(player: number, puzzle: number): number {
  return 1 / (1 + 10 ** ((-g(PUZZLE_RD) * (player - puzzle)) / 400));
}

export function updateRating({ rating, rd }: Rating, puzzleRating: number, solved: boolean): Rating {
  const gj = g(PUZZLE_RD);
  const e = expectedScore(rating, puzzleRating);
  const d2 = 1 / (Q * Q * gj * gj * e * (1 - e));
  const denom = 1 / (rd * rd) + 1 / d2;
  return {
    rating: Math.round(rating + (Q / denom) * gj * ((solved ? 1 : 0) - e)),
    rd: Math.max(MIN_RD, Math.sqrt(1 / denom)),
  };
}

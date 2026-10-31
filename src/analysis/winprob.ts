import type { Color, Score } from '../types';

/** Win% for White (0–100) from an engine score, using Lichess' model. */
export function winPercent(score: Score): number {
  let cp: number;
  if (score.mate !== undefined) cp = score.mate > 0 || (score.mate === 0 && (score.cp ?? 0) > 0) ? 1000 : -1000;
  else cp = Math.max(-1000, Math.min(1000, score.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

export function winPercentFor(score: Score, color: Color): number {
  const w = winPercent(score);
  return color === 'white' ? w : 100 - w;
}

/** Human-readable eval, e.g. "+1.24", "-0.30", "M3", "-M2". */
export function formatScore(score: Score): string {
  if (score.mate !== undefined) {
    if (score.mate === 0) return (score.cp ?? 0) >= 0 ? '1-0' : '0-1';
    return `${score.mate < 0 ? '-' : ''}M${Math.abs(score.mate)}`;
  }
  const v = (score.cp ?? 0) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
}

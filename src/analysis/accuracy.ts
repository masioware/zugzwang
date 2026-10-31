import type { Color } from '../types';

/** Lichess move accuracy from the mover's win% before and after the move. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  if (winAfter >= winBefore) return 100;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * (winBefore - winAfter)) - 3.166924740191411;
  return Math.max(0, Math.min(100, raw + 1));
}

function stdDev(xs: number[]): number {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
}

function harmonicMean(xs: number[]): number {
  return xs.length / xs.reduce((a, x) => a + 1 / Math.max(x, 1), 0);
}

/**
 * Game accuracy per side, following Lichess: the average of a volatility-weighted
 * mean and a harmonic mean of move accuracies.
 * @param whiteWins White win% for every position, including the initial one.
 * @param accuracies accuracy of each move (ply i goes from position i to i+1).
 */
export function gameAccuracy(
  whiteWins: number[],
  accuracies: number[],
  firstMover: Color = 'white',
): { white: number; black: number } {
  const windowSize = Math.max(2, Math.min(8, Math.floor(accuracies.length / 10)));
  const windows: number[][] = [];
  const head = whiteWins.slice(0, windowSize);
  for (let i = 0; i < Math.min(windowSize - 2, accuracies.length); i++) windows.push(head);
  for (let i = 0; i + windowSize <= whiteWins.length; i++) windows.push(whiteWins.slice(i, i + windowSize));
  const weights = windows.map((w) => Math.max(0.5, Math.min(12, stdDev(w))));

  const result = { white: 100, black: 100 };
  for (const color of ['white', 'black'] as const) {
    const offset = color === firstMover ? 0 : 1;
    const accs: number[] = [];
    let weighted = 0;
    let totalWeight = 0;
    for (let i = offset; i < accuracies.length; i += 2) {
      const w = weights[i] ?? 1;
      accs.push(accuracies[i]);
      weighted += accuracies[i] * w;
      totalWeight += w;
    }
    if (accs.length) result[color] = (weighted / totalWeight + harmonicMean(accs)) / 2;
  }
  return result;
}

/**
 * Y domain for accuracy lines: zoom in on the data (lines don't need a zero baseline)
 * but keep 100 as the ceiling and round to tens so ticks stay readable.
 */
export function accuracyDomain(values: number[]): [number, number] {
  if (!values.length) return [0, 100];
  const lo = Math.floor((Math.min(...values) - 5) / 10) * 10;
  return [Math.max(0, Math.min(lo, 70)), 100];
}

export function ticksFor([lo, hi]: [number, number], step = 10): number[] {
  const out: number[] = [];
  const s = hi - lo > 50 ? 25 : step;
  for (let v = Math.ceil(lo / s) * s; v <= hi; v += s) out.push(v);
  return out;
}

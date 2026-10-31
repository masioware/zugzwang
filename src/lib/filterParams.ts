import { DEFAULT_FILTERS, type Filters } from '../stats/aggregate';

export const TIME_CLASSES = ['bullet', 'blitz', 'rapid', 'classical', 'daily'] as const;
/** Days back offered by the period filter; 0 = all time. */
export const FILTER_PERIODS = [0, 30, 90, 365];

/** Query-string name of each filter. */
const PARAM: { [K in keyof Filters]: string } = {
  source: 'source',
  timeClass: 'time',
  color: 'color',
  outcome: 'result',
  rated: 'rated',
  period: 'period',
  search: 'q',
};

const ALLOWED: { [K in keyof Filters]?: readonly Filters[K][] } = {
  source: ['chesscom', 'lichess'],
  timeClass: TIME_CLASSES,
  color: ['white', 'black'],
  outcome: ['win', 'draw', 'loss'],
  rated: ['rated', 'casual'],
  period: FILTER_PERIODS,
};

const KEYS = Object.keys(PARAM) as (keyof Filters)[];

/** Filters named in the query string (unknown values fall back to the default), or null if it names none. */
export function filtersFromParams(params: URLSearchParams): Filters | null {
  if (!KEYS.some((k) => params.has(PARAM[k]))) return null;
  const f: Filters = { ...DEFAULT_FILTERS };
  for (const k of KEYS) {
    const raw = params.get(PARAM[k]);
    if (raw === null) continue;
    const value = k === 'period' ? Number(raw) : raw;
    const allowed = ALLOWED[k] as readonly unknown[] | undefined;
    if (!allowed || allowed.includes(value)) (f as Record<keyof Filters, unknown>)[k] = value;
  }
  return f;
}

/** Writes the filters into `params` in place; defaults are left out to keep URLs short. */
export function writeFilterParams(params: URLSearchParams, f: Filters): URLSearchParams {
  for (const k of KEYS) {
    if (f[k] === DEFAULT_FILTERS[k]) params.delete(PARAM[k]);
    else params.set(PARAM[k], String(f[k]));
  }
  return params;
}

export function sameFilters(a: Filters, b: Filters): boolean {
  return KEYS.every((k) => a[k] === b[k]);
}

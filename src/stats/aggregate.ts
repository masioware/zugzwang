import type { Classification, Color, Game, GameAnalysis, GameSource, Phase, Source, Termination, TimeClass } from '../types';
import { openingFamily } from '../analysis/openings';

export interface Filters {
  source: 'all' | Source;
  timeClass: 'all' | TimeClass;
  color: 'all' | Color;
  outcome: 'all' | Game['outcome'];
  rated: 'all' | 'rated' | 'casual';
  /** Days back; 0 = all time. */
  period: number;
  search: string;
}

export const DEFAULT_FILTERS: Filters = {
  source: 'all',
  timeClass: 'all',
  color: 'all',
  outcome: 'all',
  rated: 'all',
  period: 0,
  search: '',
};

export function filterGames(games: Game[], f: Filters, now = Date.now()): Game[] {
  const q = f.search.trim().toLowerCase();
  return games.filter(
    (g) =>
      (f.source === 'all' || g.source === f.source) &&
      (f.timeClass === 'all' || g.timeClass === f.timeClass) &&
      (f.color === 'all' || g.userColor === f.color) &&
      (f.outcome === 'all' || g.outcome === f.outcome) &&
      (f.rated === 'all' || g.rated === (f.rated === 'rated')) &&
      (!f.period || g.endTime >= now - f.period * 86_400_000) &&
      (!q ||
        opponent(g).name.toLowerCase().includes(q) ||
        (g.opening.name ?? '').toLowerCase().includes(q)),
  );
}

export function opponent(g: Game) {
  return g.userColor === 'white' ? g.black : g.white;
}

export function me(g: Game) {
  return g[g.userColor];
}

export interface WDL {
  games: number;
  win: number;
  draw: number;
  loss: number;
}

export const emptyWdl = (): WDL => ({ games: 0, win: 0, draw: 0, loss: 0 });

export function addResult(w: WDL, g: Game) {
  w.games++;
  w[g.outcome]++;
}

/** Score in percent: wins + half the draws. */
export function scorePct(w: WDL): number {
  return w.games ? ((w.win + w.draw / 2) / w.games) * 100 : 0;
}

export function summarize(games: Game[]): WDL {
  const w = emptyWdl();
  games.forEach((g) => addResult(w, g));
  return w;
}

export function groupWdl<K extends string>(games: Game[], key: (g: Game) => K): Map<K, WDL> {
  const map = new Map<K, WDL>();
  for (const g of games) {
    const k = key(g);
    if (!map.has(k)) map.set(k, emptyWdl());
    addResult(map.get(k)!, g);
  }
  return map;
}

/** Results per calendar month, oldest first. */
export function resultsByMonth(games: Game[]): ({ month: string } & WDL)[] {
  const map = groupWdl(games, (g) => new Date(g.endTime).toISOString().slice(0, 7));
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, w]) => ({ month, ...w }));
}

export function terminations(games: Game[]): { termination: Termination; win: number; loss: number; draw: number }[] {
  const map = new Map<Termination, { win: number; loss: number; draw: number }>();
  for (const g of games) {
    const t = map.get(g.termination) ?? { win: 0, loss: 0, draw: 0 };
    t[g.outcome]++;
    map.set(g.termination, t);
  }
  return [...map.entries()]
    .map(([termination, v]) => ({ termination, ...v }))
    .sort((a, b) => b.win + b.loss + b.draw - (a.win + a.loss + a.draw));
}

export interface RatingSeries {
  key: string;
  source: GameSource;
  timeClass: TimeClass;
  points: { t: number; rating: number }[];
}

/** User rating after each rated game, one series per platform and time control. */
export function ratingHistory(games: Game[]): RatingSeries[] {
  const map = new Map<string, RatingSeries>();
  for (const g of [...games].sort((a, b) => a.endTime - b.endTime)) {
    const rating = me(g).rating;
    if (!g.rated || rating === undefined) continue;
    const key = `${g.source}:${g.timeClass}`;
    if (!map.has(key)) map.set(key, { key, source: g.source, timeClass: g.timeClass, points: [] });
    map.get(key)!.points.push({ t: g.endTime, rating });
  }
  return [...map.values()].sort((a, b) => b.points.length - a.points.length);
}

export interface OpeningRow extends WDL {
  name: string;
  eco?: string;
  score: number;
  accuracy?: number;
}

export function openingStats(
  games: Game[],
  analyses: Map<string, GameAnalysis>,
  color: Color,
  groupByFamily: boolean,
): OpeningRow[] {
  const rows = new Map<string, OpeningRow & { accSum: number; accN: number }>();
  for (const g of games) {
    if (g.userColor !== color) continue;
    const full = g.opening.name ?? 'Unknown';
    const name = groupByFamily ? (openingFamily(full) ?? full) : full;
    const row = rows.get(name) ?? { name, eco: g.opening.eco, ...emptyWdl(), score: 0, accSum: 0, accN: 0 };
    addResult(row, g);
    const a = analyses.get(g.id);
    if (a) {
      row.accSum += a.accuracy[color];
      row.accN++;
    }
    rows.set(name, row);
  }
  return [...rows.values()]
    .map(({ accSum, accN, ...r }) => ({ ...r, score: scorePct(r), accuracy: accN ? accSum / accN : undefined }))
    .sort((a, b) => b.games - a.games);
}

/** Pairs each analysed game with the user's moves in it. */
export function analysed(games: Game[], analyses: Map<string, GameAnalysis>) {
  return games.flatMap((g) => {
    const a = analyses.get(g.id);
    return a ? [{ game: g, analysis: a, myMoves: a.moves.filter((m) => m.color === g.userColor) }] : [];
  });
}

export function accuracyOverTime(games: Game[], analyses: Map<string, GameAnalysis>) {
  const points = analysed(games, analyses)
    .map(({ game, analysis }) => ({ t: game.endTime, accuracy: analysis.accuracy[game.userColor], id: game.id }))
    .sort((a, b) => a.t - b.t);
  // Rolling average over the last 10 analysed games smooths out single-game noise.
  return points.map((p, i) => {
    const win = points.slice(Math.max(0, i - 9), i + 1);
    return { ...p, average: win.reduce((s, x) => s + x.accuracy, 0) / win.length };
  });
}

const BAD: Classification[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];

export interface ErrorBucket {
  key: string;
  moves: number;
  accuracy: number;
  inaccuracy: number;
  mistake: number;
  miss: number;
  blunder: number;
}

function bucketize(entries: { key: string; move: GameAnalysis['moves'][number] }[], order: string[]): ErrorBucket[] {
  const map = new Map<string, ErrorBucket & { accSum: number }>();
  for (const key of order) map.set(key, { key, moves: 0, accuracy: 0, accSum: 0, inaccuracy: 0, mistake: 0, miss: 0, blunder: 0 });
  for (const { key, move } of entries) {
    const b = map.get(key)!;
    b.moves++;
    b.accSum += move.accuracy;
    if (BAD.includes(move.classification)) b[move.classification as 'inaccuracy']++;
  }
  return [...map.values()]
    .filter((b) => b.moves)
    .map(({ accSum, ...b }) => ({ ...b, accuracy: accSum / b.moves }));
}

const PHASES: Phase[] = ['opening', 'middlegame', 'endgame'];

export function errorsByPhase(games: Game[], analyses: Map<string, GameAnalysis>): ErrorBucket[] {
  const entries = analysed(games, analyses).flatMap(({ myMoves }) =>
    myMoves.filter((m) => m.classification !== 'book').map((move) => ({ key: move.phase, move })),
  );
  return bucketize(entries, PHASES);
}

export const CLOCK_BUCKETS = ['>50%', '20–50%', '10–20%', '<10%'];

/** Move quality grouped by how much of the initial clock was left before the move. */
export function errorsByClock(games: Game[], analyses: Map<string, GameAnalysis>): ErrorBucket[] {
  const entries = analysed(games, analyses).flatMap(({ game, myMoves }) => {
    if (!game.initialTime) return [];
    return myMoves.flatMap((move) => {
      if (move.clockBefore === undefined || move.classification === 'book') return [];
      const pct = move.clockBefore / game.initialTime!;
      const key = pct > 0.5 ? CLOCK_BUCKETS[0] : pct > 0.2 ? CLOCK_BUCKETS[1] : pct > 0.1 ? CLOCK_BUCKETS[2] : CLOCK_BUCKETS[3];
      return [{ key, move }];
    });
  });
  return bucketize(entries, CLOCK_BUCKETS);
}

export const CLASSIFICATIONS: Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

export function averageAccuracy(games: Game[], analyses: Map<string, GameAnalysis>): number | undefined {
  const list = analysed(games, analyses);
  return list.length ? list.reduce((s, x) => s + x.analysis.accuracy[x.game.userColor], 0) / list.length : undefined;
}

export function countClassifications(analysis: GameAnalysis, color: Color): Record<Classification, number> {
  const counts = Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0])) as Record<Classification, number>;
  for (const m of analysis.moves) if (m.color === color) counts[m.classification]++;
  return counts;
}

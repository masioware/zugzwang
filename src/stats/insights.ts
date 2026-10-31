import type { Classification, Game, GameAnalysis, Outcome, Phase } from '../types';
import { addResult, analysed, CLASSIFICATIONS, emptyWdl, opponent, scorePct, type WDL } from './aggregate';
import type { GameFacts } from './facts';
import { openingFamily } from '../analysis/openings';

type Analyses = Map<string, GameAnalysis>;
type Facts = Map<string, GameFacts>;

export interface Bucket extends WDL {
  key: string;
  /** Average accuracy of the user's analysed games in this bucket. */
  accuracy?: number;
  analysed: number;
}

/** Groups games into buckets with results and the user's average accuracy. */
function bucketGames(
  games: Game[],
  analyses: Analyses,
  keyOf: (g: Game) => string | undefined,
  order?: string[],
): Bucket[] {
  const map = new Map<string, Bucket & { accSum: number }>();
  for (const k of order ?? []) map.set(k, { key: k, ...emptyWdl(), analysed: 0, accSum: 0 });
  for (const g of games) {
    const key = keyOf(g);
    if (key === undefined) continue;
    if (!map.has(key)) map.set(key, { key, ...emptyWdl(), analysed: 0, accSum: 0 });
    const b = map.get(key)!;
    addResult(b, g);
    const a = analyses.get(g.id);
    if (a) {
      b.analysed++;
      b.accSum += a.accuracy[g.userColor];
    }
  }
  const list = [...map.values()].map(({ accSum, ...b }) => ({ ...b, accuracy: b.analysed ? accSum / b.analysed : undefined }));
  return order ? list : list.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}

/** Results against opponents grouped by rating band (100 points wide). */
export function byOpponentRating(games: Game[], analyses: Analyses): Bucket[] {
  return bucketGames(games, analyses, (g) => {
    const r = opponent(g).rating;
    return r === undefined ? undefined : String(Math.floor(r / 100) * 100);
  });
}

/** The user's average accuracy split by the game's result. */
export function accuracyByResult(games: Game[], analyses: Analyses): Record<Outcome, number | undefined> {
  const sums = { win: [0, 0], draw: [0, 0], loss: [0, 0] } as Record<Outcome, [number, number]>;
  for (const { game, analysis } of analysed(games, analyses)) {
    sums[game.outcome][0] += analysis.accuracy[game.userColor];
    sums[game.outcome][1]++;
  }
  const avg = (o: Outcome) => (sums[o][1] ? sums[o][0] / sums[o][1] : undefined);
  return { win: avg('win'), draw: avg('draw'), loss: avg('loss') };
}

/** Average accuracy of the user's n-th move, over all analysed games (moves with enough samples). */
export function accuracyByMoveNumber(games: Game[], analyses: Analyses, minSamples = 3) {
  const sums: { sum: number; n: number }[] = [];
  for (const { myMoves } of analysed(games, analyses)) {
    for (const m of myMoves) {
      const move = Math.floor(m.ply / 2) + 1;
      sums[move] ??= { sum: 0, n: 0 };
      sums[move].sum += m.accuracy;
      sums[move].n++;
    }
  }
  return sums.flatMap((s, move) => (s && s.n >= minSamples ? [{ move, accuracy: s.sum / s.n, samples: s.n }] : []));
}

export const PHASES: Phase[] = ['opening', 'middlegame', 'endgame'];

/** Games grouped by the phase in which they ended. */
export function byEndPhase(games: Game[], analyses: Analyses, facts: Facts): Bucket[] {
  return bucketGames(games, analyses, (g) => facts.get(g.id)?.endPhase, PHASES);
}

/** Share and total of each move classification among the user's moves. */
export function moveQuality(games: Game[], analyses: Analyses) {
  const counts = Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0])) as Record<Classification, number>;
  let total = 0;
  for (const { myMoves } of analysed(games, analyses))
    for (const m of myMoves) {
      counts[m.classification]++;
      total++;
    }
  return CLASSIFICATIONS.map((c) => ({ classification: c, count: counts[c], share: total ? (counts[c] / total) * 100 : 0 }));
}

/** Classification shares (percent of the user's moves) per week or month, oldest first. */
export function moveQualityOverTime(games: Game[], analyses: Analyses) {
  const list = analysed(games, analyses);
  if (!list.length) return { unit: 'month' as const, points: [] };
  const times = list.map((x) => x.game.endTime);
  const unit = Math.max(...times) - Math.min(...times) > 120 * 86_400_000 ? ('month' as const) : ('week' as const);
  const keyOf = (t: number) => {
    const d = new Date(t);
    if (unit === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    return monday.getTime();
  };
  const map = new Map<number, Record<Classification, number> & { total: number }>();
  for (const { game, myMoves } of list) {
    const k = keyOf(game.endTime);
    if (!map.has(k)) map.set(k, { ...(Object.fromEntries(CLASSIFICATIONS.map((c) => [c, 0])) as Record<Classification, number>), total: 0 });
    const row = map.get(k)!;
    for (const m of myMoves) {
      row[m.classification]++;
      row.total++;
    }
  }
  const points = [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, row]) => ({
      t,
      total: row.total,
      ...(Object.fromEntries(CLASSIFICATIONS.map((c) => [c, row.total ? (row[c] / row.total) * 100 : 0])) as Record<Classification, number>),
    }));
  return { unit, points };
}

export const PIECE_ORDER = ['p', 'n', 'b', 'r', 'q', 'k'];

/** How often the user moves each piece type, and the accuracy of those moves (analysed games). */
export function pieceStats(games: Game[], analyses: Analyses, facts: Facts) {
  const rows = new Map(PIECE_ORDER.map((p) => [p, { piece: p, moves: 0, accSum: 0, accN: 0 }]));
  for (const g of games) {
    const f = facts.get(g.id);
    if (!f) continue;
    const a = analyses.get(g.id);
    f.pieces.forEach((piece, ply) => {
      if ((ply % 2 === 0) !== (g.userColor === 'white')) return;
      const row = rows.get(piece)!;
      row.moves++;
      const m = a?.moves[ply];
      if (m && m.classification !== 'book') {
        row.accSum += m.accuracy;
        row.accN++;
      }
    });
  }
  const total = [...rows.values()].reduce((s, r) => s + r.moves, 0);
  return [...rows.values()].map((r) => ({
    piece: r.piece,
    moves: r.moves,
    share: total ? (r.moves / total) * 100 : 0,
    accuracy: r.accN ? r.accSum / r.accN : undefined,
  }));
}

export const CASTLE_PHASES = ['opening', 'middlegame', 'endgame', 'none'] as const;

/** When (and whether) the user castled, and how those games went. */
export function castlingStats(games: Game[], analyses: Analyses, facts: Facts) {
  const byPhase = bucketGames(games, analyses, (g) => facts.get(g.id)?.castle?.phase ?? (facts.has(g.id) ? 'none' : undefined), [...CASTLE_PHASES]);
  const bySide = bucketGames(games, analyses, (g) => facts.get(g.id)?.castle?.side, ['short', 'long']);
  return { byPhase, bySide };
}

export const DAY_PARTS = ['night', 'morning', 'afternoon', 'evening'] as const;

/** Local time of day the game ended: 0–6 night, 6–12 morning, 12–18 afternoon, 18–24 evening. */
export function byDayPart(games: Game[], analyses: Analyses): Bucket[] {
  return bucketGames(games, analyses, (g) => DAY_PARTS[Math.floor(new Date(g.endTime).getHours() / 6)], [...DAY_PARTS]);
}

/** Weekday the game ended (0 = Sunday), local time. */
export function byWeekday(games: Game[], analyses: Analyses): Bucket[] {
  return bucketGames(games, analyses, (g) => String(new Date(g.endTime).getDay()), ['0', '1', '2', '3', '4', '5', '6']);
}

export interface OpeningLineRow extends WDL {
  name: string;
  line: string[];
  score: number;
  accuracy?: number;
  /** Games where the user, not the opponent, played the first non-book move. */
  userLeftFirst: number;
  /** Games that left the book at all. */
  leftBook: number;
  avgLeaveMove?: number;
}

/**
 * Per-opening performance and book mastery for one colour. `line` is the most common move
 * sequence that reaches the opening (or its family, when grouping).
 */
export function openingPerformance(
  games: Game[],
  analyses: Analyses,
  facts: Facts,
  color: 'white' | 'black',
  groupByFamily: boolean,
): OpeningLineRow[] {
  const rows = new Map<string, OpeningLineRow & { lines: Map<string, number>; accSum: number; accN: number; leaveSum: number }>();
  for (const g of games) {
    if (g.userColor !== color) continue;
    const f = facts.get(g.id);
    const full = g.opening.name ?? 'Unknown';
    const name = groupByFamily ? (openingFamily(full) ?? full) : full;
    const row =
      rows.get(name) ??
      { name, line: [], ...emptyWdl(), score: 0, userLeftFirst: 0, leftBook: 0, lines: new Map(), accSum: 0, accN: 0, leaveSum: 0 };
    addResult(row, g);
    if (f) {
      const line = (groupByFamily ? f.familyLine : f.openingLine).join(' ');
      if (line) row.lines.set(line, (row.lines.get(line) ?? 0) + 1);
      if (f.userLeftBook !== null) row.leftBook++;
      if (f.userLeftBook) {
        row.userLeftFirst++;
        row.leaveSum += f.leftBookAtMove!;
      }
    }
    const a = analyses.get(g.id);
    if (a) {
      row.accSum += a.accuracy[color];
      row.accN++;
    }
    rows.set(name, row);
  }
  return [...rows.values()]
    .map(({ lines, accSum, accN, leaveSum, ...r }) => ({
      ...r,
      line: ([...lines.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '').split(' ').filter(Boolean),
      score: scorePct(r),
      accuracy: accN ? accSum / accN : undefined,
      avgLeaveMove: r.userLeftFirst ? leaveSum / r.userLeftFirst : undefined,
    }))
    .sort((a, b) => b.games - a.games);
}

/** Book mastery for one colour: games where the user left the book first, over time. */
export function bookMastery(games: Game[], facts: Facts, color: 'white' | 'black') {
  const points = games
    .filter((g) => g.userColor === color && facts.get(g.id)?.userLeftBook)
    .map((g) => ({ t: g.endTime, move: facts.get(g.id)!.leftBookAtMove!, id: g.id }))
    .sort((a, b) => a.t - b.t);
  const considered = games.filter((g) => g.userColor === color && facts.get(g.id)?.userLeftBook !== null && facts.has(g.id)).length;
  return {
    points,
    considered,
    average: points.length ? points.reduce((s, p) => s + p.move, 0) / points.length : undefined,
  };
}

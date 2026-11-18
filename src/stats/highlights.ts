import type { Game, GameAnalysis, Phase } from '../types';
import { errorsByPhase, openingStats, scorePct, summarize } from './aggregate';
import { byDayPart, DAY_PARTS } from './insights';

export type Highlight =
  | { kind: 'form'; score: number; previous?: number; games: number }
  | { kind: 'phase'; phase: Phase; accuracy: number }
  | { kind: 'opening'; name: string; color: 'white' | 'black'; score: number; games: number }
  | { kind: 'dayPart'; part: (typeof DAY_PARTS)[number]; score: number; games: number };

const DAY = 86_400_000;
export const FORM_DAYS = 30;
const MIN_OPENING_GAMES = 5;
const MIN_PART_GAMES = 10;
const MIN_PHASE_MOVES = 30;

/**
 * A few things worth knowing at a glance, each shown only when there is enough data behind it:
 * recent form, the weakest phase, the worst opening and the best time of day.
 */
export function highlights(games: Game[], analyses: Map<string, GameAnalysis>, now = Date.now()): Highlight[] {
  const out: Highlight[] = [];

  const recent = games.filter((g) => g.endTime >= now - FORM_DAYS * DAY);
  if (recent.length >= 5) {
    const before = games.filter((g) => g.endTime < now - FORM_DAYS * DAY && g.endTime >= now - 2 * FORM_DAYS * DAY);
    out.push({ kind: 'form', score: scorePct(summarize(recent)), previous: before.length >= 5 ? scorePct(summarize(before)) : undefined, games: recent.length });
  }

  const phases = errorsByPhase(games, analyses).filter((b) => b.moves >= MIN_PHASE_MOVES);
  if (phases.length >= 2) {
    const worst = phases.reduce((a, b) => (b.accuracy < a.accuracy ? b : a));
    out.push({ kind: 'phase', phase: worst.key as Phase, accuracy: worst.accuracy });
  }

  const openings = (['white', 'black'] as const).flatMap((color) =>
    openingStats(games, analyses, color, true)
      .filter((o) => o.games >= MIN_OPENING_GAMES && o.name !== 'Unknown')
      .map((o) => ({ ...o, color })),
  );
  const worstOpening = openings.sort((a, b) => a.score - b.score)[0];
  if (worstOpening && worstOpening.score < 50)
    out.push({ kind: 'opening', name: worstOpening.name, color: worstOpening.color, score: worstOpening.score, games: worstOpening.games });

  const parts = byDayPart(games, analyses).filter((b) => b.games >= MIN_PART_GAMES);
  if (parts.length >= 2) {
    const best = parts.reduce((a, b) => (scorePct(b) > scorePct(a) ? b : a));
    const worst = parts.reduce((a, b) => (scorePct(b) < scorePct(a) ? b : a));
    // A difference of under 5 points is noise, not a habit worth pointing out.
    if (scorePct(best) - scorePct(worst) >= 5)
      out.push({ kind: 'dayPart', part: best.key as (typeof DAY_PARTS)[number], score: scorePct(best), games: best.games });
  }

  return out;
}

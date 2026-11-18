import type { Game, GameAnalysis, MoveAnalysis } from '../types';
import { replay } from '../lib/chess';
import { openingFamily } from '../analysis/openings';
import { tacticTags } from './tags';

export type WeaknessKind = 'tactic' | 'phase' | 'time' | 'opening';

/** Stable identifier, e.g. `tactic:hungPiece`, `phase:endgame`, `time:lowClock`, `opening:Sicilian Defense`. */
export type WeaknessId = `${WeaknessKind}:${string}`;

export interface MistakeExample {
  gameId: string;
  /** Index of the move in the game (0-based, as MoveAnalysis.ply): the position before it is `ply` plies in. */
  ply: number;
  /** Position before the move, so an exercise can be built without replaying. */
  fenBefore: string;
  /** The opponent's move that led here and the position before it; absent when the mistake is the first move. */
  setup?: { fen: string; uci: string };
  playedUci: string;
  bestUci?: string;
  /** Win% the mover threw away. */
  loss: number;
}

export interface Weakness {
  id: WeaknessId;
  kind: WeaknessKind;
  /** Suffix of the id, used by the UI to look up the label. */
  key: string;
  /** Mistakes carrying this tag. */
  count: number;
  /** Moves of the user in which the mistake could have happened (the rate's denominator). */
  opportunities: number;
  /** Mistakes per 100 opportunities. */
  rate: number;
  /** Total win% lost to it. */
  loss: number;
  /** Worst first. */
  examples: MistakeExample[];
}

/** Only rated games feed training: casual and bot games are played with different stakes and would blur the picture. */
export const isTrainable = (g: Game) => g.rated;

export const MISTAKES = new Set(['mistake', 'miss', 'blunder']);
export const MIN_TACTIC = 3;
export const MIN_CONTEXT = 5;
/** A context (phase, clock, opening) only counts when it is clearly worse than the user's own baseline. */
export const CONTEXT_FACTOR = 1.3;
const MAX_EXAMPLES = 5;
/** Under this share of the starting clock (or this many seconds) the move counts as played in time trouble. */
const LOW_SHARE = 0.1;
const LOW_SECONDS = 15;

export const isMistake = (m: MoveAnalysis) => MISTAKES.has(m.classification);

export function isLowClock(m: MoveAnalysis, initialTime?: number): boolean {
  if (m.clockBefore === undefined) return false;
  return m.clockBefore <= LOW_SECONDS || (!!initialTime && m.clockBefore <= initialTime * LOW_SHARE);
}

interface Bucket {
  kind: WeaknessKind;
  key: string;
  count: number;
  opportunities: number;
  loss: number;
  examples: MistakeExample[];
}

/**
 * Finds what the user keeps getting wrong. Every move of theirs is an "opportunity" for the contexts it
 * happens in (phase, clock, opening), every mistake adds to the buckets it matches; tactical tags are
 * measured against all of the user's moves.
 */
export function diagnose(games: Game[], analyses: Map<string, GameAnalysis>): Weakness[] {
  const buckets = new Map<string, Bucket>();
  const get = (kind: WeaknessKind, key: string): Bucket => {
    const id = `${kind}:${key}`;
    let b = buckets.get(id);
    if (!b) buckets.set(id, (b = { kind, key, count: 0, opportunities: 0, loss: 0, examples: [] }));
    return b;
  };

  let moves = 0;
  let mistakes = 0;

  for (const game of games) {
    const analysis = analyses.get(game.id);
    if (!analysis || game.userColor === undefined || !isTrainable(game)) continue;
    const family = openingFamily(game.opening.name);
    const mine = analysis.moves.filter((m) => m.color === game.userColor);
    let plies: ReturnType<typeof replay> | undefined;

    for (const m of mine) {
      moves++;
      get('phase', m.phase).opportunities++;
      if (m.clockBefore !== undefined) get('time', 'lowClock').opportunities += isLowClock(m, game.initialTime) ? 1 : 0;
      if (family) get('opening', family).opportunities++;
      if (!isMistake(m)) continue;
      mistakes++;
      const loss = Math.max(0, m.winBefore - m.winAfter);
      plies ??= replay(game.moves);
      const ply = plies[m.ply];
      if (!ply) continue;
      const prev = plies[m.ply - 1];
      const example: MistakeExample = {
        gameId: game.id,
        ply: m.ply,
        fenBefore: ply.fenBefore,
        setup: prev && { fen: prev.fenBefore, uci: prev.uci },
        playedUci: m.uci,
        bestUci: m.bestUci,
        loss,
      };
      const hit = (b: Bucket) => {
        b.count++;
        b.loss += loss;
        b.examples.push(example);
      };
      hit(get('phase', m.phase));
      if (isLowClock(m, game.initialTime)) hit(get('time', 'lowClock'));
      if (family) hit(get('opening', family));
      for (const t of tacticTags({ fenBefore: ply.fenBefore, playedUci: m.uci, bestUci: m.bestUci, bestSan: m.bestSan }))
        hit(get('tactic', t));
    }
  }

  const baseline = moves ? mistakes / moves : 0;
  const out: Weakness[] = [];
  for (const [id, b] of buckets) {
    const isTactic = b.kind === 'tactic';
    const opportunities = isTactic ? moves : b.opportunities;
    if (b.count < (isTactic ? MIN_TACTIC : MIN_CONTEXT) || !opportunities) continue;
    const rate = (b.count / opportunities) * 100;
    if (!isTactic && rate < baseline * 100 * CONTEXT_FACTOR) continue;
    out.push({
      id: id as WeaknessId,
      kind: b.kind,
      key: b.key,
      count: b.count,
      opportunities,
      rate,
      loss: b.loss,
      examples: b.examples.sort((a, c) => c.loss - a.loss).slice(0, MAX_EXAMPLES),
    });
  }
  return out.sort((a, b) => b.loss - a.loss);
}

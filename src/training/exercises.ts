import { db } from '../db';
import { sampleLocal } from '../puzzles/source';
import type { EngineLine, Puzzle } from '../types';
import type { MistakeExample, Weakness } from './diagnose';

/** Lichess puzzle themes that drill the same skill as a weakness (undefined: no matching theme). */
export function themeFor(w: Pick<Weakness, 'kind' | 'key'>): string | undefined {
  if (w.kind === 'tactic')
    return { hungPiece: 'hangingPiece', missedMate: 'mate', missedCapture: 'advantage', missedFork: 'fork' }[w.key];
  if (w.kind === 'phase') return { opening: 'opening', middlegame: 'middlegame', endgame: 'endgame' }[w.key];
  return undefined;
}

/** Solution line for a mistake: the engine's best move, or the whole forced mate when the engine saw one. */
export function solutionLine(example: Pick<MistakeExample, 'bestUci'>, top?: EngineLine): string[] | undefined {
  if (!example.bestUci) return undefined;
  if (top?.mate && top.mate > 0 && top.pv[0] === example.bestUci) {
    // The line must end on the player's move: pv alternates player/opponent, so keep an odd length.
    return top.pv.slice(0, top.pv.length % 2 ? top.pv.length : top.pv.length - 1);
  }
  return [example.bestUci];
}

/**
 * Turns a mistake into a puzzle of the shape the solver expects: the opponent's previous move is the setup
 * move, so the player lands on the very position they misplayed. Undefined when there is nothing to solve
 * (no setup move, no engine move).
 */
export function ownPuzzle(example: MistakeExample, themes: string[], top?: EngineLine): Puzzle | undefined {
  const solution = solutionLine(example, top);
  if (!example.setup || !solution) return undefined;
  return {
    id: `own:${example.gameId}:${example.ply}`,
    fen: example.setup.fen,
    moves: [example.setup.uci, ...solution],
    // Not a Lichess puzzle: no difficulty. Own puzzles never feed the puzzle rating.
    rating: 0,
    themes,
    origin: 'own',
    addedAt: Date.now(),
  };
}

/** The puzzles built from a weakness's own mistakes (worst first), at most `max`. */
export async function ownPuzzles(w: Weakness, max = 5): Promise<Puzzle[]> {
  const theme = themeFor(w);
  const out: Puzzle[] = [];
  for (const e of w.examples) {
    if (out.length >= max) break;
    const lines = await db.analysisLines.get(e.gameId);
    const p = ownPuzzle(e, theme ? [theme] : [], lines?.positions[e.ply]?.[0]);
    if (p) out.push(p);
  }
  return out;
}

/** Lichess puzzles of the weakness's theme, unplayed first; empty for weaknesses without a matching theme. */
export async function themePuzzles(w: Weakness, n = 10): Promise<Puzzle[]> {
  const theme = themeFor(w);
  if (!theme) return [];
  return sampleLocal({ theme, min: 800, max: 1800 }, n);
}

/** A lesson: first the player's own mistakes, then practice on the same skill. */
export interface Lesson {
  own: Puzzle[];
  practice: Puzzle[];
}

export async function buildLesson(w: Weakness): Promise<Lesson> {
  const [own, practice] = await Promise.all([ownPuzzles(w), themePuzzles(w)]);
  return { own, practice };
}

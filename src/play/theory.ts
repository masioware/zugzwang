// Opening theory (lichess-org/chess-openings) as a move tree, for the bot to follow a named line.
import { positionKey } from '../lib/chess';
import { weightedPick, type MoveCount } from './repertoire';

export interface Theory {
  /** Name of each line; indices are line ids. */
  names: string[];
  /** Position key -> theory moves from it, each with the ids of the lines that go through it. */
  tree: Record<string, [string, number[]][]>;
}

let theoryPromise: Promise<Theory> | null = null;

/** Built by scripts/build-openings.mjs; fetched on first use only (it's the larger of the opening files). */
export function loadTheory(): Promise<Theory> {
  theoryPromise ??= fetch('/data/theory.json').then((r) => r.json() as Promise<Theory>);
  return theoryPromise;
}

/** Whether a line belongs to the target opening: the opening itself or one of its sub-variations. */
export function inOpening(name: string, target: string): boolean {
  return name === target || name.startsWith(`${target}:`) || name.startsWith(`${target},`);
}

/**
 * Theory moves in this position, each with how many named lines go through it (a rough measure of how
 * main a line is). With a target opening, only moves on its lines count: the moves that lead to it, then
 * its sub-variations. Empty when the position is out of (that) theory.
 */
export function theoryMoves(theory: Theory, fen: string, target?: string): MoveCount[] {
  const children = theory.tree[positionKey(fen)] ?? [];
  return children
    .map(([san, ids]) => ({ san, n: target ? ids.filter((i) => inOpening(theory.names[i], target)).length : ids.length }))
    .filter((m) => m.n > 0)
    .sort((a, b) => b.n - a.n);
}

/** A theory move picked in proportion to the lines through it, or undefined out of theory. */
export function theoryMove(theory: Theory, fen: string, target?: string, rand = Math.random()): string | undefined {
  return weightedPick(theoryMoves(theory, fen, target), rand);
}

// Visualisation drills: short questions answered without a board in front of you. Pure, with an injectable RNG.
import { Chess } from 'chess.js';
import type { DrillKind, DrillRun } from '../types';

export const DRILL_KINDS: DrillKind[] = ['color', 'knight', 'bishop', 'board'];
export const ROUND_SIZE = 10;

export type Rng = () => number;

export interface Question {
  kind: DrillKind;
  /** color: [square]; knight/bishop: [from, to]; board: [square]. */
  squares: string[];
  /** board: the moves played from the start position, in SAN. */
  moves?: string[];
  /** The key of the right option. */
  answer: string;
  /** Option keys in display order: 'light'/'dark', 'yes'/'no', or 'empty' and piece codes like 'wN'. */
  options: string[];
}

const FILES = 'abcdefgh';
const square = (f: number, r: number) => `${FILES[f]}${r + 1}`;
const coords = (sq: string) => [FILES.indexOf(sq[0]), Number(sq[1]) - 1] as const;
const int = (rng: Rng, n: number) => Math.floor(rng() * n);
const pick = <T>(rng: Rng, items: readonly T[]): T => items[int(rng, items.length)];
const randomSquare = (rng: Rng) => square(int(rng, 8), int(rng, 8));

export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = int(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** a1 is dark; a square is light when file + rank (0-based) is odd. */
export const squareColor = (sq: string): 'light' | 'dark' => {
  const [f, r] = coords(sq);
  return (f + r) % 2 === 1 ? 'light' : 'dark';
};

export function knightMoves(sq: string): string[] {
  const [f, r] = coords(sq);
  return [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
    .map(([df, dr]) => [f + df, r + dr])
    .filter(([x, y]) => x >= 0 && x < 8 && y >= 0 && y < 8)
    .map(([x, y]) => square(x, y));
}

export function sameDiagonal(a: string, b: string): boolean {
  const [af, ar] = coords(a);
  const [bf, br] = coords(b);
  return a !== b && Math.abs(af - bf) === Math.abs(ar - br);
}

/** Plays `plies` random legal moves from the start; stops early if the game ends. */
export function randomLine(plies: number, rng: Rng): { moves: string[]; chess: Chess } {
  const chess = new Chess();
  const moves: string[] = [];
  while (moves.length < plies && !chess.isGameOver()) {
    const legal = chess.moves();
    const san = pick(rng, legal);
    chess.move(san);
    moves.push(san);
  }
  return { moves, chess };
}

const PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

function boardQuestion(rng: Rng, plies: number): Question {
  const { moves, chess } = randomLine(plies, rng);
  // Mostly ask about occupied squares, sometimes about an empty one.
  const board = chess.board().flat();
  const occupied = board.filter((p) => p !== null);
  const target = rng() < 0.25 ? randomSquare(rng) : pick(rng, occupied).square;
  const piece = chess.get(target as never);
  const answer = piece ? piece.color + piece.type.toUpperCase() : 'empty';
  const distractors = shuffled(PIECES.filter((p) => p !== answer), rng).slice(0, answer === 'empty' ? 4 : 3);
  const options = shuffled([answer, ...(answer === 'empty' ? [] : ['empty']), ...distractors], rng);
  return { kind: 'board', squares: [target], moves, answer, options };
}

/** One question; `level` (0 and up) lengthens the board drill's lines. */
export function makeQuestion(kind: DrillKind, rng: Rng, level = 0): Question {
  const yesNo = (squares: string[], yes: boolean): Question => ({
    kind,
    squares,
    answer: yes ? 'yes' : 'no',
    options: ['yes', 'no'],
  });
  switch (kind) {
    case 'color': {
      const sq = randomSquare(rng);
      return { kind, squares: [sq], answer: squareColor(sq), options: ['light', 'dark'] };
    }
    case 'knight': {
      const from = randomSquare(rng);
      const reachable = knightMoves(from);
      if (rng() < 0.5) return yesNo([from, pick(rng, reachable)], true);
      let to = randomSquare(rng);
      // Near misses (one step off a real knight move) make the "no" answers honest.
      const near = pick(rng, reachable);
      const [nf, nr] = coords(near);
      const shifted = square(Math.min(7, Math.max(0, nf + pick(rng, [-1, 1]))), nr);
      if (rng() < 0.5) to = shifted;
      while (to === from || reachable.includes(to)) to = randomSquare(rng);
      return yesNo([from, to], false);
    }
    case 'bishop': {
      const a = randomSquare(rng);
      const [f, r] = coords(a);
      const diagonal: string[] = [];
      for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]])
        for (let k = 1; k < 8; k++) {
          const x = f + df * k;
          const y = r + dr * k;
          if (x < 0 || x > 7 || y < 0 || y > 7) break;
          diagonal.push(square(x, y));
        }
      if (rng() < 0.5) return yesNo([a, pick(rng, diagonal)], true);
      let b = randomSquare(rng);
      // Same-colour squares that are not on a shared diagonal are the tricky "no" cases.
      for (let i = 0; i < 20 && (b === a || sameDiagonal(a, b) || squareColor(a) !== squareColor(b)); i++) b = randomSquare(rng);
      while (b === a || sameDiagonal(a, b)) b = randomSquare(rng);
      return yesNo([a, b], false);
    }
    case 'board':
      return boardQuestion(rng, 4 + Math.min(level, 6) * 2);
  }
}

export interface RoundAnswer {
  correct: boolean;
  ms: number;
}

/** Fraction right, 0..1. */
export const accuracy = (r: Pick<DrillRun, 'correct' | 'total'>) => (r.total ? r.correct / r.total : 0);

/** Next difficulty of the board drill: a clean round (9+/10) lengthens the lines, a poor one (<6) shortens them. */
export function nextLevel(level: number, correct: number, total: number): number {
  if (!total) return level;
  const share = correct / total;
  return Math.max(0, Math.min(6, level + (share >= 0.9 ? 1 : share < 0.6 ? -1 : 0)));
}

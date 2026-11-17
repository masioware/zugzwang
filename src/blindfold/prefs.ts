import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Puzzle } from '../types';

/**
 * How much help the player gets:
 * - list: the board is hidden and the pieces are listed in text;
 * - peek: the board shows for a few seconds, then disappears;
 * - blind: the piece list shows for a while, then only the opponent's moves are given.
 */
export const BLINDFOLD_LEVELS = ['list', 'peek', 'blind'] as const;
export type BlindfoldLevel = (typeof BLINDFOLD_LEVELS)[number];

/** How long the board (peek) or the piece list (blind) stays on screen at the start of a puzzle. */
export const WINDOW_SECONDS: Record<'peek' | 'blind', number> = { peek: 5, blind: 20 };
export const MIN_RATING = 400;
export const MAX_RATING = 2400;
const START_RATING = 600;
const STEP = 50;
/** Longer lines are too much to hold in the head; the setup move plus this many plies at most. */
export const MAX_LINE = 4;

/** The rating of the next puzzle: up after a clean solve, down after a miss. */
export function nextRating(rating: number, solved: boolean): number {
  return Math.max(MIN_RATING, Math.min(MAX_RATING, rating + (solved ? STEP : -STEP)));
}

/** Short lines (setup move + at most MAX_LINE plies): the only ones worth playing blindfolded. */
export const isBlindfoldFriendly = (p: Pick<Puzzle, 'moves'>) => p.moves.length <= MAX_LINE + 1;

interface BlindfoldPrefs {
  level: BlindfoldLevel;
  setLevel: (level: BlindfoldLevel) => void;
  rating: number;
  setRating: (rating: number) => void;
  /** Read the opponent's moves aloud. */
  voice: boolean;
  setVoice: (voice: boolean) => void;
  /** Difficulty of the "what's on this square" drill (0 = short lines). */
  boardLevel: number;
  setBoardLevel: (level: number) => void;
}

export const useBlindfoldPrefs = create<BlindfoldPrefs>()(
  persist(
    (set) => ({
      level: 'list',
      setLevel: (level) => set({ level }),
      rating: START_RATING,
      setRating: (rating) => set({ rating }),
      voice: true,
      setVoice: (voice) => set({ voice }),
      boardLevel: 0,
      setBoardLevel: (boardLevel) => set({ boardLevel }),
    }),
    { name: 'zugzwang-blindfold' },
  ),
);

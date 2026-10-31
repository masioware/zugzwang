import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DIFFICULTIES = { easiest: -600, easier: -300, normal: 0, harder: 300, hardest: 600 } as const;
export type Difficulty = keyof typeof DIFFICULTIES;

interface PuzzlePrefs {
  /** Lichess theme key; '' for any. */
  theme: string;
  setTheme: (theme: string) => void;
  difficulty: Difficulty;
  setDifficulty: (difficulty: Difficulty) => void;
  rated: boolean;
  setRated: (rated: boolean) => void;
}

export const usePuzzlePrefs = create<PuzzlePrefs>()(
  persist(
    (set) => ({
      theme: '',
      setTheme: (theme) => set({ theme }),
      difficulty: 'normal',
      setDifficulty: (difficulty) => set({ difficulty }),
      rated: true,
      setRated: (rated) => set({ rated }),
    }),
    { name: 'zugzwang-puzzles' },
  ),
);

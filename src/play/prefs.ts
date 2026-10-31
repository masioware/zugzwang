import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Imitate } from './repertoire';

export type ColorChoice = 'white' | 'black' | 'random';

interface PlayPrefs {
  color: ColorChoice;
  imitate: Imitate;
  /** Opening name to follow, or '' to pick from the repertoire by frequency. */
  variation: string;
  /** The bot's opening moves come from opening theory (of the chosen opening) rather than the user's games. */
  theory: boolean;
  elo: number;
  set: (p: Partial<Omit<PlayPrefs, 'set'>>) => void;
}

/** The last bot setup, so "play again" and the next visit start from it. */
export const usePlayPrefs = create<PlayPrefs>()(
  persist(
    (set) => ({ color: 'white', imitate: 'opponents', variation: '', theory: false, elo: 1500, set: (p) => set(p) }),
    { name: 'zugzwang-play' },
  ),
);

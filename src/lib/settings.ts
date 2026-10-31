import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_DEPTH } from '../engine/gameAnalysis';
import { defaultWorkers } from '../engine/pool';

/** Built-in colour themes, or `local:<file>` for a board image in public/boards/local/. */
export type BoardTheme = string;

export const BOARD_THEMES: Record<string, { light: string; dark: string }> = {
  graphite: { light: '#dddbd3', dark: '#83868f' },
  green: { light: '#ebecd0', dark: '#739552' },
  brown: { light: '#f0d9b5', dark: '#b58863' },
  blue: { light: '#f0f1f0', dark: '#a7c4d8' },
};

/** Chess.com sets, bundled with permission; stored as lowercase PNGs (wp.png, bk.png, …). */
const PNG_SETS = ['icy_sea', 'neo', 'classic'];

export const DEFAULT_PIECE_SET = 'icy_sea';

export const PIECE_SETS = [...PNG_SETS, 'staunty', 'maestro', 'cburnett', 'merida', 'cardinal', 'tatiana'];
/** A bundled set name, or `local:<folder>` for a set in public/pieces/local/. */
export type PieceSet = string;

const PIECES = ['wP', 'wN', 'wB', 'wR', 'wQ', 'wK', 'bP', 'bN', 'bB', 'bR', 'bQ', 'bK'];

/**
 * Image URL of a piece ("wN", "bK", …). Lichess sets are SVGs; chess.com and local sets are
 * lowercase PNGs (wp.png, bk.png, …); local ones live in public/pieces/local/<folder>/.
 */
export function pieceUrl(set: PieceSet, piece: string): string {
  if (set.startsWith('local:')) return `/pieces/local/${set.slice(6)}/${piece.toLowerCase()}.png`;
  if (PNG_SETS.includes(set)) return `/pieces/${set}/${piece.toLowerCase()}.png`;
  if (PIECE_SETS.includes(set)) return `/pieces/${set}/${piece}.svg`;
  return pieceUrl(DEFAULT_PIECE_SET, piece);
}

export function boardImageUrl(theme: BoardTheme): string | undefined {
  return theme.startsWith('local:') ? `/boards/local/${theme.slice(6)}` : undefined;
}

export interface LocalAssets {
  pieces: string[];
  boards: string[];
}

let localAssets: Promise<LocalAssets> | null = null;

/** Sets and boards the user dropped into the git-ignored local folders. */
export function loadLocalAssets(): Promise<LocalAssets> {
  localAssets ??= fetch('/local-assets.json')
    .then((r) => (r.ok ? (r.json() as Promise<LocalAssets>) : { pieces: [], boards: [] }))
    .catch(() => ({ pieces: [], boards: [] }));
  return localAssets;
}

export { PIECES };

interface Settings {
  depth: number;
  setDepth: (depth: number) => void;
  /** Parallel Stockfish workers used for game analysis. */
  workers: number;
  setWorkers: (n: number) => void;
  boardTheme: BoardTheme;
  setBoardTheme: (theme: BoardTheme) => void;
  pieceSet: PieceSet;
  setPieceSet: (set: PieceSet) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      depth: DEFAULT_DEPTH,
      setDepth: (depth) => set({ depth }),
      workers: defaultWorkers(),
      setWorkers: (workers) => set({ workers }),
      boardTheme: 'graphite',
      setBoardTheme: (boardTheme) => set({ boardTheme }),
      pieceSet: DEFAULT_PIECE_SET,
      setPieceSet: (pieceSet) => set({ pieceSet }),
    }),
    {
      name: 'zugzwang-settings',
      version: 4,
      migrate: (state, version) => {
        const s = state as Partial<Settings>;
        // v0 kept the chess.com sets in the local folder ("local:neo"); they are bundled now.
        if (version < 1 && s.pieceSet?.startsWith('local:') && PNG_SETS.includes(s.pieceSet.slice(6)))
          s.pieceSet = s.pieceSet.slice(6);
        // v2 made icy_sea the default; move users still on an earlier default to it.
        if (version < 2 && (!s.pieceSet || s.pieceSet === 'staunty' || s.pieceSet === 'neo')) s.pieceSet = DEFAULT_PIECE_SET;
        // v3 removed the california and chessnut sets.
        if (version < 3 && (s.pieceSet === 'california' || s.pieceSet === 'chessnut')) s.pieceSet = DEFAULT_PIECE_SET;
        // v4 made graphite (matching the yellow-on-dark UI) the default board.
        if (version < 4 && (!s.boardTheme || s.boardTheme === 'green')) s.boardTheme = 'graphite';
        return s as Settings;
      },
    },
  ),
);

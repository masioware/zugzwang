import type { Game, Phase } from '../types';
import { replay } from '../lib/chess';
import { identifyOpening, openingFamily, type OpeningBook } from '../analysis/openings';
import { phaseOf } from '../analysis/phases';

/** Per-game facts derived by replaying the moves; independent of engine analysis. */
export interface GameFacts {
  /** Phase of the final position. */
  endPhase: Phase;
  /** The user's castling move, if any. */
  castle?: { ply: number; side: 'short' | 'long'; phase: Phase };
  /** Piece type ("p", "n", …) moved at each ply. */
  pieces: string[];
  /** Plies that stayed in the opening book. */
  bookPlies: number;
  /**
   * Whether the user played the first non-book move; null when the game never left the book.
   * `leftBookAtMove` is that move's full-move number.
   */
  userLeftBook: boolean | null;
  leftBookAtMove?: number;
  /** SAN moves up to the deepest named opening position, and up to the first position of its family. */
  openingLine: string[];
  familyLine: string[];
}

const cache = new Map<string, GameFacts>();

export function computeFacts(game: Game, book: OpeningBook): GameFacts {
  const plies = replay(game.moves);
  const fensAfter = plies.map((p) => p.fenAfter);
  const { bookPlies, name } = identifyOpening(fensAfter, book);
  const n = plies.length;

  // Deepest named position, and the first position already named after the same family.
  let openingPly = 0;
  let familyPly = 0;
  const family = openingFamily(name);
  for (let i = 0; i < bookPlies; i++) {
    const entry = book[fensAfter[i].split(' ').slice(0, 4).join(' ')];
    if (!entry) continue;
    openingPly = i + 1;
    if (!familyPly && openingFamily(entry[1]) === family) familyPly = i + 1;
  }

  let castle: GameFacts['castle'];
  plies.forEach((p, i) => {
    if (castle || p.color !== game.userColor || !p.san.startsWith('O-O')) return;
    castle = { ply: i, side: p.san.startsWith('O-O-O') ? 'long' : 'short', phase: phaseOf(p.fenBefore, i, i < bookPlies) };
  });

  const leftBook = bookPlies < n ? plies[bookPlies] : undefined;
  return {
    endPhase: n ? phaseOf(plies[n - 1].fenAfter, n, n <= bookPlies) : 'opening',
    castle,
    pieces: plies.map((p) => p.piece),
    bookPlies,
    userLeftBook: leftBook ? leftBook.color === game.userColor : null,
    leftBookAtMove: leftBook ? Math.floor(bookPlies / 2) + 1 : undefined,
    openingLine: game.moves.slice(0, openingPly),
    familyLine: game.moves.slice(0, familyPly || openingPly),
  };
}

/**
 * Facts for every game, computed once and cached by game id. Work is split into
 * chunks so large libraries don't freeze the page.
 */
export async function factsFor(games: Game[], book: OpeningBook): Promise<Map<string, GameFacts>> {
  const out = new Map<string, GameFacts>();
  let sinceYield = 0;
  for (const g of games) {
    let f = cache.get(g.id);
    if (!f) {
      f = computeFacts(g, book);
      cache.set(g.id, f);
      if (++sinceYield >= 40) {
        sinceYield = 0;
        await new Promise((r) => setTimeout(r));
      }
    }
    out.set(g.id, f);
  }
  return out;
}

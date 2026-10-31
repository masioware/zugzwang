// The user's opening repertoire, built from their games, for the bot to play from.
import { Chess } from 'chess.js';
import { positionKey } from '../lib/chess';
import type { Color, Game } from '../types';
import type { GameFacts } from '../stats/facts';

/** How deep into each game the repertoire goes, in plies. */
export const REPERTOIRE_PLIES = 30;

/** Who played a move in the user's games: the user, or the opponents they faced. */
export type Side = 'mine' | 'theirs';

export interface MoveCount {
  san: string;
  n: number;
}

/** Position key (FEN without the move counters, so transpositions meet) -> moves played there, by side. */
export type Repertoire = Map<string, Record<Side, MoveCount[]>>;

export function buildRepertoire(games: Pick<Game, 'moves' | 'userColor'>[], plies = REPERTOIRE_PLIES): Repertoire {
  const counts = new Map<string, Record<Side, Map<string, number>>>();
  for (const g of games) {
    // One FEN per ply (lib/chess's replay builds two): this runs over hundreds of games at once.
    const chess = new Chess();
    for (const played of g.moves.slice(0, plies)) {
      const key = positionKey(chess.fen());
      const side: Side = (chess.turn() === 'w' ? 'white' : 'black') === g.userColor ? 'mine' : 'theirs';
      let san: string;
      try {
        san = chess.move(played).san;
      } catch {
        break;
      }
      if (!counts.has(key)) counts.set(key, { mine: new Map(), theirs: new Map() });
      const m = counts.get(key)![side];
      m.set(san, (m.get(san) ?? 0) + 1);
    }
  }
  const out: Repertoire = new Map();
  for (const [key, bySide] of counts) {
    const sorted = (m: Map<string, number>) => [...m].map(([san, n]) => ({ san, n })).sort((a, b) => b.n - a.n);
    out.set(key, { mine: sorted(bySide.mine), theirs: sorted(bySide.theirs) });
  }
  return out;
}

/** Moves one side played in this position, most frequent first (empty when the repertoire has none). */
export function movesAt(rep: Repertoire, fen: string, side: Side): MoveCount[] {
  return rep.get(positionKey(fen))?.[side] ?? [];
}

/** Picks a move with probability proportional to how often it was played. `rand` is in [0, 1). */
export function weightedPick(moves: MoveCount[], rand = Math.random()): string | undefined {
  const total = moves.reduce((s, m) => s + m.n, 0);
  let r = rand * total;
  for (const m of moves) {
    r -= m.n;
    if (r < 0) return m.san;
  }
  return moves[moves.length - 1]?.san;
}

export interface Variation {
  /** Full opening name ("Sicilian Defense: Najdorf Variation"). */
  name: string;
  eco?: string;
  /** Games of the user's in this opening. */
  n: number;
  /** SAN moves leading to it: the most common line among those games. */
  line: string[];
}

/** The openings of the given games with how often each came up, most played first. */
export function variations(games: Game[], facts: Map<string, GameFacts>): Variation[] {
  const groups = new Map<string, { eco?: string; n: number; lines: Map<string, number> }>();
  for (const g of games) {
    const name = g.opening.name;
    const line = facts.get(g.id)?.openingLine;
    if (!name || !line?.length) continue;
    if (!groups.has(name)) groups.set(name, { eco: g.opening.eco, n: 0, lines: new Map() });
    const grp = groups.get(name)!;
    grp.n++;
    const k = line.join(' ');
    grp.lines.set(k, (grp.lines.get(k) ?? 0) + 1);
  }
  return [...groups]
    .map(([name, g]) => ({ name, eco: g.eco, n: g.n, line: [...g.lines].sort((a, b) => b[1] - a[1])[0][0].split(' ') }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

/** Who the bot imitates, and so which of the user's games feed it. */
export type Imitate = 'opponents' | 'me';

/** The colour the user's games must have been played with to feed the bot in this setup. */
export function sourceColor(userColor: Color, imitate: Imitate): Color {
  // Imitating the opponents: games where the user had this same colour. Imitating the user: games where
  // the user had the bot's colour.
  return imitate === 'opponents' ? userColor : userColor === 'white' ? 'black' : 'white';
}

/** Where a bot move came from. */
export type BookSource = 'line' | 'repertoire';

export interface BookMove {
  san: string;
  source: BookSource;
  /** For a repertoire move: how many of the games played it, out of `total` in this position. */
  n?: number;
  total?: number;
}

/**
 * The bot's move from the user's games, if there is one: the chosen line while the game still follows it,
 * else a move the imitated side played here, picked by frequency. Undefined means the engine takes over.
 */
export function bookMove(history: string[], fen: string, rep: Repertoire, side: Side, line?: string[], rand = Math.random()): BookMove | undefined {
  if (line && history.length < line.length && history.every((m, i) => m === line[i])) return { san: line[history.length], source: 'line' };
  if (history.length >= REPERTOIRE_PLIES) return undefined;
  const moves = movesAt(rep, fen, side);
  const san = weightedPick(moves, rand);
  if (!san) return undefined;
  return { san, source: 'repertoire', n: moves.find((m) => m.san === san)!.n, total: moves.reduce((s, m) => s + m.n, 0) };
}

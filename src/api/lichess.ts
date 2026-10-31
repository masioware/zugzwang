import type { Color, Game, Outcome, Termination, TimeClass } from '../types';
import { identifyOpening, type OpeningBook } from '../analysis/openings';
import { replay } from '../lib/chess';

export interface LichessPlayer {
  user?: { name: string; id: string };
  aiLevel?: number;
  rating?: number;
  analysis?: { accuracy?: number };
}

export interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: string;
  createdAt: number;
  lastMoveAt: number;
  status: string;
  players: { white: LichessPlayer; black: LichessPlayer };
  winner?: Color;
  opening?: { eco: string; name: string };
  moves: string;
  clocks?: number[];
  clock?: { initial: number; increment: number };
  daysPerTurn?: number;
  pgn?: string;
}

/** Streams the user's games (newest first) as NDJSON, calling onGame for each. */
export async function streamGames(
  username: string,
  opts: { since?: number; max?: number; signal?: AbortSignal },
  onGame: (g: LichessGame) => void,
): Promise<void> {
  const params = new URLSearchParams({
    pgnInJson: 'true',
    opening: 'true',
    clocks: 'true',
    accuracy: 'true',
    finished: 'true',
  });
  if (opts.since) params.set('since', String(opts.since));
  if (opts.max) params.set('max', String(opts.max));
  const res = await fetch(
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`,
    { headers: { Accept: 'application/x-ndjson' }, signal: opts.signal },
  );
  if (res.status === 404) throw new Error('userNotFound');
  if (res.status === 429) throw new Error('rateLimited');
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const line of lines) if (line.trim()) onGame(JSON.parse(line));
  }
  if (buffer.trim()) onGame(JSON.parse(buffer));
}

const TERMINATIONS: Record<string, Termination> = {
  mate: 'checkmate',
  resign: 'resignation',
  outoftime: 'timeout',
  timeout: 'abandoned',
  stalemate: 'stalemate',
  draw: 'agreement',
};

function timeClassOf(speed: string): TimeClass {
  if (speed === 'ultraBullet' || speed === 'bullet') return 'bullet';
  if (speed === 'blitz' || speed === 'rapid' || speed === 'classical') return speed;
  return 'daily';
}

function playerName(p: LichessPlayer): string {
  return p.user?.name ?? (p.aiLevel ? `Stockfish level ${p.aiLevel}` : 'Anonymous');
}

export function normalizeLichess(g: LichessGame, username: string, book?: OpeningBook): Game | null {
  if (g.variant !== 'standard' || !g.moves) return null;
  if (['aborted', 'noStart', 'created', 'started', 'unknownFinish'].includes(g.status)) return null;
  const userColor: Color =
    g.players.white.user?.id === username.toLowerCase() ? 'white' : 'black';
  const outcome: Outcome = !g.winner ? 'draw' : g.winner === userColor ? 'win' : 'loss';

  let termination = TERMINATIONS[g.status] ?? 'other';
  if (g.status === 'outoftime' && !g.winner) termination = 'timeVsInsufficient';

  const moves = g.moves.split(' ');
  const plies = replay(moves);
  const opening = book ? identifyOpening(plies.map((p) => p.fenAfter), book) : undefined;
  if (g.status === 'draw' && g.pgn?.includes('threefold')) termination = 'repetition';

  return {
    id: `lichess:${g.id}`,
    source: 'lichess',
    accountId: `lichess:${username.toLowerCase()}`,
    url: `https://lichess.org/${g.id}${userColor === 'black' ? '/black' : ''}`,
    pgn: g.pgn ?? '',
    moves,
    white: { name: playerName(g.players.white), rating: g.players.white.rating },
    black: { name: playerName(g.players.black), rating: g.players.black.rating },
    userColor,
    outcome,
    termination,
    timeClass: timeClassOf(g.speed),
    timeControl: g.clock ? `${g.clock.initial}+${g.clock.increment}` : `1/${(g.daysPerTurn ?? 1) * 86400}`,
    initialTime: g.clock?.initial,
    endTime: g.lastMoveAt,
    rated: g.rated,
    opening: { eco: opening?.eco ?? g.opening?.eco, name: opening?.name ?? g.opening?.name },
    clocks: normalizeClocks(g.clocks, moves.length),
    platformAccuracy: {
      white: g.players.white.analysis?.accuracy,
      black: g.players.black.analysis?.accuracy,
    },
  };
}

/** Lichess clocks are centiseconds; some exports include the initial clock as an extra entry. */
function normalizeClocks(clocks: number[] | undefined, plies: number): number[] | undefined {
  if (!clocks?.length) return undefined;
  const c = clocks.length === plies + 1 ? clocks.slice(1) : clocks;
  return c.length === plies ? c.map((x) => x / 100) : undefined;
}

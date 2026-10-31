import type { Color, Game, Outcome, Termination, TimeClass } from '../types';
import { parsePgn } from '../lib/chess';
import { identifyOpening, type OpeningBook } from '../analysis/openings';
import { replay } from '../lib/chess';

const BASE = 'https://api.chess.com/pub/player';

export interface ChessComPlayer {
  username: string;
  rating: number;
  result: string;
}

export interface ChessComGame {
  url: string;
  pgn?: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  uuid?: string;
  time_class: string;
  rules: string;
  initial_setup?: string;
  accuracies?: { white?: number; black?: number };
  white: ChessComPlayer;
  black: ChessComPlayer;
}

const STANDARD_SETUP = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (res.status === 404) throw new Error('userNotFound');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchArchives(username: string, signal?: AbortSignal): Promise<string[]> {
  const data = await getJson<{ archives: string[] }>(
    `${BASE}/${encodeURIComponent(username.toLowerCase())}/games/archives`,
    signal,
  );
  return data.archives;
}

export async function fetchMonth(archiveUrl: string, signal?: AbortSignal): Promise<ChessComGame[]> {
  const data = await getJson<{ games: ChessComGame[] }>(archiveUrl, signal);
  return data.games;
}

/** "YYYY/MM" at the end of an archive URL -> timestamp of the first day of that month. */
export function archiveMonthStart(url: string): number {
  const m = url.match(/(\d{4})\/(\d{2})$/);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, 1) : 0;
}

const DRAW_RESULTS: Record<string, Termination> = {
  agreed: 'agreement',
  repetition: 'repetition',
  stalemate: 'stalemate',
  insufficient: 'insufficient',
  '50move': 'fiftyMove',
  timevsinsufficient: 'timeVsInsufficient',
};

const LOSS_RESULTS: Record<string, Termination> = {
  checkmated: 'checkmate',
  resigned: 'resignation',
  timeout: 'timeout',
  abandoned: 'abandoned',
};

function timeClassOf(tc: string): TimeClass {
  if (tc === 'bullet' || tc === 'blitz' || tc === 'rapid' || tc === 'daily') return tc;
  return 'classical';
}

export function normalizeChessCom(
  g: ChessComGame,
  username: string,
  book?: OpeningBook,
): Game | null {
  if (g.rules !== 'chess' || !g.pgn) return null;
  if (g.initial_setup && g.initial_setup !== STANDARD_SETUP) return null;
  const userColor: Color = g.white.username.toLowerCase() === username.toLowerCase() ? 'white' : 'black';
  const me = g[userColor];
  const opp = g[userColor === 'white' ? 'black' : 'white'];

  let outcome: Outcome;
  let termination: Termination;
  if (me.result === 'win') {
    outcome = 'win';
    termination = LOSS_RESULTS[opp.result] ?? 'other';
  } else if (me.result in DRAW_RESULTS) {
    outcome = 'draw';
    termination = DRAW_RESULTS[me.result];
  } else {
    outcome = opp.result === 'win' ? 'loss' : 'draw';
    termination = LOSS_RESULTS[me.result] ?? DRAW_RESULTS[me.result] ?? 'other';
  }

  const { moves, clocks } = parsePgn(g.pgn);
  const opening = book ? identifyOpening(replay(moves).map((p) => p.fenAfter), book) : undefined;
  const ecoHeader = g.pgn.match(/\[ECO "([^"]+)"\]/)?.[1];
  const nativeId = g.uuid ?? g.url.split('/').pop()!;
  const initial = Number(g.time_control.split(/[+/]/)[0]);

  return {
    id: `chesscom:${nativeId}`,
    source: 'chesscom',
    accountId: `chesscom:${username.toLowerCase()}`,
    url: g.url,
    pgn: g.pgn,
    moves,
    white: { name: g.white.username, rating: g.white.rating },
    black: { name: g.black.username, rating: g.black.rating },
    userColor,
    outcome,
    termination,
    timeClass: timeClassOf(g.time_class),
    timeControl: g.time_control,
    initialTime: g.time_class === 'daily' || !Number.isFinite(initial) ? undefined : initial,
    endTime: g.end_time * 1000,
    rated: g.rated,
    opening: { eco: opening?.eco ?? ecoHeader, name: opening?.name },
    clocks: clocks.length ? clocks : undefined,
    platformAccuracy: g.accuracies,
  };
}

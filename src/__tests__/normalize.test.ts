import { describe, expect, it } from 'vitest';
import { normalizeChessCom, type ChessComGame } from '../api/chesscom';
import { normalizeLichess, type LichessGame } from '../api/lichess';
import { parsePgn } from '../lib/chess';

const PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[White "Alice"]
[Black "bob"]
[Result "0-1"]
[ECO "C20"]

1. f3 {[%clk 0:02:59.9]} 1... e5 {[%clk 0:02:59.1]} 2. g4 {[%clk 0:02:58]} 2... Qh4# {[%clk 0:02:57.5]} 0-1`;

const chesscomGame: ChessComGame = {
  url: 'https://www.chess.com/game/live/123',
  pgn: PGN,
  time_control: '180',
  end_time: 1_700_000_000,
  rated: true,
  uuid: 'abc',
  time_class: 'blitz',
  rules: 'chess',
  accuracies: { white: 10.5, black: 99.1 },
  white: { username: 'Alice', rating: 1500, result: 'checkmated' },
  black: { username: 'bob', rating: 1520, result: 'win' },
};

describe('parsePgn', () => {
  it('extracts moves and clocks', () => {
    const { moves, clocks } = parsePgn(PGN);
    expect(moves).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
    expect(clocks).toEqual([179.9, 179.1, 178, 177.5]);
  });
});

describe('normalizeChessCom', () => {
  it('converts a game from the user perspective', () => {
    const g = normalizeChessCom(chesscomGame, 'alice')!;
    expect(g.id).toBe('chesscom:abc');
    expect(g.userColor).toBe('white');
    expect(g.outcome).toBe('loss');
    expect(g.termination).toBe('checkmate');
    expect(g.timeClass).toBe('blitz');
    expect(g.initialTime).toBe(180);
    expect(g.endTime).toBe(1_700_000_000_000);
    expect(g.opening.eco).toBe('C20');
    expect(g.platformAccuracy?.black).toBe(99.1);
  });
  it('maps draws and wins', () => {
    const draw = normalizeChessCom(
      { ...chesscomGame, white: { ...chesscomGame.white, result: 'repetition' }, black: { ...chesscomGame.black, result: 'repetition' } },
      'bob',
    )!;
    expect(draw.outcome).toBe('draw');
    expect(draw.termination).toBe('repetition');
    expect(normalizeChessCom(chesscomGame, 'BOB')!.outcome).toBe('win');
  });
  it('skips variants', () => {
    expect(normalizeChessCom({ ...chesscomGame, rules: 'chess960' }, 'alice')).toBeNull();
  });
});

describe('normalizeLichess', () => {
  const game: LichessGame = {
    id: 'xyz12345',
    rated: true,
    variant: 'standard',
    speed: 'rapid',
    createdAt: 1,
    lastMoveAt: 2,
    status: 'resign',
    players: {
      white: { user: { name: 'Carol', id: 'carol' }, rating: 1800, analysis: { accuracy: 88 } },
      black: { user: { name: 'Dave', id: 'dave' }, rating: 1750 },
    },
    winner: 'white',
    opening: { eco: 'C20', name: "King's Pawn Game" },
    moves: 'e4 e5 Qh5 Nc6',
    clocks: [60000, 60000, 59000, 58000],
    clock: { initial: 600, increment: 5 },
  };
  it('converts a game from the user perspective', () => {
    const g = normalizeLichess(game, 'Dave')!;
    expect(g.userColor).toBe('black');
    expect(g.outcome).toBe('loss');
    expect(g.termination).toBe('resignation');
    expect(g.timeControl).toBe('600+5');
    expect(g.clocks).toEqual([600, 600, 590, 580]);
    expect(g.opening.name).toBe("King's Pawn Game");
    expect(g.url).toBe('https://lichess.org/xyz12345/black');
  });
  it('skips aborted games and variants', () => {
    expect(normalizeLichess({ ...game, status: 'aborted' }, 'dave')).toBeNull();
    expect(normalizeLichess({ ...game, variant: 'chess960' }, 'dave')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { gamesAgainst, groupFriends, headToHead } from '../stats/headToHead';
import { platformGameId } from '../api/importer';
import type { Account, Game, GameAnalysis } from '../types';

const base: Game = {
  id: 'lichess:g1',
  source: 'lichess',
  accountId: 'lichess:me',
  url: '',
  pgn: '',
  moves: [],
  white: { name: 'me' },
  black: { name: 'Bob' },
  userColor: 'white',
  outcome: 'win',
  termination: 'checkmate',
  timeClass: 'blitz',
  timeControl: '180+0',
  endTime: Date.UTC(2026, 0, 1),
  rated: true,
  opening: {},
};

const accounts: Account[] = [
  { id: 'lichess:me', source: 'lichess', username: 'me' },
  { id: 'lichess:bob', source: 'lichess', username: 'bob', friend: 'Bob' },
  { id: 'chesscom:bobby', source: 'chesscom', username: 'Bobby', friend: 'Bob' },
  { id: 'chesscom:ann', source: 'chesscom', username: 'ann', friend: 'Ann' },
];

const games: Game[] = [
  base,
  { ...base, id: 'lichess:g2', outcome: 'loss', userColor: 'black', white: { name: 'bob' }, black: { name: 'me' }, endTime: Date.UTC(2026, 0, 5) },
  { ...base, id: 'chesscom:g3', source: 'chesscom', outcome: 'draw', black: { name: 'bobby' } },
  // Same name on the other platform is someone else.
  { ...base, id: 'chesscom:g4', source: 'chesscom', black: { name: 'bob' } },
  { ...base, id: 'lichess:g5', black: { name: 'carol' } },
];

const analysis = (gameId: string, white: number, black: number) =>
  ({ gameId, accuracy: { white, black }, moves: [] }) as unknown as GameAnalysis;

describe('head to head', () => {
  it('groups friends and ignores own accounts', () => {
    const friends = groupFriends(accounts);
    expect([...friends.keys()]).toEqual(['Ann', 'Bob']);
    expect(friends.get('Bob')!.map((a) => a.id)).toEqual(['lichess:bob', 'chesscom:bobby']);
  });

  it('matches opponents by platform and username', () => {
    const vsBob = gamesAgainst(games, groupFriends(accounts).get('Bob')!);
    expect(vsBob.map((g) => g.id)).toEqual(['lichess:g1', 'lichess:g2', 'chesscom:g3']);
  });

  it('summarizes results and accuracy from the user side', () => {
    const vsBob = gamesAgainst(games, groupFriends(accounts).get('Bob')!);
    const analyses = new Map([
      ['lichess:g1', analysis('lichess:g1', 90, 70)],
      ['lichess:g2', analysis('lichess:g2', 85, 75)],
    ]);
    const h = headToHead(vsBob, analyses);
    expect(h.wdl).toEqual({ games: 3, win: 1, draw: 1, loss: 1 });
    expect(h.analysedCount).toBe(2);
    expect(h.accuracy!.me).toBeCloseTo(82.5);
    expect(h.accuracy!.friend).toBeCloseTo(77.5);
    expect([h.moreAccurate, h.lessAccurate]).toEqual([1, 1]);
    expect(h.lastPlayed).toBe(Date.UTC(2026, 0, 5));
  });

  it('strips the account suffix of friends’ game copies', () => {
    expect(platformGameId('chesscom:abc@chesscom:bob')).toBe('chesscom:abc');
    expect(platformGameId('lichess:xyz')).toBe('lichess:xyz');
  });
});

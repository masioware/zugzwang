import type { Account, Game, GameAnalysis } from '../types';
import { analysed, opponent, summarize, type WDL } from './aggregate';

/** Friends' accounts grouped by friend name, names sorted. */
export function groupFriends(accounts: Account[]): Map<string, Account[]> {
  const map = new Map<string, Account[]>();
  for (const a of accounts) {
    if (!a.friend) continue;
    if (!map.has(a.friend)) map.set(a.friend, []);
    map.get(a.friend)!.push(a);
  }
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

/** The user's games whose opponent plays on one of the given accounts. */
export function gamesAgainst(games: Game[], accounts: Account[]): Game[] {
  const keys = new Set(accounts.map((a) => `${a.source}:${a.username.toLowerCase()}`));
  return games.filter((g) => keys.has(`${g.source}:${opponent(g).name.toLowerCase()}`));
}

export interface HeadToHead {
  /** From the user's point of view. */
  wdl: WDL;
  analysedCount: number;
  /** Average accuracy of each side over the analysed games. */
  accuracy?: { me: number; friend: number };
  /** Analysed games where the user was more / less accurate than the friend. */
  moreAccurate: number;
  lessAccurate: number;
  lastPlayed?: number;
}

export function headToHead(games: Game[], analyses: Map<string, GameAnalysis>): HeadToHead {
  const list = analysed(games, analyses);
  let me = 0;
  let friend = 0;
  let moreAccurate = 0;
  let lessAccurate = 0;
  for (const { game, analysis } of list) {
    const mine = analysis.accuracy[game.userColor];
    const theirs = analysis.accuracy[game.userColor === 'white' ? 'black' : 'white'];
    me += mine;
    friend += theirs;
    if (mine > theirs) moreAccurate++;
    else if (mine < theirs) lessAccurate++;
  }
  return {
    wdl: summarize(games),
    analysedCount: list.length,
    accuracy: list.length ? { me: me / list.length, friend: friend / list.length } : undefined,
    moreAccurate,
    lessAccurate,
    lastPlayed: games.length ? Math.max(...games.map((g) => g.endTime)) : undefined,
  };
}

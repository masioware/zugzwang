import { db } from '../db';
import type { Account, Game, Source } from '../types';
import { loadOpeningBook } from '../analysis/openings';
import { archiveMonthStart, fetchArchives, fetchMonth, normalizeChessCom } from './chesscom';
import { normalizeLichess, streamGames } from './lichess';

export interface ImportProgress {
  imported: number;
  step?: string;
}

/** Id of the game on its platform, shared by the copies imported for different accounts. */
export function platformGameId(gameId: string): string {
  return gameId.split('@')[0];
}

/**
 * Fetches games for an account. On the first sync, goes back `months` months;
 * afterwards only fetches games newer than the most recent one stored.
 * `friend` files the account under that friend instead of the user's own accounts.
 */
export async function syncAccount(
  source: Source,
  username: string,
  months: number,
  friend: string | undefined,
  onProgress: (p: ImportProgress) => void,
  signal?: AbortSignal,
): Promise<number> {
  const accountId = `${source}:${username.toLowerCase()}`;
  const existing = await db.accounts.get(accountId);
  if (existing && existing.friend !== friend) throw new Error('accountTaken');
  const book = await loadOpeningBook();
  const latest = await db.games.where('accountId').equals(accountId).reverse().sortBy('endTime');
  const newest = latest[0]?.endTime;
  const since = newest ? newest + 1 : monthsAgo(months);
  let imported = 0;
  const saved: string[] = [];

  const save = async (games: Game[]) => {
    if (!games.length) return;
    // A game against a friend is imported for both sides; keep the friend's copy apart from the user's.
    if (friend) games = games.map((g) => ({ ...g, id: `${g.id}@${accountId}` }));
    await db.games.bulkPut(games);
    saved.push(...games.map((g) => g.id));
    imported += games.length;
    onProgress({ imported });
  };

  try {
    await fetchAll();
  } catch (e) {
    // Games arrive newest first and the next sync resumes after the newest one stored, so a partial
    // run would leave a permanent gap. Drop what this run saved (cancelled or failed alike).
    await db.transaction('rw', db.games, db.analyses, db.analysisLines, async () => {
      await db.analyses.bulkDelete(saved);
      await db.analysisLines.bulkDelete(saved);
      await db.games.bulkDelete(saved);
    });
    throw e;
  }

  const account: Account = { id: accountId, source, username, lastSync: Date.now(), friend };
  await db.accounts.put({ ...existing, ...account, username: existing?.username ?? username });
  return imported;

  async function fetchAll() {
    if (source === 'chesscom') {
      const archives = (await fetchArchives(username, signal))
        .filter((url) => archiveMonthStart(url) >= firstOfMonth(since))
        .reverse();
      for (const url of archives) {
        onProgress({ imported, step: url.slice(-7) });
        const games = (await fetchMonth(url, signal))
          .filter((g) => g.end_time * 1000 >= since)
          .map((g) => normalizeChessCom(g, username, book))
          .filter((g): g is Game => !!g);
        await save(games);
      }
    } else {
      let batch: Game[] = [];
      const pending: Promise<void>[] = [];
      try {
        await streamGames(username, { since, signal }, (raw) => {
          const g = normalizeLichess(raw, username, book);
          if (g) batch.push(g);
          if (batch.length >= 50) {
            pending.push(save(batch));
            batch = [];
          }
        });
        pending.push(save(batch));
      } finally {
        // Let in-flight writes land before a rollback looks at what was saved.
        await Promise.allSettled(pending);
      }
      await Promise.all(pending);
    }
  }
}

export async function removeAccount(accountId: string): Promise<void> {
  await db.transaction('rw', db.accounts, db.games, db.analyses, db.analysisLines, async () => {
    const ids = await db.games.where('accountId').equals(accountId).primaryKeys();
    await db.analyses.bulkDelete(ids);
    await db.analysisLines.bulkDelete(ids);
    await db.games.bulkDelete(ids);
    await db.accounts.delete(accountId);
  });
}

function monthsAgo(months: number): number {
  if (months <= 0) return 0;
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.getTime();
}

function firstOfMonth(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

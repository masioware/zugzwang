import Dexie, { type EntityTable } from 'dexie';
import type { Account, AnalysisLines, Game, GameAnalysis, Puzzle, PuzzleAttempt, WoodpeckerCycle, WoodpeckerSet } from '../types';
import type { StoredFacts } from '../stats/facts';
import { puzzleFacts } from '../puzzles/solve';

export const db = new Dexie('zugzwang') as Dexie & {
  accounts: EntityTable<Account, 'id'>;
  games: EntityTable<Game, 'id'>;
  analyses: EntityTable<GameAnalysis, 'gameId'>;
  analysisLines: EntityTable<AnalysisLines, 'gameId'>;
  puzzles: EntityTable<Puzzle, 'id'>;
  puzzleAttempts: EntityTable<PuzzleAttempt, 'id'>;
  woodpeckerSets: EntityTable<WoodpeckerSet, 'id'>;
  woodpeckerCycles: EntityTable<WoodpeckerCycle, 'id'>;
  /** Replay-derived facts per game (see stats/factsStore); a cache that can be dropped at any time. */
  facts: EntityTable<StoredFacts, 'gameId'>;
};

db.version(1).stores({
  accounts: 'id',
  games: 'id, accountId, endTime',
  analyses: 'gameId',
});

db.version(2).stores({
  puzzles: 'id, addedAt',
  puzzleAttempts: '++id, puzzleId, startedAt, mode',
});

db.version(3)
  .stores({
    puzzleAttempts: '++id, puzzleId, startedAt, mode, setId, cycleId',
    woodpeckerSets: 'id, createdAt',
    woodpeckerCycles: '++id, setId, [setId+index]',
  })
  .upgrade(async (tx) => {
    // Attempts from v2 lack the puzzle facts that statistics group by.
    const puzzles = new Map((await tx.table<Puzzle>('puzzles').toArray()).map((p) => [p.id, p]));
    await tx
      .table<PuzzleAttempt>('puzzleAttempts')
      .toCollection()
      .modify((a) => {
        const p = puzzles.get(a.puzzleId);
        if (p && !a.themes) Object.assign(a, puzzleFacts(p));
      });
  });

db.version(4).stores({
  facts: 'gameId',
});

db.version(5)
  .stores({
    // createdAt lets lists pick up new and re-done analyses without re-reading them all (see analysesCache).
    analyses: 'gameId, createdAt',
    analysisLines: 'gameId',
  })
  .upgrade(async (tx) => {
    // Engine lines move out of the analyses into their own table.
    const rows = await tx.table<GameAnalysis & { positions?: AnalysisLines['positions'] }>('analyses').toArray();
    await tx.table<AnalysisLines>('analysisLines').bulkPut(rows.filter((r) => r.positions).map((r) => ({ gameId: r.gameId, positions: r.positions! })));
    await tx
      .table('analyses')
      .toCollection()
      .modify((a: { positions?: unknown }) => {
        delete a.positions;
      });
  });

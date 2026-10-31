import Dexie, { type EntityTable } from 'dexie';
import type { Account, Game, GameAnalysis, Puzzle, PuzzleAttempt, WoodpeckerCycle, WoodpeckerSet } from '../types';
import { puzzleFacts } from '../puzzles/solve';

export const db = new Dexie('zugzwang') as Dexie & {
  accounts: EntityTable<Account, 'id'>;
  games: EntityTable<Game, 'id'>;
  analyses: EntityTable<GameAnalysis, 'gameId'>;
  puzzles: EntityTable<Puzzle, 'id'>;
  puzzleAttempts: EntityTable<PuzzleAttempt, 'id'>;
  woodpeckerSets: EntityTable<WoodpeckerSet, 'id'>;
  woodpeckerCycles: EntityTable<WoodpeckerCycle, 'id'>;
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

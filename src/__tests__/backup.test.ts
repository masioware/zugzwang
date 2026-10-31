import { describe, expect, it } from 'vitest';
import { gzip, parseBackup, readBackupFile, serializeBackup, splitLegacyLines, type BackupData } from '../db/backup';

const data: BackupData = {
  dbVersion: 3,
  exportedAt: 1_700_000_000_000,
  tables: {
    games: [{ id: 'lichess:abc', moves: ['e4', 'e5'], note: 'line\nbreak' }],
    puzzleAttempts: [{ id: 1, puzzleId: 'x' }, { id: 2, puzzleId: 'y' }],
  },
  local: { 'zugzwang-settings': '{"state":{"depth":16}}' },
};

describe('backup', () => {
  it('round-trips through the text format', () => {
    expect(parseBackup(serializeBackup(data).join(''))).toEqual(data);
  });

  it('round-trips through gzip, and still reads plain text', async () => {
    const lines = serializeBackup(data);
    expect(parseBackup(await readBackupFile(await gzip(lines)))).toEqual(data);
    expect(parseBackup(await readBackupFile(new Blob(lines)))).toEqual(data);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('')).toThrow('invalidBackup');
    expect(() => parseBackup('{"format":"other","dbVersion":1}')).toThrow('invalidBackup');
    expect(() => parseBackup('[1,2,3]')).toThrow('invalidBackup');
    expect(() => parseBackup(serializeBackup(data)[0] + 'not json\n')).toThrow('invalidBackup');
  });

  it('moves engine lines out of analyses from pre-v5 backups', () => {
    const old: BackupData = {
      dbVersion: 4,
      exportedAt: 0,
      tables: { analyses: [{ gameId: 'g1', moves: [], positions: [[{ cp: 10, pv: ['e2e4'], depth: 10 }]] }, { gameId: 'g2', moves: [] }] },
      local: {},
    };
    splitLegacyLines(old);
    expect(old.tables.analyses).toEqual([{ gameId: 'g1', moves: [] }, { gameId: 'g2', moves: [] }]);
    expect(old.tables.analysisLines).toEqual([{ gameId: 'g1', positions: [[{ cp: 10, pv: ['e2e4'], depth: 10 }]] }]);
    // A current backup is left alone.
    const current: BackupData = { dbVersion: 5, exportedAt: 0, tables: { analyses: [{ gameId: 'g3', moves: [] }] }, local: {} };
    splitLegacyLines(current);
    expect(current.tables.analysisLines).toBeUndefined();
  });
});

import { db } from './index';

/**
 * Backup file: gzipped NDJSON. The first line is the header; every other line is `[table, row]`,
 * with the persisted preferences (localStorage) under the pseudo-table `$local`.
 */
const FORMAT = 'zugzwang-backup';
const LOCAL = '$local';

/** Preferences kept in localStorage: settings, filters, puzzle prefs, language. */
const isOwnKey = (k: string) => k.startsWith('zugzwang') || k === 'i18nextLng';

/** Derived caches, rebuilt on demand: left out of backups (and emptied by a restore). */
const DERIVED = new Set(['facts']);

export interface BackupData {
  dbVersion: number;
  exportedAt: number;
  tables: Record<string, unknown[]>;
  local: Record<string, string>;
}

export function serializeBackup(data: BackupData): string[] {
  const lines = [JSON.stringify({ format: FORMAT, dbVersion: data.dbVersion, exportedAt: data.exportedAt }) + '\n'];
  for (const [table, rows] of Object.entries(data.tables)) for (const row of rows) lines.push(JSON.stringify([table, row]) + '\n');
  for (const [k, v] of Object.entries(data.local)) lines.push(JSON.stringify([LOCAL, { k, v }]) + '\n');
  return lines;
}

/** Throws `invalidBackup` when the text isn't a backup made by this app. */
export function parseBackup(text: string): BackupData {
  const lines = text.split('\n').filter((l) => l.trim());
  let header: { format?: string; dbVersion?: number; exportedAt?: number };
  try {
    header = JSON.parse(lines[0] ?? '');
  } catch {
    throw new Error('invalidBackup');
  }
  if (header?.format !== FORMAT || typeof header.dbVersion !== 'number') throw new Error('invalidBackup');
  const data: BackupData = { dbVersion: header.dbVersion, exportedAt: header.exportedAt ?? 0, tables: {}, local: {} };
  for (const line of lines.slice(1)) {
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      throw new Error('invalidBackup');
    }
    if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1] !== 'object' || !entry[1]) throw new Error('invalidBackup');
    const [table, row] = entry as [string, Record<string, unknown>];
    if (table === LOCAL) {
      if (typeof row.k === 'string' && typeof row.v === 'string') data.local[row.k] = row.v;
    } else (data.tables[table] ??= []).push(row);
  }
  return data;
}

export async function gzip(parts: string[]): Promise<Blob> {
  const stream = new Blob(parts).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

/** Text of a backup file, gzipped or not. */
export async function readBackupFile(file: Blob): Promise<string> {
  const magic = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (magic[0] !== 0x1f || magic[1] !== 0x8b) return file.text();
  return new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

/** Everything the app stores in this browser, as a gzipped backup file. */
export async function exportBackup(): Promise<Blob> {
  const tables: BackupData['tables'] = {};
  for (const t of db.tables) if (!DERIVED.has(t.name)) tables[t.name] = await t.toArray();
  const local: BackupData['local'] = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (isOwnKey(k)) local[k] = localStorage.getItem(k)!;
  }
  return gzip(serializeBackup({ dbVersion: db.verno, exportedAt: Date.now(), tables, local }));
}

/**
 * Replaces all data with the backup's. Nothing changes if the file is invalid or from a newer version.
 * The page must reload afterwards so the in-memory stores pick up the restored preferences.
 */
export async function restoreBackup(file: Blob): Promise<Record<string, number>> {
  const data = parseBackup(await readBackupFile(file));
  if (data.dbVersion > db.verno) throw new Error('newerBackup');
  splitLegacyLines(data);
  const counts: Record<string, number> = {};
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear();
      const rows = data.tables[t.name] ?? [];
      await t.bulkAdd(rows);
      counts[t.name] = rows.length;
    }
  });
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)!;
    if (isOwnKey(k)) localStorage.removeItem(k);
  }
  for (const [k, v] of Object.entries(data.local)) if (isOwnKey(k)) localStorage.setItem(k, v);
  return counts;
}

/** Backups from before database v5 keep the engine lines inside each analysis: move them to their own table. */
export function splitLegacyLines(data: BackupData): void {
  const analyses = (data.tables.analyses ?? []) as { gameId: string; positions?: unknown }[];
  if (!analyses.some((a) => a.positions)) return;
  data.tables.analysisLines = [
    ...(data.tables.analysisLines ?? []),
    ...analyses.filter((a) => a.positions).map((a) => ({ gameId: a.gameId, positions: a.positions })),
  ];
  data.tables.analyses = analyses.map(({ positions: _lines, ...rest }) => rest);
}

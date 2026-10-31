import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportBackup, restoreBackup } from '../db/backup';
import { useSync } from '../api/sync';
import { useAnalysisQueue } from '../engine/queue';

/** Export everything to a file, or replace everything with a file exported before. */
export default function BackupPanel() {
  const { t } = useTranslation();
  const syncing = !!useSync((s) => s.busy);
  const cancelAnalysis = useAnalysisQueue((s) => s.cancelAll);
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function download() {
    setBusy('export');
    setMessage(null);
    try {
      const blob = await exportBackup();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `zugzwang-backup-${new Date().toISOString().slice(0, 10)}.json.gz`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      setMessage({ kind: 'ok', text: t('backup.exported', { size: formatSize(blob.size) }) });
    } catch (e) {
      setMessage({ kind: 'error', text: t('backup.error', { message: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setBusy(null);
    }
  }

  async function restore(file: File) {
    if (!confirm(t('backup.restoreConfirm'))) return;
    setBusy('import');
    setMessage(null);
    cancelAnalysis();
    try {
      const counts = await restoreBackup(file);
      setMessage({ kind: 'ok', text: t('backup.restored', { games: counts.games ?? 0, analyses: counts.analyses ?? 0 }) });
      // Stores already in memory (settings, filters, queries) must start over from the restored data.
      setTimeout(() => location.reload(), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessage({
        kind: 'error',
        text: msg === 'invalidBackup' || msg === 'newerBackup' ? t(`backup.${msg}`) : t('backup.error', { message: msg }),
      });
      setBusy(null);
    }
  }

  return (
    <section className="panel space-y-3 p-5">
      <div>
        <h2 className="text-lg font-semibold">{t('backup.title')}</h2>
        <p className="text-sm text-ink-3">{t('backup.hint')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost border border-line" disabled={!!busy} onClick={() => void download()}>
          {busy === 'export' ? t('backup.exporting') : t('backup.export')}
        </button>
        <button
          className="btn-ghost border border-line"
          disabled={!!busy || syncing}
          title={syncing ? t('backup.waitSync') : undefined}
          onClick={() => input.current?.click()}
        >
          {busy === 'import' ? t('backup.restoring') : t('backup.import')}
        </button>
        <input
          ref={input}
          type="file"
          accept=".gz,.json,application/gzip,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void restore(file);
          }}
        />
      </div>
      {message && (
        <p className={`text-sm ${message.kind === 'ok' ? 'text-good' : 'text-loss'}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

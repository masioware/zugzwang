import { useTranslation } from 'react-i18next';
import { useSync } from '../api/sync';

/** Header note while an import runs, so a background sync is visible (and stoppable) from any page. */
export default function SyncIndicator() {
  const { t } = useTranslation();
  const { busyName, progress, cancel } = useSync();
  if (!busyName) return null;
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/[0.04] py-1 pr-1 pl-2.5 text-xs text-ink-2 ring-1 ring-white/[0.06] ring-inset">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
      <span className="hidden max-w-48 truncate sm:inline">{t('home.syncing', { name: busyName, count: progress })}</span>
      <span className="tabular sm:hidden" title={t('home.syncing', { name: busyName, count: progress })}>↻ {progress}</span>
      <button className="rounded-lg px-2 py-1 text-ink-3 hover:bg-white/[0.06] hover:text-ink" onClick={cancel}>{t('common.cancel')}</button>
    </div>
  );
}

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePwa } from '../pwa';

const DownloadIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

/** Header button, only when the browser can install the app right away. */
export function InstallButton() {
  const { t } = useTranslation();
  const { installPrompt, standalone, install } = usePwa();
  if (!installPrompt || standalone) return null;
  return (
    <button className="btn-ghost h-9 px-2.5 text-xs text-accent" onClick={() => void install()} title={t('pwa.install')}>
      <DownloadIcon />
      <span className="hidden sm:inline">{t('pwa.installShort')}</span>
    </button>
  );
}

/** Accounts page: how to get the app on the home screen, for every browser (iOS has no install prompt). */
export function InstallPanel() {
  const { t } = useTranslation();
  const { installPrompt, standalone, ios, install } = usePwa();
  if (standalone) return null;
  return (
    <section className="panel flex flex-wrap items-center gap-4 p-5">
      <img src="/icons/icon-192.png" alt="" className="h-14 w-14 rounded-2xl" />
      <div className="min-w-48 flex-1">
        <h2 className="text-lg font-semibold">{t('pwa.title')}</h2>
        <p className="text-sm text-ink-3">
          {installPrompt ? t('pwa.hint') : ios ? t('pwa.iosHint') : t('pwa.menuHint')}
        </p>
      </div>
      {installPrompt && (
        <button className="btn-primary" onClick={() => void install()}>
          <DownloadIcon />
          {t('pwa.install')}
        </button>
      )}
    </section>
  );
}

/** Bottom toast: a new version is ready (applied on the user's OK), or the app now works offline. */
export function PwaToast() {
  const { t } = useTranslation();
  const { needRefresh, offlineReady, update, dismiss } = usePwa();
  // The offline note is informative only: let it go by itself.
  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const id = setTimeout(dismiss, 6000);
    return () => clearTimeout(id);
  }, [offlineReady, needRefresh, dismiss]);
  if (!needRefresh && !offlineReady) return null;
  return (
    <div
      role="status"
      className="panel fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 z-30 flex items-center gap-3 bg-panel-2 px-4 py-3 shadow-2xl sm:left-auto sm:w-96 md:right-6 md:bottom-6"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
      <span className="min-w-0 flex-1 text-sm">{needRefresh ? t('pwa.updateReady') : t('pwa.offlineReady')}</span>
      {needRefresh && <button className="btn-primary px-3 py-1.5 text-xs" onClick={update}>{t('pwa.update')}</button>}
      <button className="rounded-lg px-2 py-1 text-ink-3 hover:text-ink" onClick={dismiss} aria-label={t('common.close')}>✕</button>
    </div>
  );
}

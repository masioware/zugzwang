import { useTranslation } from 'react-i18next';

/** Route-level loading state: a small spinner and the word, announced to screen readers. */
export function Loading({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p role="status" className={`flex items-center justify-center gap-2.5 py-10 text-sm text-ink-3 ${className}`}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line-2 border-t-accent" aria-hidden />
      {t('common.loading')}
    </p>
  );
}

/** Nothing to show: a centred panel with a message (and usually a link to fix it). */
export function EmptyState({ children, compact = false }: { children: React.ReactNode; compact?: boolean }) {
  return <div className={`panel text-center text-ink-2 ${compact ? 'p-6' : 'p-8'}`}>{children}</div>;
}

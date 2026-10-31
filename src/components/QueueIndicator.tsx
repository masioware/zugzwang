import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { queueEta, useAnalysisQueue } from '../engine/queue';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}`;
}

/** Batch progress in the header: games left, overall bar, speed and time remaining. */
export default function QueueIndicator() {
  const { t } = useTranslation();
  const state = useAnalysisQueue();
  const [, tick] = useState(0);
  const activeCount = Object.keys(state.active).length;
  // Re-render every second so the ETA keeps moving between progress events.
  useEffect(() => {
    if (!activeCount) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [activeCount]);
  if (!activeCount && !state.queue.length) return null;

  const remaining = activeCount + state.queue.length;
  const total = state.completed + remaining;
  const partial = Object.values(state.active).reduce((s, p) => s + (p.total ? p.done / p.total : 0), 0);
  const pct = total ? ((state.completed + partial) / total) * 100 : 0;
  const eta = queueEta(state);

  return (
    <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] py-1 pr-1 pl-2.5 text-xs text-ink-2 ring-1 ring-white/[0.06] ring-inset">
      <Ring pct={pct} />
      <div className="hidden w-40 sm:block">
        <div className="flex justify-between gap-2">
          <span className="truncate">{t('queue.running', { count: remaining })}</span>
          {eta && <span className="tabular shrink-0 text-ink-3">~{formatDuration(eta.seconds)}</span>}
        </div>
        <div className="meter mt-1 h-1">
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="tabular sm:hidden">{remaining}</span>
      <button className="rounded-lg px-2 py-1 text-ink-3 hover:bg-white/[0.06] hover:text-ink" onClick={state.cancelAll} title={t('queue.cancel')}>
        <span className="hidden sm:inline">{t('queue.cancel')}</span>
        <span className="sm:hidden" aria-label={t('queue.cancel')}>✕</span>
      </button>
    </div>
  );
}

/** Small circular progress with a spinning arc, so the header shows work is happening. */
function Ring({ pct }: { pct: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4 -rotate-90 shrink-0" aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="2.5" />
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
    </svg>
  );
}

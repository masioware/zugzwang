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
    <div className="flex items-center gap-2 text-xs text-ink-2">
      <div className="w-52">
        <div className="flex justify-between gap-2">
          <span className="truncate">{t('queue.running', { count: remaining })}</span>
          {eta && <span className="tabular shrink-0 text-ink-3">~{formatDuration(eta.seconds)}</span>}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/10">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        {eta && <div className="tabular mt-0.5 text-[10px] text-ink-3">{t('queue.rate', { rate: eta.rate.toFixed(1) })}</div>}
      </div>
      <button className="btn-ghost px-2 py-1 text-xs" onClick={state.cancelAll}>{t('queue.cancel')}</button>
    </div>
  );
}

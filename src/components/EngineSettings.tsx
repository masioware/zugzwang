import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../lib/settings';
import { defaultWorkers, maxWorkers } from '../engine/pool';

const DEPTHS = [10, 12, 14, 16, 18, 20];

/** Header popover with the engine depth and how many parallel workers to use. */
export default function EngineSettings() {
  const { t } = useTranslation();
  const { depth, setDepth, workers, setWorkers } = useSettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        className="btn-ghost px-2 py-1 text-xs"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title={t('engine.title')}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
        </svg>
        <span className="hidden sm:inline">{t('engine.short', { depth, workers })}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-72 space-y-4 rounded-lg bg-panel-2 p-4 text-sm shadow-2xl ring-1 ring-line">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-3">{t('settings.depth')}</span>
            <select className="input w-full" value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
              {DEPTHS.map((d) => (
                <option key={d} value={d}>{d}{d === 16 ? ` (${t('engine.default')})` : ''}</option>
              ))}
            </select>
            <span className="block text-xs text-ink-3">{t('engine.depthHint')}</span>
          </label>
          <label className="block space-y-1.5">
            <span className="flex justify-between text-xs font-semibold uppercase tracking-wide text-ink-3">
              {t('engine.workers')}
              <span className="tabular text-ink">{workers}</span>
            </span>
            <input
              type="range"
              className="w-full accent-[var(--color-accent)]"
              min={1}
              max={maxWorkers()}
              value={workers}
              onChange={(e) => setWorkers(Number(e.target.value))}
            />
            <span className="block text-xs text-ink-3">{t('engine.workersHint', { cores, recommended: defaultWorkers() })}</span>
          </label>
        </div>
      )}
    </div>
  );
}

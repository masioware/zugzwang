import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../lib/settings';
import { defaultWorkers, maxWorkers } from '../engine/pool';
import { CpuIcon } from './icons';

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
      <button className="btn-ghost h-9 px-2.5 text-xs" aria-expanded={open} onClick={() => setOpen(!open)} title={t('engine.title')}>
        <CpuIcon className="h-4 w-4" />
        <span className="tabular hidden lg:inline">{t('engine.short', { depth, workers })}</span>
      </button>
      {open && (
        <div className="panel absolute right-0 top-11 z-30 w-72 space-y-4 bg-panel-2 p-4 text-sm shadow-2xl">
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
              className="w-full accent-accent"
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

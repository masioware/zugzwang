import { useTranslation } from 'react-i18next';
import { useSettings } from '../lib/settings';
import { defaultWorkers, maxWorkers } from '../engine/pool';
import { LANGUAGES } from '../i18n';

const DEPTHS = [10, 12, 14, 16, 18, 20];

/** Interface language: one button per language. */
export function LanguageControl() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage?.startsWith('pt') ? 'pt-BR' : 'en';
  return (
    <div className="segmented flex w-full max-w-xs" role="radiogroup" aria-label={t('nav.language')}>
      {LANGUAGES.map((l) => (
        <button key={l.code} role="radio" aria-checked={current === l.code} className="segmented-item py-2" onClick={() => void i18n.changeLanguage(l.code)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

/** Engine depth and how many parallel workers to use. */
export function EngineControls() {
  const { t } = useTranslation();
  const { depth, setDepth, workers, setWorkers } = useSettings();
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block space-y-1.5">
        <span className="eyebrow">{t('settings.depth')}</span>
        <select className="input w-full" value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
          {DEPTHS.map((d) => (
            <option key={d} value={d}>{d}{d === 16 ? ` (${t('engine.default')})` : ''}</option>
          ))}
        </select>
        <span className="block text-xs text-ink-3">{t('engine.depthHint')}</span>
      </label>
      <label className="block space-y-1.5">
        <span className="eyebrow flex justify-between">
          {t('engine.workers')}
          <span className="tabular text-ink">{workers}</span>
        </span>
        <input type="range" className="w-full accent-accent" min={1} max={maxWorkers()} value={workers} onChange={(e) => setWorkers(Number(e.target.value))} />
        <span className="block text-xs text-ink-3">{t('engine.workersHint', { cores, recommended: defaultWorkers() })}</span>
      </label>
    </div>
  );
}

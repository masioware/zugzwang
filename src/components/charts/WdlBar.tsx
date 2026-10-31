import { useTranslation } from 'react-i18next';
import type { WDL } from '../../stats/aggregate';

/** 100% stacked win/draw/loss bar; segments are separated by a 2px surface gap. */
export default function WdlBar({ wdl, showLabels = true }: { wdl: WDL; showLabels?: boolean }) {
  const { t } = useTranslation();
  if (!wdl.games) return null;
  const parts = (['win', 'draw', 'loss'] as const).filter((k) => wdl[k] > 0);
  const title = parts.map((k) => `${t(`common.${k}`)}: ${wdl[k]} (${Math.round((wdl[k] / wdl.games) * 100)}%)`).join(' · ');
  return (
    <div className="flex h-5 w-full gap-[2px]" title={title} role="img" aria-label={title}>
      {parts.map((k) => {
        const pct = (wdl[k] / wdl.games) * 100;
        return (
          <div
            key={k}
            className={`flex items-center justify-center overflow-hidden text-[11px] font-semibold text-white first:rounded-l last:rounded-r ${
              k === 'win' ? 'bg-win' : k === 'draw' ? 'bg-draw' : 'bg-loss'
            }`}
            style={{ width: `${pct}%` }}
          >
            {showLabels && pct >= 12 ? `${Math.round(pct)}%` : ''}
          </div>
        );
      })}
    </div>
  );
}

export function WdlLegend() {
  const { t } = useTranslation();
  return (
    <div className="flex gap-4 text-xs text-ink-2">
      {(['win', 'draw', 'loss'] as const).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${k === 'win' ? 'bg-win' : k === 'draw' ? 'bg-draw' : 'bg-loss'}`} />
          {t(`common.${k}`)}
        </span>
      ))}
    </div>
  );
}

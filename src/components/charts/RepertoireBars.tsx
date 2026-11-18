import { useTranslation } from 'react-i18next';
import ChartFrame from './ChartFrame';
import { SERIES } from './theme';

export interface OpeningRow {
  family: string;
  /** Shares, 0-1. */
  you: number;
  legend: number;
}

const percent = (v: number) => (v > 0 ? `${Math.round(v * 100)}%` : '–');

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        {/* A share that exists always shows, however small next to the biggest. */}
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${value > 0 ? Math.max(2, (value / max) * 100) : 0}%`, background: color }} />
      </div>
      <span className="tabular w-9 text-right text-xs text-ink-2">{percent(value)}</span>
    </div>
  );
}

/** The openings one colour plays, as a share of the games: the player against the legend, bar by bar. */
export default function RepertoireBars({ rows, youLabel, legendLabel, label }: { rows: OpeningRow[]; youLabel: string; legendLabel: string; label: string }) {
  const { t } = useTranslation();
  // The scale is the biggest share shown, so the differences read even when no opening is played much.
  const max = Math.max(0.01, ...rows.flatMap((r) => [r.you, r.legend]));
  return (
    <ChartFrame
      legend={
        <div className="flex flex-wrap gap-4 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: SERIES[0] }} />
            {youLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: SERIES[1] }} />
            {legendLabel}
          </span>
        </div>
      }
      table={{ columns: [t('style.opening'), youLabel, legendLabel], rows: rows.map((r) => [r.family, percent(r.you), percent(r.legend)]) }}
    >
      <ul aria-label={label} className="space-y-3">
        {rows.map((r) => (
          <li key={r.family} className="space-y-1">
            <div className="truncate text-sm font-medium">{r.family}</div>
            <span className="sr-only">
              {youLabel} {percent(r.you)}, {legendLabel} {percent(r.legend)}
            </span>
            <div aria-hidden="true" className="space-y-1">
              <Bar value={r.you} max={max} color={SERIES[0]} label={`${youLabel}: ${percent(r.you)}`} />
              <Bar value={r.legend} max={max} color={SERIES[1]} label={`${legendLabel}: ${percent(r.legend)}`} />
            </div>
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}

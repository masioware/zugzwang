import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface TableSpec {
  columns: string[];
  rows: (string | number)[][];
}

/**
 * Wraps a chart with a small "chart / table" switch so every value is also readable
 * as text (and the chart never has to carry a number on every mark).
 */
export default function ChartFrame({
  legend,
  table,
  children,
}: {
  legend?: React.ReactNode;
  table?: TableSpec;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [asTable, setAsTable] = useState(false);
  return (
    <div className="space-y-2">
      {(legend || table) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">{!asTable && legend}</div>
          {table && (
            <button
              className="ml-auto rounded px-2 py-0.5 text-xs font-semibold text-ink-3 ring-1 ring-line transition-colors hover:text-ink"
              onClick={() => setAsTable(!asTable)}
              aria-pressed={asTable}
            >
              {asTable ? t('common.showChart') : t('common.showTable')}
            </button>
          )}
        </div>
      )}
      {asTable && table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                {table.columns.map((c, i) => (
                  <th key={i} className={`py-1.5 pr-3 font-normal ${i ? 'text-right' : ''}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-b border-line/50 last:border-0">
                  {r.map((v, j) => (
                    <td key={j} className={`tabular py-1.5 pr-3 ${j ? 'text-right text-ink-2' : 'font-semibold'}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/** Axis tick that stacks an optional icon, the label and a muted sub-line (e.g. game count). */
export function stackedTick(label: (k: string) => string, icon?: (k: string) => React.ReactNode, sub?: (k: string) => string | undefined) {
  return function Tick(props: {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    visibleTicksCount?: number;
    payload?: { value: unknown };
  }) {
    const key = String(props.payload?.value ?? '');
    // Space available per category; narrow charts (phones) drop the words and keep the number.
    const band = Math.min(120, Number(props.width ?? 0) / (props.visibleTicksCount || 1) || 120);
    const full = sub?.(key);
    const s = full && band < 76 ? (full.match(/^\d+/)?.[0] ?? full) : full;
    return (
      <foreignObject x={Number(props.x ?? 0) - band / 2} y={Number(props.y ?? 0) + 2} width={band} height={60}>
        <div className="flex flex-col items-center text-center text-[11px] leading-tight">
          {icon && <span className="mb-0.5">{icon(key)}</span>}
          <span className="max-w-full truncate font-semibold text-ink-2">{label(key)}</span>
          {s && <span className="text-[10px] text-ink-3">{s}</span>}
        </div>
      </foreignObject>
    );
  };
}

/** Height the x axis needs for `stackedTick`. */
export function tickHeight(icon: boolean, sub: boolean) {
  return 24 + (icon ? 22 : 0) + (sub ? 15 : 0);
}

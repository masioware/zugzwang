import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { Classification } from '../../types';
import { CLASSIFICATIONS } from '../../stats/aggregate';
import ClassificationIcon from '../ClassificationIcon';
import { AXIS, GRID } from './theme';
import ChartTooltip from './ChartTooltip';
import ChartFrame from './ChartFrame';

/** Literal hex values of the classification colours (SVG fills can't read CSS variables in all browsers). */
const HEX: Record<Classification, string> = {
  brilliant: '#26c2a3',
  great: '#749bbf',
  best: '#81b64c',
  excellent: '#96bc4b',
  good: '#95b776',
  book: '#a88865',
  inaccuracy: '#f7c631',
  mistake: '#ffa459',
  miss: '#ff7769',
  blunder: '#fa412d',
};

/** Share of each classification among the user's moves, stacked to 100%, per week or month. */
export default function QualityOverTime({
  data,
  unit,
}: {
  data: ({ t: number; total: number } & Record<Classification, number>)[];
  unit: 'week' | 'month';
}) {
  const { t, i18n } = useTranslation();
  const [includeBook, setIncludeBook] = useState(false);
  // Book moves dominate early games; without them the shares are of "real" decisions only.
  const classes = includeBook ? CLASSIFICATIONS : CLASSIFICATIONS.filter((c) => c !== 'book');
  const rows = useMemo(
    () =>
      includeBook
        ? data
        : data.map((d) => {
            const rest = 100 - d.book;
            const out = { ...d, total: Math.round((d.total * rest) / 100) };
            for (const c of CLASSIFICATIONS) out[c] = rest > 0 ? (d[c] / rest) * 100 : 0;
            out.book = 0;
            return out;
          }),
    [data, includeBook],
  );
  const fmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, unit === 'month' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' });
  // Worst at the bottom so problems read as a band along the baseline.
  const order = [...classes].reverse();

  return (
    <ChartFrame
      legend={
        <label className="flex items-center gap-1.5 text-xs text-ink-2">
          <input type="checkbox" checked={includeBook} onChange={(e) => setIncludeBook(e.target.checked)} />
          {t('stats.includeBook')}
        </label>
      }
      table={{
        columns: ['', ...classes.map((c) => t(`classification.${c}`))],
        rows: rows.map((d) => [fmt.format(d.t), ...classes.map((c) => `${d[c].toFixed(1)}%`)]),
      }}
    >
    <div className="space-y-3">
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="t" tickFormatter={(v) => fmt.format(v)} {...AXIS} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} width={40} {...AXIS} />
            <Tooltip
              cursor={{ stroke: '#7a7a80', strokeDasharray: '3 3' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
                if (!p) return null;
                return (
                  <ChartTooltip
                    title={`${fmt.format(p.t)} · ${t('stats.movesCount', { count: p.total })}`}
                    rows={classes.filter((c) => p[c] > 0).map((c) => ({
                      color: HEX[c],
                      label: t(`classification.${c}`),
                      value: `${p[c].toFixed(1)}%`,
                    }))}
                  />
                );
              }}
            />
            {order.map((c) => (
              <Area
                key={c}
                dataKey={c}
                stackId="q"
                type="monotone"
                stroke="#121215"
                strokeWidth={1}
                fill={HEX[c]}
                fillOpacity={0.9}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
        {classes.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <ClassificationIcon c={c} size={14} />
            {t(`classification.${c}`)}
          </span>
        ))}
      </div>
    </div>
    </ChartFrame>
  );
}

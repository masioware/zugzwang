import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { RatingSeries } from '../../stats/aggregate';
import { AXIS, GRID, TIME_CLASS_COLOR } from './theme';
import ChartTooltip from './ChartTooltip';
import ChartFrame from './ChartFrame';

/** Rating after each rated game, one line per platform + time control; legend toggles lines. */
export default function RatingChart({ series }: { series: RatingSeries[] }) {
  const { t, i18n } = useTranslation();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });
  const short = new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', year: '2-digit' });
  const multiSource = new Set(series.map((s) => s.source)).size > 1;
  const name = (s: RatingSeries) => (multiSource ? `${t(`timeClass.${s.timeClass}`)} · ${t(`platform.${s.source}`)}` : t(`timeClass.${s.timeClass}`));
  const visible = series.filter((s) => !hidden.has(s.key));

  // One tick per month boundary inside the visible range.
  const all = visible.flatMap((x) => x.points.map((p) => p.t));
  const [min, max] = all.length ? [Math.min(...all), Math.max(...all)] : [0, 1];
  const ticks: number[] = [];
  for (let d = new Date(min); d.getTime() <= max; ) {
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    if (d.getTime() <= max) ticks.push(d.getTime());
  }
  const ratings = visible.flatMap((s) => s.points.map((p) => p.rating));
  // Round ticks (multiples of 50/100/…) spanning the visible ratings with a little headroom.
  const lo = ratings.length ? Math.min(...ratings) - 20 : 0;
  const hi = ratings.length ? Math.max(...ratings) + 20 : 1;
  const step = [25, 50, 100, 200, 250, 500].find((s) => (hi - lo) / s <= 5) ?? 1000;
  const yDomain: [number, number] = [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
  const yTicks: number[] = [];
  for (let v = yDomain[0]; v <= yDomain[1]; v += step) yTicks.push(v);

  const toggle = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else if (series.length - next.size > 1) next.add(key); // keep at least one line
      return next;
    });

  return (
    <ChartFrame
      legend={
        <div className="flex flex-wrap gap-2" title={t('stats.showSeries')}>
          {series.map((s) => {
            const off = hidden.has(s.key);
            const last = s.points[s.points.length - 1];
            const first = s.points[0];
            const delta = last.rating - first.rating;
            return (
              <button
                key={s.key}
                onClick={() => toggle(s.key)}
                aria-pressed={!off}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ring-1 transition-opacity ${off ? 'opacity-40 ring-line' : 'ring-line hover:bg-white/5'}`}
              >
                <svg width="16" height="4" aria-hidden>
                  <line x1="0" y1="2" x2="16" y2="2" stroke={TIME_CLASS_COLOR[s.timeClass]} strokeWidth="2" strokeDasharray={s.source === 'lichess' ? '4 2' : undefined} />
                </svg>
                <span className="text-ink-2">{name(s)}</span>
                <span className="tabular font-bold text-ink">{last.rating}</span>
                <span className={`tabular ${delta > 0 ? 'text-win' : delta < 0 ? 'text-loss' : 'text-ink-3'}`}>
                  {delta > 0 ? '▲' : delta < 0 ? '▼' : ''}
                  {Math.abs(delta) || '='}
                </span>
              </button>
            );
          })}
        </div>
      }
      table={{
        columns: ['', t('stats.first'), t('stats.last'), t('stats.peak'), t('common.games')],
        rows: series.map((s) => [name(s), s.points[0].rating, s.points[s.points.length - 1].rating, Math.max(...s.points.map((p) => p.rating)), s.points.length]),
      }}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={[min, max]} ticks={ticks} tickFormatter={(v) => short.format(v)} {...AXIS} />
            <YAxis domain={yDomain} ticks={yTicks} {...AXIS} width={44} />
            <Tooltip
              cursor={{ stroke: '#7a7a80', strokeDasharray: '3 3' }}
              content={({ payload }) => {
                const p = payload?.[0];
                if (!p) return null;
                const s = series.find((x) => x.key === p.name);
                return (
                  <ChartTooltip
                    title={date.format((p.payload as { t: number }).t)}
                    rows={[{ color: s ? TIME_CLASS_COLOR[s.timeClass] : undefined, dashed: s?.source === 'lichess', label: s ? name(s) : '', value: String(p.value) }]}
                  />
                );
              }}
            />
            {visible.map((s) => (
              <Line
                key={s.key}
                name={s.key}
                data={s.points}
                dataKey="rating"
                stroke={TIME_CLASS_COLOR[s.timeClass]}
                strokeDasharray={s.source === 'lichess' ? '4 2' : undefined}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: '#121215', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

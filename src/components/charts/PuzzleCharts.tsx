import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { Day, RatingPoint } from '../../puzzles/stats';
import { AXIS, GRID, SERIES, WDL_COLOR } from './theme';
import ChartTooltip from './ChartTooltip';
import ChartFrame from './ChartFrame';

/** Puzzle rating after each rated puzzle; x is the puzzle number since many happen on the same day. */
export function PuzzleRatingChart({ points }: { points: RatingPoint[] }) {
  const { t, i18n } = useTranslation();
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });
  const data = points.map((p, i) => ({ ...p, n: i + 1 }));
  const ratings = points.map((p) => p.rating);
  const lo = Math.floor((Math.min(...ratings) - 20) / 50) * 50;
  const hi = Math.ceil((Math.max(...ratings) + 20) / 50) * 50;
  return (
    <ChartFrame
      table={{
        columns: ['', t('puzzleStats.rating')],
        rows: [
          [t('stats.first'), ratings[0]],
          [t('stats.last'), ratings[ratings.length - 1]],
          [t('stats.peak'), Math.max(...ratings)],
        ],
      }}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="n" type="number" domain={[1, Math.max(2, data.length)]} allowDecimals={false} {...AXIS} />
            <YAxis domain={[lo, hi]} width={44} {...AXIS} />
            <Tooltip
              cursor={{ stroke: '#8b8987', strokeDasharray: '3 3' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as (RatingPoint & { n: number }) | undefined;
                if (!p) return null;
                return <ChartTooltip title={`#${p.n} · ${date.format(p.t)}`} rows={[{ color: SERIES[0], label: t('puzzleStats.rating'), value: String(p.rating) }]} />;
              }}
            />
            <Line dataKey="rating" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#262522', strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Puzzles per day, solved and failed stacked. */
export function ActivityChart({ days }: { days: Day[] }) {
  const { t, i18n } = useTranslation();
  const short = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: 'numeric', month: 'short' });
  const legend = (
    <div className="flex gap-4 text-xs text-ink-2">
      {(['solved', 'failed'] as const).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: k === 'solved' ? WDL_COLOR.win : WDL_COLOR.loss }} />
          {t(`puzzleStats.${k}`)}
        </span>
      ))}
    </div>
  );
  return (
    <ChartFrame
      legend={legend}
      table={{
        columns: ['', t('puzzleStats.solved'), t('puzzleStats.failed')],
        rows: days.filter((d) => d.solved + d.failed).map((d) => [short.format(d.t), d.solved, d.failed]),
      }}
    >
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="15%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="t" tickFormatter={(v) => short.format(v)} minTickGap={24} {...AXIS} />
            <YAxis allowDecimals={false} width={32} {...AXIS} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ payload }) => {
                const d = payload?.[0]?.payload as Day | undefined;
                if (!d) return null;
                return (
                  <ChartTooltip
                    title={short.format(d.t)}
                    rows={[
                      { color: WDL_COLOR.win, label: t('puzzleStats.solved'), value: String(d.solved) },
                      { color: WDL_COLOR.loss, label: t('puzzleStats.failed'), value: String(d.failed) },
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="solved" stackId="a" fill={WDL_COLOR.win} isAnimationActive={false} />
            <Bar dataKey="failed" stackId="a" fill={WDL_COLOR.loss} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

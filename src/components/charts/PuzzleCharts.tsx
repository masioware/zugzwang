import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { Day, RatingPoint, TrendPoint } from '../../puzzles/stats';
import { AXIS, GRID, MUTED, SERIES, SURFACE, WDL_COLOR } from './theme';
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
            <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="n" type="number" domain={[1, Math.max(2, data.length)]} allowDecimals={false} {...AXIS} />
            <YAxis domain={[lo, hi]} width={44} {...AXIS} />
            <Tooltip
              cursor={{ stroke: '#7a7a80', strokeDasharray: '3 3' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as (RatingPoint & { n: number }) | undefined;
                if (!p) return null;
                return <ChartTooltip title={`#${p.n} · ${date.format(p.t)}`} rows={[{ color: SERIES[0], label: t('puzzleStats.rating'), value: String(p.rating) }]} />;
              }}
            />
            <Line dataKey="rating" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#121215', strokeWidth: 2 }} isAnimationActive={false} />
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
            <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
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
            <Bar dataKey="failed" stackId="a" fill={WDL_COLOR.loss} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/**
 * One theme over time: each attempt as a dot (top = solved, bottom = failed), a rolling accuracy, and the
 * user's overall accuracy for comparison. x is the attempt number, as several happen on the same day.
 */
export function ThemeTrendChart({ points, average, window }: { points: TrendPoint[]; average: number; window: number }) {
  const { t, i18n } = useTranslation();
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' });
  const data = points.map((p, i) => ({ ...p, n: i + 1, result: p.solved ? 100 : 0 }));
  return (
    <ChartFrame
      legend={
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden><line x1="0" y1="2" x2="16" y2="2" stroke={SERIES[0]} strokeWidth="2" /></svg>
            {t('puzzleStats.rollingAccuracy', { count: window })}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden><line x1="0" y1="2" x2="16" y2="2" stroke={MUTED} strokeWidth="2" strokeDasharray="4 3" /></svg>
            {t('puzzleStats.overallAverage', { value: Math.round(average) })}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: WDL_COLOR.win }} />
            {t('puzzleStats.solvedShort')}
            <span className="ml-1.5 h-2 w-2 rounded-full" style={{ background: WDL_COLOR.loss }} />
            {t('puzzleStats.failedShort')}
          </span>
        </div>
      }
      table={{
        columns: ['#', t('games.date'), t('puzzleStats.result'), t('puzzleStats.rollingAccuracy', { count: window })],
        rows: [...data].reverse().map((d) => [d.n, date.format(d.t), t(d.solved ? 'puzzleStats.solvedShort' : 'puzzleStats.failedShort'), `${Math.round(d.rolling)}%`]),
      }}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="theme-trend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="n" type="number" domain={[1, Math.max(2, data.length)]} allowDecimals={false} {...AXIS} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} width={44} {...AXIS} />
            <ReferenceLine y={average} stroke={MUTED} strokeDasharray="4 3" />
            <Tooltip
              cursor={{ stroke: MUTED, strokeDasharray: '3 3' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!p) return null;
                return (
                  <ChartTooltip
                    title={`#${p.n} · ${date.format(p.t)}`}
                    rows={[
                      { label: t(p.solved ? 'puzzleStats.solvedShort' : 'puzzleStats.failedShort'), value: p.solved ? '✓' : '✗' },
                      { color: SERIES[0], label: t('puzzleStats.rollingAccuracy', { count: window }), value: `${Math.round(p.rolling)}%` },
                    ]}
                  />
                );
              }}
            />
            <Area dataKey="rolling" type="monotone" stroke={SERIES[0]} strokeWidth={2} fill="url(#theme-trend)" baseValue={0} dot={false} activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }} isAnimationActive={false} />
            <Scatter
              dataKey="result"
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number; payload?: { solved: boolean } }) => (
                <circle cx={props.cx} cy={props.cy} r={3.5} fill={props.payload?.solved ? WDL_COLOR.win : WDL_COLOR.loss} stroke={SURFACE} strokeWidth={2} />
              )}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

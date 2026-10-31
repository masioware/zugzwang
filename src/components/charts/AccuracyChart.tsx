import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AXIS, GRID, SERIES } from './theme';
import ChartTooltip from './ChartTooltip';
import ChartFrame from './ChartFrame';
import { accuracyDomain, ticksFor } from './scale';

interface Point {
  t: number;
  accuracy: number;
  average: number;
  id: string;
}

/** Each analysed game as a dot (click to open it) plus a rolling average line. */
export default function AccuracyChart({ data }: { data: Point[] }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });
  const short = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: 'numeric', month: 'short' });
  const domain = accuracyDomain(data.map((d) => d.accuracy));
  const mean = data.reduce((s, d) => s + d.accuracy, 0) / (data.length || 1);

  return (
    <ChartFrame
      legend={
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: '#8b8987' }} />
            {t('stats.gameAccuracy')} <span className="text-ink-3">({t('stats.clickToOpen')})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden><line x1="0" y1="2" x2="16" y2="2" stroke={SERIES[0]} strokeWidth="2" /></svg>
            {t('stats.rollingAvg')}
          </span>
        </div>
      }
      table={{
        columns: [t('games.date'), t('stats.gameAccuracy'), t('stats.rollingAvg')],
        rows: [...data].reverse().map((d) => [date.format(d.t), d.accuracy.toFixed(1), d.average.toFixed(1)]),
      }}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={(v) => short.format(v)} minTickGap={24} {...AXIS} />
            <YAxis domain={domain} ticks={ticksFor(domain)} width={36} allowDataOverflow {...AXIS} />
            <ReferenceLine y={mean} stroke="#8b8987" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ stroke: '#8b8987', strokeDasharray: '3 3' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as Point | undefined;
                if (!p) return null;
                return (
                  <ChartTooltip
                    title={date.format(p.t)}
                    rows={[
                      { label: t('stats.gameAccuracy'), value: p.accuracy.toFixed(1) },
                      { color: SERIES[0], label: t('stats.rollingAvg'), value: p.average.toFixed(1) },
                    ]}
                  />
                );
              }}
            />
            <Scatter
              dataKey="accuracy"
              isAnimationActive={false}
              cursor="pointer"
              onClick={(p: { payload?: Point }) => p.payload && navigate(`/game/${encodeURIComponent(p.payload.id)}`)}
              shape={(props: { cx?: number; cy?: number }) => (
                // Large invisible hit area around a small visible dot.
                <g>
                  <circle cx={props.cx} cy={props.cy} r={10} fill="transparent" />
                  <circle cx={props.cx} cy={props.cy} r={4} fill="#8b8987" stroke="#262522" strokeWidth={2} />
                </g>
              )}
            />
            <Line dataKey="average" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={false} type="monotone" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

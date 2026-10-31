import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { AXIS, GRID, SERIES } from './theme';
import ChartTooltip from './ChartTooltip';
import ChartFrame from './ChartFrame';
import { accuracyDomain, ticksFor } from './scale';

/** Average accuracy of the user's n-th move, with the overall average as a reference. */
export default function AccuracyByMove({ data }: { data: { move: number; accuracy: number; samples: number }[] }) {
  const { t } = useTranslation();
  const domain = accuracyDomain(data.map((d) => d.accuracy));
  const samples = data.reduce((s, d) => s + d.samples, 0);
  const mean = data.reduce((s, d) => s + d.accuracy * d.samples, 0) / (samples || 1);

  return (
    <ChartFrame
      legend={
        <div className="flex flex-wrap gap-x-4 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden><line x1="0" y1="2" x2="16" y2="2" stroke={SERIES[0]} strokeWidth="2" /></svg>
            {t('common.accuracy')}
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden><line x1="0" y1="2" x2="16" y2="2" stroke="#8b8987" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
            {t('stats.average')} {mean.toFixed(1)}
          </span>
        </div>
      }
      table={{
        columns: [t('stats.moveCol'), t('common.accuracy'), t('common.games')],
        rows: data.map((d) => [d.move, d.accuracy.toFixed(1), d.samples]),
      }}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="acc-move" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="move" type="number" domain={['dataMin', 'dataMax']} allowDecimals={false} {...AXIS} />
            <YAxis domain={domain} ticks={ticksFor(domain)} width={36} allowDataOverflow {...AXIS} />
            <ReferenceLine y={mean} stroke="#8b8987" strokeDasharray="4 3" />
            <Tooltip
              cursor={{ stroke: '#8b8987', strokeDasharray: '3 3' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!p) return null;
                return (
                  <ChartTooltip
                    title={`${t('stats.moveN', { n: p.move })} · ${t('stats.samples', { count: p.samples })}`}
                    rows={[{ color: SERIES[0], label: t('common.accuracy'), value: p.accuracy.toFixed(1) }]}
                  />
                );
              }}
            />
            <Area
              dataKey="accuracy"
              type="monotone"
              stroke={SERIES[0]}
              strokeWidth={2}
              fill="url(#acc-move)"
              baseValue={domain[0]}
              activeDot={{ r: 4, fill: SERIES[0], stroke: '#262522', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

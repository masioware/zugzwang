import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AXIS, GRID, SERIES } from './theme';
import ChartTooltip from './ChartTooltip';

/** One bar per game: the move number at which the user left the opening book. */
export default function MasteryChart({ points }: { points: { t: number; move: number; id: string }[] }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });
  const short = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: 'numeric', month: 'short' });
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="15%">
          <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="t" tickFormatter={(v) => short.format(v)} minTickGap={40} {...AXIS} />
          <YAxis allowDecimals={false} width={32} {...AXIS} />
          <ReferenceLine
            y={points.reduce((s, p) => s + p.move, 0) / (points.length || 1)}
            stroke="#7a7a80"
            strokeDasharray="4 3"
            label={{ value: t('stats.average'), position: 'insideTopRight', fill: '#7a7a80', fontSize: 10 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as (typeof points)[number] | undefined;
              if (!p) return null;
              return <ChartTooltip title={date.format(p.t)} rows={[{ color: SERIES[0], label: t('stats.leftBookAt'), value: t('stats.moveN', { n: p.move }) }]} />;
            }}
          />
          <Bar
            dataKey="move"
            fill={SERIES[0]}
            activeBar={{ fill: SERIES[0], fillOpacity: 0.75, stroke: '#f6f5f1', strokeWidth: 1 }}
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
            cursor="pointer"
            isAnimationActive={false}
            onClick={(d: { payload?: { id: string } }) => d.payload && navigate(`/game/${encodeURIComponent(d.payload.id)}`)}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

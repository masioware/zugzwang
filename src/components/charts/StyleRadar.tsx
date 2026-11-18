import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { AXES, type AxisId } from '../../style/axes';
import { GRID, INK, MUTED, SERIES } from './theme';
import ChartFrame from './ChartFrame';

type Scores = Partial<Record<AxisId, number>>;

/** Six style axes (0-100, 50 = the legends' average): you against one legend. */
export default function StyleRadar({ you, legend, legendName }: { you: Scores; legend: Scores; legendName: string }) {
  const { t } = useTranslation();
  const axes = AXES.filter((a) => you[a.id] !== undefined && legend[a.id] !== undefined);
  const rows = axes.map((a) => ({ axis: t(`style.axis.${a.id}`), you: you[a.id]!, legend: legend[a.id]! }));
  const mine = t('style.you');

  return (
    <ChartFrame
      legend={
        <div className="flex flex-wrap gap-4 text-xs text-ink-2">
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: SERIES[0] }} />
            {mine}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: SERIES[1] }} />
            {legendName}
          </span>
        </div>
      }
      table={{ columns: [t('style.axisCol'), mine, legendName], rows: rows.map((r) => [r.axis, r.you, r.legend]) }}
    >
      <div role="img" aria-label={t('style.radarLabel', { name: legendName })} className="h-72 w-full">
        <ResponsiveContainer>
          <RadarChart data={rows} outerRadius="72%">
            <PolarGrid stroke={GRID} />
            <PolarAngleAxis dataKey="axis" tick={{ fill: INK, fontSize: 12 }} />
            <PolarRadiusAxis domain={[0, 100]} tickCount={3} tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} />
            <Radar dataKey="legend" stroke={SERIES[1]} fill={SERIES[1]} fillOpacity={0.15} strokeWidth={2} isAnimationActive={false} />
            <Radar dataKey="you" stroke={SERIES[0]} fill={SERIES[0]} fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { WDL } from '../../stats/aggregate';
import { AXIS, GRID, WDL_COLOR } from './theme';
import ChartTooltip from './ChartTooltip';
import ChartFrame from './ChartFrame';
import { WdlLegend } from './WdlBar';

/** Games per month stacked by result, with the month's total above each column. */
export default function MonthlyResults({ data }: { data: ({ month: string } & WDL)[] }) {
  const { t, i18n } = useTranslation();
  const fmt = new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const label = (m: string) => fmt.format(new Date(`${m}-01T00:00:00Z`));
  const keys = ['loss', 'draw', 'win'] as const;

  return (
    <ChartFrame
      legend={<WdlLegend />}
      table={{
        columns: ['', t('common.games'), t('common.win'), t('common.draw'), t('common.loss')],
        rows: data.map((d) => [label(d.month), d.games, d.win, d.draw, d.loss]),
      }}
    >
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="month" tickFormatter={label} {...AXIS} />
            <YAxis allowDecimals={false} width={36} {...AXIS} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as ({ month: string } & WDL) | undefined;
                if (!p) return null;
                return (
                  <ChartTooltip
                    title={`${label(p.month)} · ${t('games.count', { count: p.games })}`}
                    rows={(['win', 'draw', 'loss'] as const).map((k) => ({
                      color: WDL_COLOR[k],
                      label: t(`common.${k}`),
                      value: `${p[k]} (${Math.round((p[k] / p.games) * 100)}%)`,
                    }))}
                  />
                );
              }}
            />
            {keys.map((k, i) => (
              <Bar
                key={k}
                dataKey={k}
                stackId="r"
                fill={WDL_COLOR[k]}
                stroke="#262522"
                strokeWidth={2}
                maxBarSize={56}
                radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              >
                {i === keys.length - 1 && <LabelList dataKey="games" position="top" fill="#c3c2b7" fontSize={11} fontWeight={600} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

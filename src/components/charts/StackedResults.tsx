import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { WDL } from '../../stats/aggregate';
import { AXIS, GRID, WDL_COLOR } from './theme';
import ChartTooltip from './ChartTooltip';
import ChartFrame, { stackedTick, tickHeight } from './ChartFrame';
import { WdlLegend } from './WdlBar';

interface Row extends WDL {
  key: string;
}

/**
 * 100%-stacked win/draw/loss columns, one per bucket. Large segments carry their share;
 * the axis shows each bucket's game count; empty buckets keep their slot with a dash.
 */
export default function StackedResults({
  rows,
  label,
  tick,
  height = 240,
}: {
  rows: Row[];
  label: (key: string) => string;
  tick?: (key: string) => React.ReactNode;
  height?: number;
}) {
  const { t } = useTranslation();
  const keys = ['loss', 'draw', 'win'] as const;
  const data = rows.map((r) => ({
    ...r,
    // Shares rather than counts so the stack fills to 100% (empty rows stay empty).
    winS: r.games ? r.win / r.games : 0,
    drawS: r.games ? r.draw / r.games : 0,
    lossS: r.games ? r.loss / r.games : 0,
  }));
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');
  const sub = (k: string) => {
    const r = rows.find((x) => x.key === k);
    return r?.games ? t('games.count', { count: r.games }) : t('stats.noGamesShort');
  };

  const segmentLabel = (k: (typeof keys)[number]) =>
    function SegmentLabel(props: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) {
      const r = data[props.index ?? 0];
      const h = Number(props.height ?? 0);
      if (!r?.games || h < 16) return null;
      return (
        <text
          x={Number(props.x ?? 0) + Number(props.width ?? 0) / 2}
          y={Number(props.y ?? 0) + h / 2}
          dy="0.35em"
          textAnchor="middle"
          fill="#fff"
          fontSize={11}
          fontWeight={700}
        >
          {pct(r[k], r.games)}
        </text>
      );
    };

  return (
    <ChartFrame
      legend={<WdlLegend />}
      table={{
        columns: ['', t('common.games'), t('common.win'), t('common.draw'), t('common.loss')],
        rows: rows.map((r) => [label(r.key), r.games, pct(r.win, r.games), pct(r.draw, r.games), pct(r.loss, r.games)]),
      }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="key" interval={0} height={tickHeight(!!tick, true)} {...AXIS} tick={stackedTick(label, tick, sub)} />
            <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} ticks={[0, 0.25, 0.5, 0.75, 1]} width={40} {...AXIS} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as Row | undefined;
                if (!p) return null;
                return (
                  <ChartTooltip
                    title={`${label(p.key)} · ${t('games.count', { count: p.games })}`}
                    rows={(['win', 'draw', 'loss'] as const).map((k) => ({
                      color: WDL_COLOR[k],
                      label: t(`common.${k}`),
                      value: p.games ? `${pct(p[k], p.games)} (${p[k]})` : '–',
                    }))}
                  />
                );
              }}
            />
            {keys.map((k, i) => (
              <Bar
                key={k}
                dataKey={`${k}S`}
                stackId="r"
                fill={WDL_COLOR[k]}
                stroke="#262522"
                strokeWidth={2}
                maxBarSize={88}
                radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              >
                {k !== 'draw' && <LabelList content={segmentLabel(k)} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

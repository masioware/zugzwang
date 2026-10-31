import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, GRID, SERIES } from './theme';
import ChartTooltip from './ChartTooltip';
import ChartFrame, { stackedTick, tickHeight } from './ChartFrame';

interface Row {
  key: string;
  value?: number;
  /** Muted line under the axis label and in the tooltip, e.g. sample size. */
  note?: string;
}

/** Single-series column chart; values sit above the bars, empty categories show "–". */
export default function ValueBars({
  rows,
  label,
  tick,
  format = (v) => v.toFixed(1),
  domain = [0, 100],
  seriesLabel,
  height = 220,
  color = SERIES[0],
  highlightExtremes = false,
}: {
  rows: Row[];
  label: (key: string) => string;
  tick?: (key: string) => React.ReactNode;
  format?: (v: number) => string;
  domain?: [number, number | 'auto'];
  seriesLabel: string;
  height?: number;
  color?: string;
  /** Mark the best and worst category with a ▲/▼ next to its value. */
  highlightExtremes?: boolean;
}) {
  const data = rows.map((r) => ({ ...r, label: label(r.key), shown: r.value ?? 0 }));
  const values = rows.flatMap((r) => (r.value === undefined ? [] : [r.value]));
  const [max, min] = [Math.max(...values), Math.min(...values)];
  const notes = rows.some((r) => r.note);
  // Categories without a value say so under their label (a zero-height bar has no label of its own).
  const noteOf = (k: string) => {
    const r = rows.find((x) => x.key === k);
    return r?.value === undefined ? '–' : r.note;
  };

  return (
    <ChartFrame table={{ columns: ['', seriesLabel, ...(notes ? [''] : [])], rows: rows.map((r) => [label(r.key), r.value === undefined ? '–' : format(r.value), ...(notes ? [r.note ?? ''] : [])]) }}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
            <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="key" interval={0} height={tickHeight(!!tick, notes || rows.some((r) => r.value === undefined))} {...AXIS} tick={stackedTick(label, tick, noteOf)} />
            <YAxis domain={domain} width={40} {...AXIS} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as (Row & { label: string }) | undefined;
                if (!p) return null;
                return <ChartTooltip title={p.note ? `${p.label} · ${p.note}` : p.label} rows={[{ color, label: seriesLabel, value: p.value === undefined ? '–' : format(p.value) }]} />;
              }}
            />
            <Bar dataKey="shown" fill={color} radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false} activeBar={{ fill: color, fillOpacity: 0.8, stroke: '#f6f5f1', strokeWidth: 1 }}>
              <LabelList
                dataKey="key"
                position="top"
                content={(props: { x?: number | string; y?: number | string; width?: number | string; value?: unknown }) => {
                  const r = rows.find((x) => x.key === props.value);
                  const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2;
                  const y = Number(props.y ?? 0) - 6;
                  if (!r || r.value === undefined) return <text x={x} y={y} textAnchor="middle" fill="#7a7a80" fontSize={11}>–</text>;
                  const mark = highlightExtremes && values.length > 2 && max !== min ? (r.value === max ? ' ▲' : r.value === min ? ' ▼' : '') : '';
                  return (
                    <text x={x} y={y} textAnchor="middle" fill="#f6f5f1" fontSize={11} fontWeight={600}>
                      {format(r.value)}
                      {mark}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

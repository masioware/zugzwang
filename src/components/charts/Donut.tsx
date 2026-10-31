import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { SERIES } from './theme';
import ChartTooltip from './ChartTooltip';

interface Slice {
  key: string;
  label: string;
  value: number;
  icon?: React.ReactNode;
}

/**
 * Part-to-whole donut for at most five categories (the validated colour slots, wrap-around
 * pair included), with a legend listing value and share.
 */
export default function Donut({ slices, unit }: { slices: Slice[]; unit: (n: number) => string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const shown = slices.slice(0, 5);
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              nameKey="label"
              innerRadius="58%"
              outerRadius="100%"
              stroke="#262522"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {shown.map((s, i) => (
                <Cell key={s.key} fill={SERIES[i]} />
              ))}
            </Pie>
            <Tooltip
              content={({ payload }) => {
                const p = payload?.[0];
                if (!p) return null;
                const i = shown.findIndex((s) => s.label === p.name);
                return (
                  <ChartTooltip
                    title={String(p.name)}
                    rows={[{ color: SERIES[i], label: unit(Number(p.value)), value: `${((Number(p.value) / total) * 100).toFixed(1)}%` }]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-40 flex-1 space-y-1.5 text-sm">
        {shown.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SERIES[i] }} />
            {s.icon}
            <span className="flex-1 text-ink-2">{s.label}</span>
            <span className="tabular font-semibold">{total ? ((s.value / total) * 100).toFixed(1) : '0.0'}%</span>
            <span className="tabular w-10 text-right text-xs text-ink-3">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

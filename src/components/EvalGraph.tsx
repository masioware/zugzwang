import { Area, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { Classification, GameAnalysis } from '../types';
import { formatScore, winPercent } from '../analysis/winprob';
import { CLASS_COLOR } from './ClassificationIcon';

interface Props {
  analysis: GameAnalysis;
  current: number;
  onSelect: (ply: number) => void;
}

const MARKED = new Set<Classification>(['brilliant', 'great', 'mistake', 'miss', 'blunder']);

export default function EvalGraph({ analysis, current, onSelect }: Props) {
  const { t } = useTranslation();
  const data = [
    { ply: 0, white: 50, label: t('review.startPosition'), eval: '0.00' },
    ...analysis.moves.map((m) => ({
      ply: m.ply + 1,
      white: winPercent(m.scoreAfter),
      label: `${Math.floor(m.ply / 2) + 1}${m.color === 'white' ? '.' : '…'} ${m.san}`,
      eval: formatScore(m.scoreAfter),
      classification: m.classification,
    })),
  ];

  return (
    <div className="h-28 cursor-pointer select-none overflow-hidden rounded-xl bg-panel-3 ring-1 ring-line" aria-label={t('review.evalGraph')}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          onClick={(e) => {
            const idx = Number(e?.activeTooltipIndex ?? e?.activeIndex);
            if (Number.isFinite(idx)) onSelect(data[idx].ply);
          }}
        >
          <XAxis dataKey="ply" hide type="number" domain={[0, data.length - 1]} />
          <YAxis hide domain={[0, 100]} />
          <ReferenceLine y={50} stroke="#7a7a80" strokeOpacity={0.45} strokeDasharray="2 3" />
          <Area
            dataKey="white"
            type="monotone"
            stroke="#f2f1ec"
            strokeWidth={1}
            fill="#f2f1ec"
            fillOpacity={0.92}
            baseValue={0}
            isAnimationActive={false}
            activeDot={{ r: 4.5, fill: '#ffd60a', stroke: '#09090b', strokeWidth: 2 }}
            // Notable moves get a dot in their classification colour.
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const c = data[props.index ?? 0] as { classification?: Classification };
              if (props.cx === undefined || props.cy === undefined || !c.classification || !MARKED.has(c.classification))
                return <g key={props.index} />;
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={3.5} fill={CLASS_COLOR[c.classification]} stroke="#09090b" strokeWidth={1.5} />;
            }}
          />
          <ReferenceLine x={current} stroke="#ffd60a" strokeWidth={2} />
          <Tooltip
            cursor={{ stroke: '#7a7a80', strokeDasharray: '3 3' }}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg bg-panel-2/95 px-2.5 py-1.5 text-xs shadow-xl ring-1 ring-line-2 backdrop-blur">
                  <span className="font-mono font-bold text-ink">{p.eval}</span>{' '}
                  <span className="text-ink-2">{p.label}</span>
                  {'classification' in p && p.classification && (
                    <span className="text-ink-3"> · {t(`classification.${p.classification}`)}</span>
                  )}
                </div>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}


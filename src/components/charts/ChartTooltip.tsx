/** Tooltip box: value first (strong), label after; series keyed by a short line in its color. */
export default function ChartTooltip({
  title,
  rows,
}: {
  title: string;
  rows: { color?: string; label: string; value: string; dashed?: boolean }[];
}) {
  return (
    <div className="rounded-xl bg-panel-2/90 px-3 py-2 text-xs shadow-2xl ring-1 ring-line-2 backdrop-blur-md">
      <div className="eyebrow mb-1.5 normal-case tracking-normal">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          {r.color && (
            <svg width="14" height="4" aria-hidden>
              <line x1="0" y1="2" x2="14" y2="2" stroke={r.color} strokeWidth="2" strokeDasharray={r.dashed ? '3 2' : undefined} />
            </svg>
          )}
          <span className="tabular font-mono font-bold text-ink">{r.value}</span>
          <span className="text-ink-2">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

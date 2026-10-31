/** A titled panel, styled like the statistics panels. */
export default function Section({ title, aside, children }: { title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel-2/40 px-5 py-3.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </header>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

/** Thin progress bar. */
export function Progress({ value, total }: { value: number; total: number }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
    </div>
  );
}

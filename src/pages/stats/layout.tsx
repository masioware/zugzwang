import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Icon = (p: { className?: string }) => React.JSX.Element;

/** A titled panel of the stats page. */
export function Panel({ id, icon: Icon, actions, children }: { id: string; icon: Icon; actions?: React.ReactNode; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <section id={id} data-panel className="panel scroll-mt-32 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h3 className="flex items-center gap-2.5 text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20 ring-inset">
            <Icon className="h-4 w-4" />
          </span>
          {t(`statsNav.${id}`)}
        </h3>
        {actions}
      </header>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

/** A block inside a panel with its own heading. */
export function Block({ title, subtitle, aside, children }: { title: string; subtitle?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3 px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="font-display font-semibold">{title}</h4>
          {subtitle && <p className="text-xs text-ink-3">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** Two-option toggle styled like a tab strip. */
export function Toggle<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, label]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className="segmented-item py-1 text-xs"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Renders its children once they come within ~800px of the viewport (and keeps them). Statistics pages
 * render many charts; drawing only the first panel at once keeps opening a section quick.
 */
export function Deferred({ children, minHeight = 420 }: { children: React.ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (shown || !el) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setShown(true), { rootMargin: '800px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);
  return shown ? <>{children}</> : <div ref={ref} className="panel animate-pulse" style={{ minHeight }} aria-hidden />;
}

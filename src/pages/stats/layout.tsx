import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Icon = (p: { className?: string }) => React.JSX.Element;

export interface NavGroup {
  id: string;
  icon: Icon;
  items: { id: string; icon: Icon }[];
}

/** Top-level heading for a group of panels ("Games", "Openings", …). */
export function GroupHeading({ id, icon: Icon }: { id: string; icon: Icon }) {
  const { t } = useTranslation();
  return (
    <header id={id} className="scroll-mt-20 pt-6 text-center">
      <h2 className="flex items-center justify-center gap-2 text-2xl font-bold">
        <Icon className="h-6 w-6 text-accent" />
        {t(`statsNav.${id}`)}
      </h2>
      <p className="text-sm text-ink-3">{t(`statsNav.${id}Question`)}</p>
    </header>
  );
}

/** A titled panel that the sidebar can link to. */
export function Panel({ id, icon: Icon, actions, children }: { id: string; icon: Icon; actions?: React.ReactNode; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <section id={id} data-panel className="panel scroll-mt-20 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel-2/40 px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="h-5 w-5 text-ink-3" />
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
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 className="font-semibold">{title}</h4>
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
    <div className="flex gap-4 text-sm font-semibold" role="tablist">
      {options.map(([v, label]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={`border-b-2 pb-1 transition-colors ${value === v ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Sticky sidebar listing every panel; highlights the one currently on screen. */
export function StatsNav({ groups, header }: { groups: NavGroup[]; header: React.ReactNode }) {
  const { t } = useTranslation();
  const [active, setActive] = useState(groups[0]?.items[0]?.id);

  useEffect(() => {
    const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -55% 0px' },
    );
    panels.forEach((p) => observer.observe(p));
    return () => observer.disconnect();
  }, [groups]);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <nav className="panel sticky top-[72px] overflow-hidden text-sm" aria-label={t('stats.title')}>
      <div className="border-b border-line px-4 py-3">{header}</div>
      <ul>
        {groups.map((g) => (
          <li key={g.id} className="border-b border-line last:border-0">
            <button onClick={() => go(g.id)} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-base font-bold hover:bg-white/5">
              <g.icon className="h-5 w-5 text-accent" />
              {t(`statsNav.${g.id}`)}
            </button>
            <ul className="pb-1.5">
              {g.items.map((it) => (
                <li key={it.id}>
                  <button
                    onClick={() => go(it.id)}
                    aria-current={active === it.id ? 'location' : undefined}
                    className={`flex w-full items-center gap-2.5 py-1.5 pr-4 pl-11 text-left font-semibold transition-colors ${
                      active === it.id ? 'bg-white/[0.07] text-ink' : 'text-ink-3 hover:text-ink-2'
                    }`}
                  >
                    <it.icon className="h-4 w-4" />
                    {t(`statsNav.${it.id}`)}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}

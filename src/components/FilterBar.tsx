import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFilters } from '../lib/hooks';
import { DEFAULT_FILTERS, type Filters } from '../stats/aggregate';
import { FILTER_PERIODS, TIME_CLASSES } from '../lib/filterParams';

export default function FilterBar({ show }: { show: (keyof Filters)[] }) {
  const { t } = useTranslation();
  const { filters, setFilter, reset } = useFilters();
  const [open, setOpen] = useState(false);
  const active = show.filter((k) => filters[k] !== DEFAULT_FILTERS[k]).length;

  const select = <K extends keyof Filters>(key: K, label: string, options: [Filters[K], string][]) => (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <select
        className="input"
        value={String(filters[key])}
        onChange={(e) => {
          const opt = options.find(([v]) => String(v) === e.target.value);
          if (opt) setFilter(key, opt[0]);
        }}
      >
        {options.map(([v, l]) => (
          <option key={String(v)} value={String(v)}>{l}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-3 md:space-y-0">
      {/* Phones: the filters fold behind a button that counts the active ones. */}
      <div className="flex gap-2 md:hidden">
        <button className="btn-ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          {t('filters.toggle')}
          {active > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] text-accent-ink">{active}</span>}
        </button>
        {active > 0 && <button className="btn-ghost" onClick={reset}>{t('filters.clear')}</button>}
      </div>
      <div className={`${open ? 'grid' : 'hidden'} grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end`}>
      {show.includes('rated') &&
        select('rated', t('filters.rated'), [
          ['all', t('common.all')],
          ['rated', t('filters.ratedOnly')],
          ['casual', t('filters.casual')],
        ])}
      {show.includes('source') &&
        select('source', t('filters.platform'), [
          ['all', t('common.all')],
          ['chesscom', t('platform.chesscom')],
          ['lichess', t('platform.lichess')],
        ])}
      {show.includes('timeClass') &&
        select('timeClass', t('filters.timeClass'), [
          ['all', t('common.all')],
          ...TIME_CLASSES.map((c) => [c, t(`timeClass.${c}`)] as [Filters['timeClass'], string]),
        ])}
      {show.includes('color') &&
        select('color', t('filters.color'), [
          ['all', t('common.all')],
          ['white', t('common.white')],
          ['black', t('common.black')],
        ])}
      {show.includes('outcome') &&
        select('outcome', t('filters.result'), [
          ['all', t('common.all')],
          ['win', t('common.win')],
          ['draw', t('common.draw')],
          ['loss', t('common.loss')],
        ])}
      {show.includes('period') &&
        select('period', t('filters.period'), FILTER_PERIODS.map((p) => [p, t(`filters.periods.${p}`)]))}
      {show.includes('search') && (
        <label className="col-span-2 flex flex-col gap-1.5">
          <span className="eyebrow">{t('filters.search')}</span>
          <input
            className="input md:w-56"
            type="search"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
        </label>
      )}
      {active > 0 && (
        <button className="hidden h-[38px] rounded-xl px-2 text-sm font-semibold text-ink-3 hover:text-accent md:block" onClick={reset}>
          {t('filters.clear')}
        </button>
      )}
      </div>
    </div>
  );
}

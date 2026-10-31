import { useTranslation } from 'react-i18next';
import { useFilters } from '../lib/hooks';
import type { Filters } from '../stats/aggregate';

const TIME_CLASSES = ['bullet', 'blitz', 'rapid', 'classical', 'daily'] as const;
const PERIODS = [0, 30, 90, 365];

export default function FilterBar({ show }: { show: (keyof Filters)[] }) {
  const { t } = useTranslation();
  const { filters, setFilter } = useFilters();

  const select = <K extends keyof Filters>(key: K, label: string, options: [Filters[K], string][]) => (
    <label className="flex flex-col gap-1 text-xs text-ink-3">
      {label}
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
    <div className="flex flex-wrap items-end gap-3">
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
        select('period', t('filters.period'), PERIODS.map((p) => [p, t(`filters.periods.${p}`)]))}
      {show.includes('search') && (
        <label className="flex flex-col gap-1 text-xs text-ink-3">
          {t('filters.search')}
          <input
            className="input w-56"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
          />
        </label>
      )}
    </div>
  );
}

import { EmptyState, Loading } from '../components/State';
import TrainBanner from '../components/TrainBanner';
import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalysedIds, useAnalyses, useFilteredGames, useGames, useScope } from '../lib/hooks';
import { useAnalysisQueue } from '../engine/queue';
import FilterBar from '../components/FilterBar';
import PlatformIcon from '../components/PlatformIcon';
import ResultBadge from '../components/ResultBadge';
import { CpuIcon, TimeClassIcon } from '../components/icons';
import type { Game } from '../types';

const PAGE_SIZE = 50;

type SortKey = 'date' | 'accuracy' | 'opponent' | 'moves';
const SORT_KEYS: SortKey[] = ['date', 'accuracy', 'opponent', 'moves'];

export default function Games() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const scope = useScope();
  const all = useGames();
  const games = useFilteredGames();
  const analysedIds = useAnalysedIds();
  const analyses = useAnalyses();
  const enqueue = useAnalysisQueue((s) => s.enqueue);
  // The page lives in the URL so coming back from a game returns to it; changing a filter drops it.
  const [params, setParams] = useSearchParams();
  const page = Math.max(0, Number(params.get('page')) - 1) || 0;
  const setPage = (p: number) =>
    setParams((prev) => {
      const out = new URLSearchParams(prev);
      if (p) out.set('page', String(p + 1));
      else out.delete('page');
      return out;
    });

  // Sorting lives in the URL too (?sort=accuracy&dir=asc); the default, newest first, leaves it clean.
  const sortParam = params.get('sort') as SortKey | null;
  const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'date';
  const asc = params.get('dir') === 'asc';
  const setSort = (key: SortKey, ascending: boolean) =>
    setParams((prev) => {
      const out = new URLSearchParams(prev);
      out.delete('page');
      if (key === 'date' && !ascending) {
        out.delete('sort');
        out.delete('dir');
      } else {
        out.set('sort', key);
        out.set('dir', ascending ? 'asc' : 'desc');
      }
      return out;
    });
  /** Clicking the active column flips the direction; another column starts descending. */
  const toggleSort = (key: SortKey) => setSort(key, key === sort ? !asc : false);

  const sorted = useMemo(() => {
    if (!games) return [];
    const value = (g: Game): number | undefined => {
      if (sort === 'date') return g.endTime;
      if (sort === 'moves') return g.moves.length;
      if (sort === 'opponent') return (g.userColor === 'white' ? g.black : g.white).rating ?? undefined;
      const a = analyses?.get(g.id);
      return (a ? a.accuracy[g.userColor] : g.platformAccuracy?.[g.userColor]) ?? undefined;
    };
    const dir = asc ? 1 : -1;
    // Games without a value always go last, whichever the direction.
    return [...games].sort((x, y) => {
      const a = value(x);
      const b = value(y);
      if (a === undefined || b === undefined) return a === b ? 0 : a === undefined ? 1 : -1;
      return (a - b) * dir || y.endTime - x.endTime;
    });
  }, [games, analyses, sort, asc]);

  const pending = useMemo(
    () => (games && analysedIds ? games.filter((g) => !analysedIds.has(g.id)) : []),
    [games, analysedIds],
  );

  if (!all || !games) return <Loading />;
  if (!all.length)
    return (
      <EmptyState>
        {t('games.empty')} <Link className="text-accent underline" to={scope ? '/friends' : '/accounts'}>{t(scope ? 'nav.friends' : 'nav.accounts')}</Link>
      </EmptyState>
    );

  const pages = Math.max(1, Math.ceil(games.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = sorted.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });
  const short = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: 'numeric', month: 'short' });

  const accuracyOf = (g: Game) => {
    const a = analyses?.get(g.id);
    if (a) return { white: a.accuracy.white, black: a.accuracy.black, platform: false };
    if (g.platformAccuracy?.white !== undefined)
      return { white: g.platformAccuracy.white, black: g.platformAccuracy.black, platform: true };
    return null;
  };

  const open = (g: Game) => navigate(`/game/${encodeURIComponent(g.id)}`);
  const accuracyCell = (g: Game) => {
    const acc = accuracyOf(g);
    if (!acc) return <span className="text-ink-3">–</span>;
    const mine = acc[g.userColor];
    return (
      <span className={`tabular inline-flex items-center gap-1 ${acc.platform ? 'text-ink-3 italic' : 'font-semibold text-ink'}`} title={t(acc.platform ? 'games.platformAccuracyHint' : 'games.analysed')}>
        {!acc.platform && <CpuIcon className="h-3 w-3 text-accent" />}
        {mine?.toFixed(1) ?? '–'}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{t('games.title')}</h1>
          <p className="text-sm text-ink-3">{t('games.count', { count: games.length })}</p>
        </div>
        <button className="btn-primary" disabled={!pending.length} onClick={() => enqueue(pending.map((g) => g.id))}>
          {pending.length ? t('games.analyzePending', { count: pending.length }) : t('games.allAnalyzed')}
        </button>
      </div>
      {!scope && <TrainBanner />}
      <FilterBar show={['rated', 'source', 'timeClass', 'color', 'outcome', 'period', 'search']} />

      {/* Phones have no column headers: a select and a direction button do the same. */}
      {!!games.length && (
        <div className="flex items-center gap-2 md:hidden">
          <label className="flex flex-1 items-center gap-2 text-xs text-ink-3">
            <span className="shrink-0">{t('games.sortBy')}</span>
            <select className="input min-w-0 flex-1" value={sort} onChange={(e) => setSort(e.target.value as SortKey, asc)}>
              {SORT_KEYS.map((k) => (
                <option key={k} value={k}>{t(`games.sort.${k}`)}</option>
              ))}
            </select>
          </label>
          <button className="btn-ghost h-[38px] w-10 px-0" aria-label={t(asc ? 'games.sortAsc' : 'games.sortDesc')} onClick={() => setSort(sort, !asc)}>
            {asc ? '↑' : '↓'}
          </button>
        </div>
      )}

      {!games.length ? (
        <EmptyState compact>{t('games.noMatch')}</EmptyState>
      ) : (
        <>
          {/* Phones: one card per game. */}
          <ul className="space-y-2 md:hidden">
            {shown.map((g) => {
              const opp = g.userColor === 'white' ? g.black : g.white;
              return (
                <li key={g.id}>
                  <button onClick={() => open(g)} className="panel flex w-full items-center gap-3 p-3 text-left transition-colors active:bg-panel-2">
                    <ResultBadge outcome={g.outcome} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${g.userColor === 'white' ? 'bg-ink' : 'bg-panel ring-1 ring-ink-3'}`} />
                        <span className="truncate font-semibold">{opp.name}</span>
                        {opp.rating && <span className="tabular text-xs text-ink-3">{opp.rating}</span>}
                      </div>
                      <div className="truncate text-xs text-ink-3">{g.opening.name ?? t('common.unknown')}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm">{accuracyCell(g)}</div>
                      <div className="flex items-center justify-end gap-1 text-[11px] text-ink-3">
                        <TimeClassIcon timeClass={g.timeClass} className="h-3.5 w-3.5" />
                        {short.format(g.endTime)}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="panel hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-line">
                  <th className="w-20 px-4 py-3" />
                  <SortTh k="opponent" label={t('games.players')} sort={sort} asc={asc} onSort={toggleSort} />
                  <th className="eyebrow px-3 py-3">{t('games.result')}</th>
                  <SortTh k="accuracy" label={t('common.accuracy')} sort={sort} asc={asc} onSort={toggleSort} right />
                  <th className="eyebrow px-3 py-3">{t('games.opening')}</th>
                  <SortTh k="moves" label={t('common.moves')} sort={sort} asc={asc} onSort={toggleSort} right />
                  <SortTh k="date" label={t('games.date')} sort={sort} asc={asc} onSort={toggleSort} right last />
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => (
                  <tr
                    key={g.id}
                    tabIndex={0}
                    onClick={() => open(g)}
                    onKeyDown={(e) => e.key === 'Enter' && open(g)}
                    className="group cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none"
                  >
                    <td className="relative px-4 py-2.5">
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" />
                      <div className="flex items-center gap-2" title={`${t(`platform.${g.source}`)} · ${t(`timeClass.${g.timeClass}`)} ${g.timeControl}`}>
                        <TimeClassIcon timeClass={g.timeClass} className="h-5 w-5 text-ink-2" />
                        <PlatformIcon source={g.source} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {(['white', 'black'] as const).map((c) => (
                        <div key={c} className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-[3px] ${c === 'white' ? 'bg-ink' : 'bg-panel ring-1 ring-ink-3'}`} />
                          <span className={g.userColor === c ? 'font-semibold text-ink' : 'text-ink-2'}>{g[c].name}</span>
                          {g[c].rating && <span className="tabular text-xs text-ink-3">{g[c].rating}</span>}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2.5"><ResultBadge outcome={g.outcome} /></td>
                    <td className="px-3 py-2.5 text-right">{accuracyCell(g)}</td>
                    <td className="max-w-xs truncate px-3 py-2.5 text-ink-2" title={g.opening.name}>
                      {g.opening.eco && <span className="mr-1.5 font-mono text-xs text-ink-3">{g.opening.eco}</span>}
                      {g.opening.name ?? t('common.unknown')}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-ink-2">{Math.ceil(g.moves.length / 2)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap text-ink-3">{date.format(g.endTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn-ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>← {t('games.prev')}</button>
          <span className="tabular text-ink-3">{t('games.page', { page: current + 1, pages })}</span>
          <button className="btn-ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>{t('games.next')} →</button>
        </div>
      )}
    </div>
  );
}

function SortTh({ k, label, sort, asc, onSort, right, last }: { k: SortKey; label: string; sort: SortKey; asc: boolean; onSort: (k: SortKey) => void; right?: boolean; last?: boolean }) {
  const active = sort === k;
  return (
    <th className={`py-3 ${last ? 'px-4' : 'px-3'} ${right ? 'text-right' : ''}`} aria-sort={active ? (asc ? 'ascending' : 'descending') : 'none'}>
      <button
        className={`eyebrow inline-flex items-center gap-1 transition-colors hover:text-ink ${active ? 'text-ink' : ''}`}
        onClick={() => onSort(k)}
      >
        {label}
        <span aria-hidden className={active ? 'text-accent' : 'opacity-0'}>{asc ? '↑' : '↓'}</span>
      </button>
    </th>
  );
}

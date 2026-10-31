import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalysedIds, useAnalyses, useFilteredGames, useFilters, useGames, useScope } from '../lib/hooks';
import { useAnalysisQueue } from '../engine/queue';
import FilterBar from '../components/FilterBar';
import PlatformIcon from '../components/PlatformIcon';
import ResultBadge from '../components/ResultBadge';
import { TimeClassIcon } from '../components/icons';
import type { Game } from '../types';

const PAGE_SIZE = 50;

export default function Games() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const scope = useScope();
  const all = useGames();
  const games = useFilteredGames();
  const analysedIds = useAnalysedIds();
  const analyses = useAnalyses();
  const { filters } = useFilters();
  const enqueue = useAnalysisQueue((s) => s.enqueue);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [filters]);

  const pending = useMemo(
    () => (games && analysedIds ? games.filter((g) => !analysedIds.has(g.id)) : []),
    [games, analysedIds],
  );

  if (!all || !games) return <p className="text-ink-3">{t('common.loading')}</p>;
  if (!all.length)
    return (
      <div className="panel p-8 text-center text-ink-2">
        {t('games.empty')} <Link className="text-accent underline" to={scope ? '/friends' : '/'}>{t(scope ? 'nav.friends' : 'nav.accounts')}</Link>
      </div>
    );

  const pages = Math.max(1, Math.ceil(games.length / PAGE_SIZE));
  const shown = games.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });

  const accuracyOf = (g: Game) => {
    const a = analyses?.get(g.id);
    if (a) return { white: a.accuracy.white, black: a.accuracy.black, platform: false };
    if (g.platformAccuracy?.white !== undefined)
      return { white: g.platformAccuracy.white, black: g.platformAccuracy.black, platform: true };
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t('games.title')}</h1>
          <p className="text-sm text-ink-3">{t('games.count', { count: games.length })}</p>
        </div>
        <button
          className="btn-primary"
          disabled={!pending.length}
          onClick={() => enqueue(pending.map((g) => g.id))}
        >
          {pending.length ? t('games.analyzePending', { count: pending.length }) : t('games.allAnalyzed')}
        </button>
      </div>
      <FilterBar show={['rated', 'source', 'timeClass', 'color', 'outcome', 'period', 'search']} />

      {!games.length ? (
        <p className="panel p-6 text-center text-ink-2">{t('games.noMatch')}</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-panel-2/50 text-left text-[11px] uppercase tracking-wider text-ink-3">
              <tr className="border-b border-line">
                <th className="w-20 px-3 py-2" />
                <th className="px-3 py-2">{t('games.players')}</th>
                <th className="px-3 py-2">{t('games.result')}</th>
                <th className="px-3 py-2 text-right">{t('common.accuracy')}</th>
                <th className="px-3 py-2">{t('games.opening')}</th>
                <th className="px-3 py-2 text-right">{t('common.moves')}</th>
                <th className="px-3 py-2 text-right">{t('games.date')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((g) => {
                const acc = accuracyOf(g);
                return (
                  <tr
                    key={g.id}
                    tabIndex={0}
                    onClick={() => navigate(`/game/${encodeURIComponent(g.id)}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/game/${encodeURIComponent(g.id)}`)}
                    className="cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-white/[0.04] focus:bg-white/[0.06] focus:outline-none"
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2" title={`${t(`platform.${g.source}`)} · ${t(`timeClass.${g.timeClass}`)} ${g.timeControl}`}>
                        <TimeClassIcon timeClass={g.timeClass} className="h-5 w-5" />
                        <PlatformIcon source={g.source} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {(['white', 'black'] as const).map((c) => (
                        <div key={c} className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-[3px] ${c === 'white' ? 'bg-ink' : 'bg-panel-2 ring-1 ring-ink-3'}`} />
                          <span className={g.userColor === c ? 'font-semibold' : 'text-ink-2'}>{g[c].name}</span>
                          {g[c].rating && <span className="tabular text-ink-3">({g[c].rating})</span>}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2"><ResultBadge outcome={g.outcome} /></td>
                    <td
                      className={`tabular px-3 py-2 text-right ${acc?.platform ? 'italic' : ''}`}
                      title={acc?.platform ? t('games.platformAccuracyHint') : undefined}
                    >
                      {acc ? (
                        <>
                          {(['white', 'black'] as const).map((c) => (
                            <div key={c} className={g.userColor === c && !acc.platform ? 'font-semibold text-ink' : 'text-ink-3'}>
                              {acc[c]?.toFixed(1) ?? '–'}
                            </div>
                          ))}
                        </>
                      ) : (
                        '–'
                      )}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-ink-2" title={g.opening.name}>
                      {g.opening.eco && <span className="mr-1 text-ink-3">{g.opening.eco}</span>}
                      {g.opening.name ?? t('common.unknown')}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-ink-2">{Math.ceil(g.moves.length / 2)}</td>
                    <td className="px-3 py-2 text-right text-ink-3">{date.format(g.endTime)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('games.prev')}</button>
          <span className="text-ink-3">{t('games.page', { page: page + 1, pages })}</span>
          <button className="btn-ghost" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>{t('games.next')}</button>
        </div>
      )}
    </div>
  );
}

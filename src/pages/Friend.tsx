import { useMemo } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ScopeContext, useAnalyses, useScope, useScopeGames } from '../lib/hooks';
import { useAnalysisQueue } from '../engine/queue';
import { AccountList } from '../components/AccountManager';
import PlatformIcon from '../components/PlatformIcon';
import ResultBadge from '../components/ResultBadge';
import WdlBar from '../components/charts/WdlBar';
import MonthlyResults from '../components/charts/MonthlyResults';
import { TimeClassIcon } from '../components/icons';
import { Block } from './stats/layout';
import { Empty, Figure, WdlFigures, WdlRows } from './stats/shared';
import { groupWdl, opponent, resultsByMonth, scorePct } from '../stats/aggregate';
import { gamesAgainst, headToHead } from '../stats/headToHead';
import type { Color, TimeClass } from '../types';

const TIME_ORDER: TimeClass[] = ['bullet', 'blitz', 'rapid', 'classical', 'daily'];
const RECENT = 50;

/** A friend's page: head to head against the user, plus the friend's own games and stats (kept apart from the user's). */
export default function Friend() {
  const { t } = useTranslation();
  const name = decodeURIComponent(useParams().friend ?? '');
  const accounts = useLiveQuery(() => db.accounts.filter((a) => a.friend === name).toArray(), [name]);
  const tab = 'segmented-item';

  if (!accounts) return <p className="text-ink-3">{t('common.loading')}</p>;
  if (!accounts.length)
    return (
      <div className="panel p-8 text-center text-ink-2">
        {t('friends.notFound')} <Link className="text-accent underline" to="/friends">{t('nav.friends')}</Link>
      </div>
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <Link to="/friends" className="text-xs text-ink-3 hover:text-ink">← {t('nav.friends')}</Link>
          <h1 className="font-display text-3xl font-bold">{name}</h1>
        </div>
        <nav className="segmented max-sm:w-full">
          <NavLink to="" end className={tab}>{t('friends.headToHead')}</NavLink>
          <NavLink to="games" className={tab}>{t('nav.games')}</NavLink>
          <NavLink to="stats" className={tab}>{t('nav.stats')}</NavLink>
        </nav>
      </div>
      <ScopeContext value={name}>
        <Outlet />
      </ScopeContext>
    </div>
  );
}

/** The user's games against the friend in scope, from the user's own accounts. */
export function HeadToHeadView() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const name = useScope()!;
  const accounts = useLiveQuery(() => db.accounts.filter((a) => a.friend === name).toArray(), [name]);
  const myGames = useScopeGames(undefined);
  const analyses = useAnalyses();
  const enqueue = useAnalysisQueue((s) => s.enqueue);

  const d = useMemo(() => {
    if (!accounts || !myGames || !analyses) return undefined;
    const games = gamesAgainst(myGames, accounts);
    return {
      games,
      h2h: headToHead(games, analyses),
      byTime: groupWdl(games, (g) => g.timeClass),
      byColor: groupWdl(games, (g) => g.userColor),
      months: resultsByMonth(games),
      pending: games.filter((g) => !analyses.has(g.id)).map((g) => g.id),
    };
  }, [accounts, myGames, analyses]);

  if (!d || !accounts) return <p className="text-ink-3">{t('common.loading')}</p>;
  const { games, h2h } = d;
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });
  const fmt = (v?: number) => (v === undefined ? '–' : v.toFixed(1));

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-5">
        {!games.length ? (
          <p className="panel p-6 text-center text-ink-2">{t('friends.noGamesTogetherHint', { name })}</p>
        ) : (
          <>
            <section className="panel divide-y divide-line overflow-hidden">
              <Block title={t('friends.youVs', { name })} subtitle={t('friends.fromYourAccounts')}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Figure value={String(h2h.wdl.games)} label={t('friends.score', { score: scorePct(h2h.wdl).toFixed(1) })} />
                  <div className="min-w-72 flex-1 space-y-2">
                    <WdlFigures wdl={h2h.wdl} />
                    <WdlBar wdl={h2h.wdl} showLabels={false} />
                  </div>
                </div>
                {d.months.length > 1 && <MonthlyResults data={d.months} />}
              </Block>

              <Block
                title={t('common.accuracy')}
                subtitle={t('stats.analyzedCount', { count: h2h.analysedCount, total: games.length })}
                aside={
                  d.pending.length > 0 && (
                    <button className="btn-primary" onClick={() => enqueue(d.pending)}>
                      {t('stats.analyzePending', { count: d.pending.length })}
                    </button>
                  )
                }
              >
                {!h2h.accuracy ? (
                  <Empty>{t('friends.needsAnalysis')}</Empty>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-8">
                      <Figure value={fmt(h2h.accuracy.me)} label={t('friends.you')} />
                      <Figure value={fmt(h2h.accuracy.friend)} label={name} />
                    </div>
                    <div className="text-right text-sm text-ink-2">
                      <div>{t('friends.moreAccurate', { count: h2h.moreAccurate })}</div>
                      <div>{t('friends.lessAccurate', { name, count: h2h.lessAccurate })}</div>
                    </div>
                  </div>
                )}
              </Block>

              <Block title={t('stats.byTimeClass')}>
                <WdlRows
                  rows={TIME_ORDER.flatMap((tc) => {
                    const w = d.byTime.get(tc);
                    return w ? [{ label: t(`timeClass.${tc}`), wdl: w }] : [];
                  })}
                />
              </Block>
              <Block title={t('stats.byColor')}>
                <WdlRows
                  rows={(['white', 'black'] as Color[]).flatMap((c) => {
                    const w = d.byColor.get(c);
                    return w ? [{ label: t(`common.${c}`), wdl: w }] : [];
                  })}
                />
              </Block>
            </section>

            <section className="panel overflow-hidden">
              <h2 className="border-b border-line bg-panel-2/40 px-5 py-3 font-semibold">{t('friends.gamesTogether')}</h2>
              <ul className="divide-y divide-line/60">
                {games.slice(0, RECENT).map((g) => {
                  const a = analyses?.get(g.id);
                  const opp = g.userColor === 'white' ? 'black' : 'white';
                  return (
                    <li key={g.id}>
                      <button
                        className="flex w-full items-center gap-3 px-5 py-2 text-left text-sm hover:bg-white/[0.04]"
                        onClick={() => navigate(`/game/${encodeURIComponent(g.id)}`)}
                      >
                        <ResultBadge outcome={g.outcome} />
                        <TimeClassIcon timeClass={g.timeClass} className="h-5 w-5" />
                        <PlatformIcon source={g.source} />
                        <span className={`h-2.5 w-2.5 rounded-[3px] ${g.userColor === 'white' ? 'bg-ink' : 'bg-panel-2 ring-1 ring-ink-3'}`} title={t(`common.${g.userColor}`)} />
                        <span className="min-w-0 flex-1 truncate text-ink-2" title={g.opening.name}>
                          {g.opening.name ?? t('common.unknown')}
                        </span>
                        {a && (
                          <span className="tabular text-xs text-ink-3" title={`${t('friends.you')} / ${opponent(g).name}`}>
                            <span className="font-semibold text-ink">{a.accuracy[g.userColor].toFixed(1)}</span> / {a.accuracy[opp].toFixed(1)}
                          </span>
                        )}
                        <span className="w-24 text-right text-xs text-ink-3">{date.format(g.endTime)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>

      <aside className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-2">{t('friends.accountsOf', { name })}</h2>
        <AccountList accounts={accounts} />
      </aside>
    </div>
  );
}

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAnalyses, useAnalysedIds, useGames } from '../lib/hooks';
import { useAnalysisQueue } from '../engine/queue';
import { averageAccuracy, opponent, ratingHistory, scorePct, summarize } from '../stats/aggregate';
import TrainBanner from '../components/TrainBanner';
import ResultBadge from '../components/ResultBadge';
import PlatformIcon from '../components/PlatformIcon';
import WdlBar from '../components/charts/WdlBar';
import { Loading } from '../components/State';
import { TimeClassIcon } from '../components/icons';
import { Delta } from '../components/puzzle/Bits';
import type { Game } from '../types';

const DAY = 86_400_000;
const WINDOW_DAYS = 30;
const RECENT = 6;

/** Landing page for returning users: where things stand, what is pending, and the way back into a game. */
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const games = useGames();
  const analyses = useAnalyses();
  const analysedIds = useAnalysedIds();
  const enqueue = useAnalysisQueue((s) => s.enqueue);
  const lastRated = useLiveQuery(() => db.puzzleAttempts.where('mode').equals('rated').last(), []);
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { day: 'numeric', month: 'short' });

  const d = useMemo(() => {
    if (!games || !analyses) return null;
    const since = Date.now() - WINDOW_DAYS * DAY;
    const recent = games.filter((g) => g.endTime >= since);
    // One card per platform and time control the user plays rated games in; delta is the change over the window.
    const ratings = ratingHistory(games)
      .slice(0, 3)
      .map((s) => {
        const last = s.points[s.points.length - 1];
        const before = [...s.points].reverse().find((p) => p.t < since) ?? s.points[0];
        return { ...s, rating: last.rating, delta: last.rating - before.rating };
      });
    return { recent, wdl: summarize(recent), accuracy: averageAccuracy(recent, analyses), ratings };
  }, [games, analyses]);

  if (!games || !d || !analysedIds) return <Loading />;

  const pending = games.filter((g) => !analysedIds.has(g.id));
  const latest = games.slice(0, RECENT);
  const puzzleRating = lastRated?.ratingAfter;

  const card = 'panel p-4';
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t('dashboard.title')}</h1>
          <p className="text-sm text-ink-3">{t('dashboard.subtitle', { count: games.length })}</p>
        </div>
        <Link to="/settings#accounts" className="btn-ghost">{t('nav.accounts')}</Link>
      </header>

      <TrainBanner />

      {pending.length > 0 && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 border-accent/30 px-4 py-3">
          <p className="text-sm text-ink-2">{t('dashboard.pending', { count: pending.length })}</p>
          <button className="btn-primary" onClick={() => enqueue(pending.map((g) => g.id))}>
            {t('games.analyzePending', { count: pending.length })}
          </button>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${card} space-y-2 sm:col-span-2`}>
          <div className="eyebrow">{t('dashboard.lastDays', { count: WINDOW_DAYS })}</div>
          {d.wdl.games ? (
            <>
              <div className="flex items-baseline gap-5">
                <Figure value={String(d.wdl.games)} label={t('stats.totalGames')} />
                <Figure value={`${scorePct(d.wdl).toFixed(0)}%`} label={t('dashboard.score')} />
                <Figure value={d.accuracy === undefined ? '–' : d.accuracy.toFixed(1)} label={t('common.accuracy')} />
              </div>
              <WdlBar wdl={d.wdl} showLabels={false} />
            </>
          ) : (
            <p className="text-sm text-ink-3">{t('dashboard.noRecent')}</p>
          )}
        </div>

        <div className={`${card} space-y-2`}>
          <div className="eyebrow">{t('dashboard.ratings')}</div>
          {d.ratings.length ? (
            <ul className="space-y-1.5">
              {d.ratings.map((r) => (
                <li key={r.key} className="flex items-center gap-2 text-sm">
                  <PlatformIcon source={r.source} />
                  <TimeClassIcon timeClass={r.timeClass} className="h-4 w-4 text-ink-2" />
                  <span className="tabular font-display text-lg font-bold">{r.rating}</span>
                  <span className="ml-auto text-xs">{r.delta ? <Delta value={r.delta} /> : <span className="text-ink-3">0</span>}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-3">{t('dashboard.noRatings')}</p>
          )}
        </div>

        <Link to="/puzzles" className={`${card} block space-y-2 transition-colors hover:bg-white/[0.04]`}>
          <div className="eyebrow">{t('dashboard.puzzles')}</div>
          {puzzleRating ? (
            <div className="tabular font-display text-3xl font-bold">{Math.round(puzzleRating)}</div>
          ) : (
            <p className="text-sm text-ink-3">{t('dashboard.noPuzzles')}</p>
          )}
          <div className="text-xs text-accent">{t('dashboard.solve')} →</div>
        </Link>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('dashboard.latest')}</h2>
          <Link to="/games" className="text-sm text-accent">{t('dashboard.allGames')} →</Link>
        </div>
        <ul className="space-y-2">
          {latest.map((g) => (
            <li key={g.id}>
              <GameRow game={g} accuracy={analyses?.get(g.id)?.accuracy[g.userColor]} when={date.format(g.endTime)} onOpen={() => navigate(`/game/${encodeURIComponent(g.id)}`)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="tabular font-display text-3xl leading-none font-bold">{value}</div>
      <div className="mt-1 text-xs text-ink-3">{label}</div>
    </div>
  );
}

function GameRow({ game: g, accuracy, when, onOpen }: { game: Game; accuracy?: number; when: string; onOpen: () => void }) {
  const { t } = useTranslation();
  const opp = opponent(g);
  return (
    <button onClick={onOpen} className="panel flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-white/[0.04]">
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
        <div className="tabular text-sm">{accuracy === undefined ? <span className="text-ink-3">–</span> : <span className="font-semibold">{accuracy.toFixed(1)}</span>}</div>
        <div className="flex items-center justify-end gap-1 text-[11px] text-ink-3">
          <TimeClassIcon timeClass={g.timeClass} className="h-3.5 w-3.5" />
          {when}
        </div>
      </div>
    </button>
  );
}

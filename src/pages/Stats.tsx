import { useMemo } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyses, useFilteredGames, useGameFacts, useGames, useScope } from '../lib/hooks';
import { friendPath } from './Friends';
import { Deferred } from './stats/layout';
import { useAnalysisQueue } from '../engine/queue';
import FilterBar from '../components/FilterBar';
import { BoardIcon, BookIcon, CalendarIcon, TargetIcon } from '../components/icons';
import type { StatsData } from './stats/shared';
import { OverviewPanel, PhasePanel, ResultsPanel } from './stats/GamesPanels';
import { MasteryPanel, PerformancePanel } from './stats/OpeningPanels';
import { CastlingPanel, ClockPanel, PiecesPanel, QualityPanel } from './stats/MovePanels';
import { TimeOfDayPanel, WeekdayPanel } from './stats/CalendarPanels';

type Icon = (p: { className?: string }) => React.JSX.Element;

/** Sections of the stats page, each with its own URL (/stats/<id>). */
const SECTIONS: { id: string; icon: Icon }[] = [
  { id: 'games', icon: BoardIcon },
  { id: 'openings', icon: BookIcon },
  { id: 'moves', icon: TargetIcon },
  { id: 'calendar', icon: CalendarIcon },
];

export default function Stats() {
  const { t } = useTranslation();
  const scope = useScope();
  const { search } = useLocation();
  const param = useParams().section;
  const section = SECTIONS.find((s) => s.id === param)?.id ?? 'games';
  const all = useGames();
  const games = useFilteredGames();
  const analyses = useAnalyses();
  const { facts, done, total } = useGameFacts(games);
  const enqueue = useAnalysisQueue((s) => s.enqueue);
  const base = scope ? `${friendPath(scope)}/stats` : '/stats';

  const data = useMemo<StatsData | null>(() => {
    if (!games || !analyses) return null;
    return { games, analyses, facts, analysedCount: games.filter((g) => analyses.has(g.id)).length };
  }, [games, analyses, facts]);

  if (!all || !data) return <p className="text-ink-3">{t('common.loading')}</p>;
  if (!all.length)
    return (
      <div className="panel p-8 text-center text-ink-2">
        {t('games.empty')} <Link className="text-accent underline" to={scope ? '/friends' : '/accounts'}>{t(scope ? 'nav.friends' : 'nav.accounts')}</Link>
      </div>
    );

  const pending = data.games.filter((g) => !data.analyses.has(g.id)).map((g) => g.id);
  // The calendar needs neither engine analysis nor replayed facts.
  const needsAnalysis = section !== 'calendar';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{t('stats.title')}</h1>
          <p className="text-sm text-ink-3">{t('games.count', { count: data.games.length })}</p>
        </div>
        <FilterBar show={['rated', 'source', 'timeClass', 'color', 'period']} />
      </div>

      <nav className="sticky top-[var(--header-h)] z-10 -mx-3 overflow-x-auto bg-bg/85 px-3 py-2 backdrop-blur-xl [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="segmented w-max min-w-full sm:min-w-0">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              to={`${base}/${s.id}${search}`}
              aria-current={section === s.id ? 'page' : undefined}
              className="segmented-item"
            >
              <s.icon className="h-4 w-4" />
              {t(`statsNav.${s.id}`)}
            </Link>
          ))}
        </div>
      </nav>

      {!data.games.length ? (
        <p className="panel p-6 text-center text-ink-2">{t('stats.noGames')}</p>
      ) : (
        <div className="space-y-5">
          <p className="text-ink-2">{t(`statsNav.${section}Question`)}</p>

          {needsAnalysis && pending.length > 0 && (
            <div className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-60 flex-1">
                <div className="text-sm text-ink-2">{t('stats.analyzedCount', { count: data.analysedCount, total: data.games.length })}</div>
                <Meter value={data.analysedCount} total={data.games.length} />
                <div className="mt-1 text-xs text-ink-3">{t('stats.analyzedHint')}</div>
              </div>
              <button className="btn-primary" onClick={() => enqueue(pending)}>
                {t('stats.analyzePending', { count: pending.length })}
              </button>
            </div>
          )}

          {needsAnalysis && !facts && total > 0 && (
            <div className="panel px-5 py-3" role="status">
              <div className="flex justify-between text-sm text-ink-2">
                <span>{t('stats.preparing')}</span>
                <span className="tabular text-ink-3">{done}/{total}</span>
              </div>
              <Meter value={done} total={total} />
              <div className="mt-1 text-xs text-ink-3">{t('stats.preparingHint')}</div>
            </div>
          )}

          {section === 'games' && (
            <>
              <OverviewPanel {...data} />
              <Deferred><ResultsPanel {...data} /></Deferred>
              <Deferred><PhasePanel {...data} /></Deferred>
            </>
          )}
          {section === 'openings' && (
            <>
              <PerformancePanel {...data} />
              <Deferred><MasteryPanel {...data} /></Deferred>
            </>
          )}
          {section === 'moves' && (
            <>
              <QualityPanel {...data} />
              <Deferred><PiecesPanel {...data} /></Deferred>
              <Deferred><CastlingPanel {...data} /></Deferred>
              <Deferred><ClockPanel {...data} /></Deferred>
            </>
          )}
          {section === 'calendar' && (
            <>
              <TimeOfDayPanel {...data} />
              <Deferred><WeekdayPanel {...data} /></Deferred>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Meter({ value, total }: { value: number; total: number }) {
  return (
    <div className="meter mt-1.5">
      <div style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
    </div>
  );
}

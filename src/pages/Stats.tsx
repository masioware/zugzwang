import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyses, useFilteredGames, useFilters, useGameFacts, useGames } from '../lib/hooks';
import { useAnalysisQueue } from '../engine/queue';
import FilterBar from '../components/FilterBar';
import { BoardIcon, BookIcon, CalendarIcon, CastleIcon, ClockIcon, FlagIcon, MedalIcon, OverviewIcon, PieceIcon, TargetIcon, TrophyIcon } from '../components/icons';
import { GroupHeading, StatsNav, type NavGroup } from './stats/layout';
import type { StatsData } from './stats/shared';
import { OverviewPanel, PhasePanel, ResultsPanel } from './stats/GamesPanels';
import { MasteryPanel, PerformancePanel } from './stats/OpeningPanels';
import { CastlingPanel, ClockPanel, PiecesPanel, QualityPanel } from './stats/MovePanels';
import { TimeOfDayPanel, WeekdayPanel } from './stats/CalendarPanels';

const NAV: NavGroup[] = [
  { id: 'games', icon: BoardIcon, items: [{ id: 'overview', icon: OverviewIcon }, { id: 'results', icon: TrophyIcon }, { id: 'phase', icon: FlagIcon }] },
  { id: 'openings', icon: BookIcon, items: [{ id: 'performance', icon: TrophyIcon }, { id: 'mastery', icon: MedalIcon }] },
  {
    id: 'moves',
    icon: TargetIcon,
    items: [{ id: 'quality', icon: MedalIcon }, { id: 'pieces', icon: PieceIcon }, { id: 'castling', icon: CastleIcon }, { id: 'clock', icon: ClockIcon }],
  },
  { id: 'calendar', icon: CalendarIcon, items: [{ id: 'timeOfDay', icon: ClockIcon }, { id: 'weekday', icon: CalendarIcon }] },
];

export default function Stats() {
  const { t } = useTranslation();
  const all = useGames();
  const games = useFilteredGames();
  const analyses = useAnalyses();
  const facts = useGameFacts(games);
  const period = useFilters((s) => s.filters.period);
  const enqueue = useAnalysisQueue((s) => s.enqueue);

  const data = useMemo<StatsData | null>(() => {
    if (!games || !analyses) return null;
    return { games, analyses, facts, analysedCount: games.filter((g) => analyses.has(g.id)).length };
  }, [games, analyses, facts]);

  if (!all || !data) return <p className="text-ink-3">{t('common.loading')}</p>;
  if (!all.length)
    return (
      <div className="panel p-8 text-center text-ink-2">
        {t('games.empty')} <Link className="text-accent underline" to="/">{t('nav.accounts')}</Link>
      </div>
    );

  const pending = data.games.filter((g) => !data.analyses.has(g.id)).map((g) => g.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('stats.title')}</h1>
        <FilterBar show={['rated', 'source', 'timeClass', 'period']} />
      </div>

      {!data.games.length ? (
        <p className="panel p-6 text-center text-ink-2">{t('stats.noGames')}</p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0 space-y-5">
            {pending.length > 0 && (
              <div className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-60 flex-1">
                  <div className="text-sm text-ink-2">{t('stats.analyzedCount', { count: data.analysedCount, total: data.games.length })}</div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(data.analysedCount / data.games.length) * 100}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-ink-3">{t('stats.analyzedHint')}</div>
                </div>
                <button className="btn-primary" onClick={() => enqueue(pending)}>
                  {t('stats.analyzePending', { count: pending.length })}
                </button>
              </div>
            )}

            <GroupHeading id="games" icon={BoardIcon} />
            <OverviewPanel {...data} />
            <ResultsPanel {...data} />
            <PhasePanel {...data} />

            <GroupHeading id="openings" icon={BookIcon} />
            <PerformancePanel {...data} />
            <MasteryPanel {...data} />

            <GroupHeading id="moves" icon={TargetIcon} />
            <QualityPanel {...data} />
            <PiecesPanel {...data} />
            <CastlingPanel {...data} />
            <ClockPanel {...data} />

            <GroupHeading id="calendar" icon={CalendarIcon} />
            <TimeOfDayPanel {...data} />
            <WeekdayPanel {...data} />
          </div>

          <aside className="hidden lg:block lg:self-stretch">
            <StatsNav
              groups={NAV}
              header={
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{t('filters.period')}</div>
                    <div className="text-sm">{t(`filters.periods.${period}`)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{t('common.games')}</div>
                    <div className="tabular text-sm font-bold">{data.games.length}</div>
                  </div>
                </div>
              }
            />
          </aside>
        </div>
      )}
    </div>
  );
}

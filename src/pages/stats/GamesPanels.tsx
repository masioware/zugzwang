import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Block, Panel } from './layout';
import { Empty, Figure, Loading, NeedsAnalysis, PieceImg, WdlFigures, WdlRows, type StatsData } from './shared';
import WdlBar from '../../components/charts/WdlBar';
import MonthlyResults from '../../components/charts/MonthlyResults';
import AccuracyChart from '../../components/charts/AccuracyChart';
import AccuracyByMove from '../../components/charts/AccuracyByMove';
import RatingChart from '../../components/charts/RatingChart';
import StackedResults from '../../components/charts/StackedResults';
import ValueBars from '../../components/charts/ValueBars';
import ErrorTable from '../../components/charts/ErrorTable';
import { BookIcon, FlagIcon, OverviewIcon, TargetIcon, TrophyIcon } from '../../components/icons';
import {
  accuracyOverTime,
  averageAccuracy,
  errorsByPhase,
  groupWdl,
  ratingHistory,
  resultsByMonth,
  summarize,
  terminations,
} from '../../stats/aggregate';
import { accuracyByMoveNumber, accuracyByResult, byEndPhase, byOpponentRating, PHASES } from '../../stats/insights';
import type { Color, Phase, TimeClass } from '../../types';

const TIME_ORDER: TimeClass[] = ['bullet', 'blitz', 'rapid', 'classical', 'daily'];

/** Icon for each game phase, drawn with the user's piece set. */
export function PhaseIcon({ phase, className = 'h-7 w-7' }: { phase: Phase; className?: string }) {
  if (phase === 'opening') return <BookIcon className={`${className} text-ink-2`} />;
  return <PieceImg piece={phase === 'middlegame' ? 'n' : 'k'} className={className} />;
}

export function OverviewPanel({ games, analyses, analysedCount }: StatsData) {
  const { t } = useTranslation();
  const d = useMemo(
    () => ({
      total: summarize(games),
      months: resultsByMonth(games),
      avg: averageAccuracy(games, analyses),
      byResult: accuracyByResult(games, analyses),
      overTime: accuracyOverTime(games, analyses),
      byMove: accuracyByMoveNumber(games, analyses),
    }),
    [games, analyses],
  );
  const fmt = (v?: number) => (v === undefined ? undefined : v.toFixed(1));

  return (
    <Panel id="overview" icon={OverviewIcon}>
      <Block title={t('stats.gamesPlayed')}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Figure value={String(d.total.games)} label={t('stats.totalGames')} />
          <div className="min-w-72 flex-1 space-y-2">
            <WdlFigures wdl={d.total} />
            <WdlBar wdl={d.total} showLabels={false} />
          </div>
        </div>
        {d.months.length > 1 && <MonthlyResults data={d.months} />}
      </Block>

      <Block title={t('stats.avgAccuracy')} subtitle={t('stats.analyzedCount', { count: analysedCount, total: games.length })}>
        {!analysedCount ? (
          <NeedsAnalysis />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Figure icon={<TargetIcon className="h-9 w-9 text-ink-3" />} value={fmt(d.avg) ?? '–'} />
              <WdlFigures values={{ win: fmt(d.byResult.win), draw: fmt(d.byResult.draw), loss: fmt(d.byResult.loss) }} />
            </div>
            <AccuracyChart data={d.overTime} />
          </>
        )}
      </Block>

      <Block title={t('stats.accuracyByMove')} subtitle={t('stats.accuracyByMoveHint')}>
        {!analysedCount ? <NeedsAnalysis /> : <AccuracyByMove data={d.byMove} />}
      </Block>
    </Panel>
  );
}

export function ResultsPanel({ games, analyses }: StatsData) {
  const { t } = useTranslation();
  const d = useMemo(
    () => ({
      byColor: groupWdl(games, (g) => g.userColor),
      byTime: groupWdl(games, (g) => g.timeClass),
      byOpponent: byOpponentRating(games, analyses),
      endings: terminations(games),
      ratings: ratingHistory(games),
    }),
    [games, analyses],
  );

  return (
    <Panel id="results" icon={TrophyIcon}>
      <Block title={t('stats.byColor')}>
        <WdlRows
          rows={(['white', 'black'] as Color[]).flatMap((c) => {
            const w = d.byColor.get(c);
            return w ? [{ label: t(`common.${c}`), wdl: w }] : [];
          })}
        />
      </Block>
      <Block title={t('stats.byTimeClass')}>
        <WdlRows
          rows={TIME_ORDER.flatMap((tc) => {
            const w = d.byTime.get(tc);
            return w ? [{ label: t(`timeClass.${tc}`), wdl: w }] : [];
          })}
        />
      </Block>
      <Block title={t('stats.byOpponentRating')} subtitle={t('stats.byOpponentRatingHint')}>
        {d.byOpponent.length ? <StackedResults rows={d.byOpponent} label={(k) => k} /> : <Empty>{t('stats.noGames')}</Empty>}
      </Block>
      <Block title={t('stats.terminations')}>
        <Endings endings={d.endings} />
      </Block>
      {d.ratings.length > 0 && (
        <Block title={t('stats.ratingHistory')}>
          <RatingChart series={d.ratings} />
        </Block>
      )}
    </Panel>
  );
}

export function PhasePanel({ games, analyses, facts, analysedCount }: StatsData) {
  const { t } = useTranslation();
  const ended = useMemo(() => (facts ? byEndPhase(games, analyses, facts) : undefined), [games, analyses, facts]);
  const errors = useMemo(() => errorsByPhase(games, analyses), [games, analyses]);
  const total = ended?.reduce((s, b) => s + b.games, 0) ?? 0;

  return (
    <Panel id="phase" icon={FlagIcon}>
      <Block title={t('stats.endedIn')}>
        {!ended ? (
          <Loading />
        ) : (
          <div className="space-y-1">
            {ended.map((b, i) => {
              const pct = total ? (b.games / total) * 100 : 0;
              const before = ended.slice(0, i).reduce((s, x) => s + (total ? (x.games / total) * 100 : 0), 0);
              return (
                <div key={b.key} className="grid grid-cols-[2.25rem_7rem_1fr] items-center gap-3">
                  <PhaseIcon phase={b.key as Phase} />
                  <div>
                    <div className="text-sm font-semibold">{t(`phase.${b.key}`)}</div>
                    <div className="tabular text-xs text-ink-3">{b.games}</div>
                  </div>
                  {/* Segments laid end to end, like a stacked bar split across rows. */}
                  <div className="relative h-9 rounded bg-white/[0.03]">
                    <div
                      className="absolute inset-y-0 flex items-center justify-center rounded bg-[#5e5a78] text-xs font-semibold text-white"
                      style={{ left: `${before}%`, width: `${pct}%`, minWidth: pct ? 3 : 0 }}
                    >
                      {pct >= 6 ? `${pct.toFixed(1)}%` : ''}
                    </div>
                    {/* Small shares get their label outside the segment, on whichever side has room. */}
                    {pct < 6 && (
                      <span
                        className="tabular absolute inset-y-0 flex items-center px-1.5 text-xs text-ink-2"
                        style={before + pct > 85 ? { right: `${100 - before}%` } : { left: `${before + pct}%` }}
                      >
                        {pct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Block>

      <Block title={t('stats.accuracyByPhase')}>
        {!analysedCount ? (
          <NeedsAnalysis />
        ) : (
          <ValueBars
            rows={PHASES.map((p) => {
              const e = errors.find((x) => x.key === p);
              return { key: p, value: e?.accuracy, note: e ? t('stats.movesCount', { count: e.moves }) : undefined };
            })}
            label={(k) => t(`phase.${k}`)}
            tick={(k) => <PhaseIcon phase={k as Phase} className="h-5 w-5" />}
            seriesLabel={t('common.accuracy')}
            highlightExtremes
          />
        )}
      </Block>

      <Block title={t('stats.resultsByEndPhase')}>
        {!ended ? (
          <Loading />
        ) : (
          <StackedResults rows={ended} label={(k) => t(`phase.${k}`)} tick={(k) => <PhaseIcon phase={k as Phase} className="h-5 w-5" />} />
        )}
      </Block>

      <Block title={t('stats.errorsByPhase')} subtitle={t('stats.per100Title')}>
        {!analysedCount ? <NeedsAnalysis /> : <ErrorTable buckets={errors} label={(k) => t(`phase.${k}`)} />}
      </Block>
    </Panel>
  );
}

function Endings({ endings }: { endings: ReturnType<typeof terminations> }) {
  const { t } = useTranslation();
  const max = Math.max(1, ...endings.map((e) => Math.max(e.win, e.draw, e.loss)));
  const list = (key: 'win' | 'draw' | 'loss') => {
    const items = endings.filter((e) => e[key]).sort((a, b) => b[key] - a[key]);
    const sum = items.reduce((s, e) => s + e[key], 0);
    return (
      <div>
        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{t(`stats.endedBy.${key}`)}</h5>
        {!items.length ? (
          <p className="text-sm text-ink-3">–</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((e) => (
              <li key={e.termination} className="grid grid-cols-[minmax(0,8.5rem)_1fr_3rem] items-center gap-2 text-sm">
                <span className="truncate text-ink-2" title={t(`termination.${e.termination}`)}>{t(`termination.${e.termination}`)}</span>
                <div className={`h-3 rounded-r ${key === 'win' ? 'bg-win' : key === 'draw' ? 'bg-draw' : 'bg-loss'}`} style={{ width: `${(e[key] / max) * 100}%` }} />
                <span className="tabular text-right text-xs">
                  {Math.round((e[key] / sum) * 100)}% <span className="text-ink-3">({e[key]})</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {list('win')}
      {list('draw')}
      {list('loss')}
    </div>
  );
}

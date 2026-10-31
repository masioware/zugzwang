import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import PuzzleTabs from '../components/puzzle/PuzzleTabs';
import Section from '../components/puzzle/Section';
import ValueBars from '../components/charts/ValueBars';
import { SERIES } from '../components/charts/theme';
import { ActivityChart, PuzzleRatingChart } from '../components/charts/PuzzleCharts';
import { Block, Toggle } from './stats/layout';
import { Empty, Figure } from './stats/shared';
import { pieceUrl, useSettings } from '../lib/settings';
import { byColor, byLength, byPhase, byRating, byTheme, byTime, daily, ratingHistory, summary, TIME_BUCKETS, type Group } from '../puzzles/stats';
import { formatSeconds } from '../puzzles/format';
import type { PuzzleAttempt } from '../types';

type ModeFilter = 'all' | 'free' | 'woodpecker';
const PERIODS = [7, 30, 90, 0];
const THEMES_SHOWN = 10;

export default function PuzzleStats() {
  const { t } = useTranslation();
  const all = useLiveQuery(() => db.puzzleAttempts.toArray(), []);
  const [mode, setMode] = useState<ModeFilter>('all');
  const [period, setPeriod] = useState(30);

  const attempts = useMemo(() => {
    const since = period ? Date.now() - period * 86_400_000 : 0;
    return (all ?? []).filter(
      (a) => a.startedAt >= since && (mode === 'all' || (mode === 'woodpecker' ? a.mode === 'woodpecker' : a.mode !== 'woodpecker')),
    );
  }, [all, mode, period]);

  if (!all) return <p className="text-ink-3">{t('common.loading')}</p>;

  return (
    <>
      <PuzzleTabs />
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-2xl font-bold">{t('puzzleStats.title')}</h1>
          <div className="flex flex-wrap items-center gap-6">
            <Toggle
              value={mode}
              onChange={setMode}
              options={[
                ['all', t('puzzleStats.modeAll')],
                ['free', t('puzzleStats.modeFree')],
                ['woodpecker', t('puzzles.tabs.woodpecker')],
              ]}
            />
            <select className="input" value={period} onChange={(e) => setPeriod(Number(e.target.value))} aria-label={t('puzzleStats.period')}>
              {PERIODS.map((p) => (
                <option key={p} value={p}>{p ? t('puzzleStats.lastDays', { count: p }) : t('puzzleStats.allTime')}</option>
              ))}
            </select>
          </div>
        </div>

        {!attempts.length ? (
          <div className="panel p-8 text-center text-ink-2">
            {t('puzzleStats.empty')} <Link className="text-accent underline" to="/puzzles">{t('puzzles.tabs.train')}</Link>
          </div>
        ) : (
          <Panels attempts={attempts} period={period} />
        )}
      </div>
    </>
  );
}

function Panels({ attempts, period }: { attempts: PuzzleAttempt[]; period: number }) {
  const { t } = useTranslation();
  const s = useMemo(() => summary(attempts), [attempts]);
  const rating = useMemo(() => ratingHistory(attempts), [attempts]);
  const days = useMemo(() => daily(attempts, period && period <= 90 ? period : 90), [attempts, period]);
  const themes = useMemo(() => byTheme(attempts), [attempts]);
  const [allThemes, setAllThemes] = useState(false);
  const pieceSet = useSettings((x) => x.pieceSet);

  const rateRows = (groups: Group[]) =>
    groups.map((g) => ({ key: g.key, value: g.n ? g.rate : undefined, note: t('puzzleStats.count', { count: g.n }) }));
  const timeRows = (groups: Group[]) =>
    groups.map((g) => ({ key: g.key, value: g.n ? g.medianMs / 1000 : undefined, note: t('puzzleStats.count', { count: g.n }) }));
  const pct = (v: number) => `${Math.round(v)}%`;
  const secs = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}s`;

  const lengths = byLength(attempts);
  const phases = byPhase(attempts);
  const colors = byColor(attempts);
  const ratings = byRating(attempts);
  const times = byTime(attempts);
  const timeLabel = (k: string) => {
    const i = TIME_BUCKETS.map(String).indexOf(k);
    const lo = i ? TIME_BUCKETS[i - 1] : 0;
    return k === 'Infinity' ? `${lo}s+` : `${lo}–${k}s`;
  };

  return (
    <div className="space-y-4">
      <div className="panel grid grid-cols-2 gap-6 p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Figure value={String(s.n)} label={t('puzzleStats.puzzles')} />
        <Figure value={pct(s.rate)} label={t('puzzleStats.accuracy')} />
        <Figure value={s.medianSolvedMs ? formatSeconds(s.medianSolvedMs) : '–'} label={t('puzzleStats.medianSolve')} />
        <Figure value={formatSeconds(s.totalMs)} label={t('puzzleStats.totalTime')} />
        <Figure value={String(s.bestStreak)} label={t('puzzleStats.bestStreak')} />
        <Figure value={String(s.avgPuzzleRating)} label={t('puzzleStats.avgRating')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t('puzzleStats.activity')}>
          <Block title={t('puzzleStats.perDay')}>
            <ActivityChart days={days} />
          </Block>
        </Section>
        <Section title={t('puzzleStats.ratingTitle')}>
          <Block title={t('puzzleStats.ratingEvolution')} subtitle={t('puzzleStats.ratingSub')}>
            {rating.length > 1 ? <PuzzleRatingChart points={rating} /> : <Empty>{t('puzzleStats.noRated')}</Empty>}
          </Block>
        </Section>
      </div>

      <Section
        title={t('puzzleStats.themes')}
        aside={
          themes.length > THEMES_SHOWN * 2 && (
            <button className="btn-ghost text-xs" onClick={() => setAllThemes(!allThemes)}>
              {allThemes ? t('puzzleStats.showLess') : t('puzzleStats.showAll', { count: themes.length })}
            </button>
          )
        }
      >
        {!themes.length ? (
          <Empty>{t('puzzleStats.fewThemes')}</Empty>
        ) : allThemes || themes.length <= THEMES_SHOWN * 2 ? (
          <div className="px-5 py-4">
            <ThemeTable groups={themes} />
          </div>
        ) : (
          <div className="grid divide-line lg:grid-cols-2 lg:divide-x">
            <Block title={t('puzzleStats.weakest')} subtitle={t('puzzleStats.themesSub')}>
              <ThemeTable groups={themes.slice(0, THEMES_SHOWN)} />
            </Block>
            <Block title={t('puzzleStats.strongest')} subtitle={t('puzzleStats.themesSub')}>
              <ThemeTable groups={themes.slice(-THEMES_SHOWN).reverse()} />
            </Block>
          </div>
        )}
      </Section>

      <Section title={t('puzzleStats.difficulty')}>
        <div className="grid divide-line lg:grid-cols-2 lg:divide-x">
          <Block title={t('puzzleStats.byRating')} subtitle={t('puzzleStats.accuracySub')}>
            <ValueBars rows={rateRows(ratings)} label={(k) => `${k}+`} format={pct} seriesLabel={t('puzzleStats.accuracy')} />
          </Block>
          <Block title={t('puzzleStats.byLength')} subtitle={t('puzzleStats.byLengthSub')}>
            <ValueBars rows={rateRows(lengths)} label={(k) => t('puzzleStats.moves', { count: k === '4+' ? 4 : Number(k), n: k })} format={pct} seriesLabel={t('puzzleStats.accuracy')} />
          </Block>
          <Block title={t('puzzleStats.timeByRating')} subtitle={t('puzzleStats.medianSub')}>
            <ValueBars rows={timeRows(ratings)} label={(k) => `${k}+`} format={secs} domain={[0, 'auto']} color={SERIES[1]} seriesLabel={t('puzzleStats.medianTime')} />
          </Block>
          <Block title={t('puzzleStats.timeByLength')} subtitle={t('puzzleStats.medianSub')}>
            <ValueBars rows={timeRows(lengths)} label={(k) => t('puzzleStats.moves', { count: k === '4+' ? 4 : Number(k), n: k })} format={secs} domain={[0, 'auto']} color={SERIES[1]} seriesLabel={t('puzzleStats.medianTime')} />
          </Block>
        </div>
      </Section>

      <Section title={t('puzzleStats.context')}>
        <div className="grid divide-line lg:grid-cols-3 lg:divide-x">
          <Block title={t('puzzleStats.byPhase')} subtitle={t('puzzleStats.accuracySub')}>
            <ValueBars rows={rateRows(phases)} label={(k) => t(`phase.${k}`)} format={pct} seriesLabel={t('puzzleStats.accuracy')} highlightExtremes />
          </Block>
          <Block title={t('puzzleStats.byColor')} subtitle={t('puzzleStats.accuracySub')}>
            <ValueBars
              rows={rateRows(colors)}
              label={(k) => t(`common.${k}`)}
              tick={(k) => <img src={pieceUrl(pieceSet, k === 'white' ? 'wK' : 'bK')} alt="" className="h-5 w-5" />}
              format={pct}
              seriesLabel={t('puzzleStats.accuracy')}
            />
          </Block>
          <Block title={t('puzzleStats.byTime')} subtitle={t('puzzleStats.byTimeSub')}>
            <ValueBars rows={rateRows(times)} label={timeLabel} format={pct} seriesLabel={t('puzzleStats.accuracy')} highlightExtremes />
          </Block>
        </div>
      </Section>
    </div>
  );
}

function ThemeTable({ groups }: { groups: Group[] }) {
  const { t } = useTranslation();
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-ink-3">
        <tr className="border-b border-line">
          <th className="py-1.5 pr-3 font-normal">{t('puzzles.theme')}</th>
          <th className="w-[40%] py-1.5 pr-3 font-normal">{t('puzzleStats.accuracy')}</th>
          <th className="py-1.5 pr-3 text-right font-normal">{t('puzzleStats.puzzles')}</th>
          <th className="py-1.5 text-right font-normal">{t('puzzleStats.medianTime')}</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <tr key={g.key} className="border-b border-line/50 last:border-0">
            <td className="py-1.5 pr-3 font-semibold">{t(`puzzleTheme.${g.key}`, { defaultValue: g.key })}</td>
            <td className="py-1.5 pr-3">
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-loss/30">
                  <div className="h-full rounded-full bg-win" style={{ width: `${g.rate}%` }} />
                </div>
                <span className="tabular w-10 text-right text-xs text-ink-2">{Math.round(g.rate)}%</span>
              </div>
            </td>
            <td className="tabular py-1.5 pr-3 text-right text-ink-2">{g.n}</td>
            <td className="tabular py-1.5 text-right text-ink-2">{formatSeconds(g.medianMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

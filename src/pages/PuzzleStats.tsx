import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import PuzzleTabs from '../components/puzzle/PuzzleTabs';
import Section from '../components/puzzle/Section';
import ValueBars from '../components/charts/ValueBars';
import { SERIES } from '../components/charts/theme';
import { ActivityChart, PuzzleRatingChart, ThemeTrendChart } from '../components/charts/PuzzleCharts';
import { Block, Toggle } from './stats/layout';
import { Empty, Figure } from './stats/shared';
import { pieceUrl, useSettings } from '../lib/settings';
import { accuracyTrend, byColor, byLength, byPhase, byRating, byTheme, byTime, daily, ratingHistory, summary, themeCounts, TIME_BUCKETS, type Group } from '../puzzles/stats';
import { usePuzzlePrefs } from '../puzzles/prefs';
import { formatSeconds } from '../puzzles/format';
import type { PuzzleAttempt } from '../types';

type ModeFilter = 'all' | 'free' | 'sprint' | 'woodpecker';
const PERIODS = [7, 30, 90, 0];
const THEMES_SHOWN = 10;
/** Attempts in the rolling accuracy of the theme chart. */
const TREND_WINDOW = 10;

export default function PuzzleStats() {
  const { t } = useTranslation();
  const all = useLiveQuery(() => db.puzzleAttempts.toArray(), []);
  const [mode, setMode] = useState<ModeFilter>('all');
  const [period, setPeriod] = useState(30);
  // The theme lives in the URL, so a filtered view can be linked to and survives a reload.
  const [params, setParams] = useSearchParams();
  const theme = params.get('theme') ?? '';
  const setTheme = (v: string) =>
    setParams(
      (p) => {
        const out = new URLSearchParams(p);
        if (v) out.set('theme', v);
        else out.delete('theme');
        return out;
      },
      { replace: true },
    );

  /** Attempts of the chosen mode and period, before the theme filter (the baseline it is compared with). */
  const scoped = useMemo(() => {
    const since = period ? Date.now() - period * 86_400_000 : 0;
    return (all ?? []).filter(
      (a) => a.startedAt >= since && (mode === 'all' || (mode === 'free' ? a.mode === 'rated' || a.mode === 'practice' : a.mode === mode)),
    );
  }, [all, mode, period]);
  const attempts = useMemo(() => (theme ? scoped.filter((a) => a.themes?.includes(theme)) : scoped), [scoped, theme]);
  const options = useMemo(() => {
    const list = themeCounts(scoped);
    // Keep a theme from the URL selectable even when this period has none of it.
    return theme && !list.some((o) => o.theme === theme) ? [...list, { theme, n: 0 }] : list;
  }, [scoped, theme]);
  const themeName = (k: string) => t(`puzzleTheme.${k}`, { defaultValue: k });

  if (!all) return <p className="text-ink-3">{t('common.loading')}</p>;

  return (
    <>
      <PuzzleTabs />
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl font-bold">{t('puzzleStats.title')}</h1>
          {/* Phones: the mode switch on its own row, theme and period side by side below it. */}
          <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-4">
            <div className="col-span-2 [&>div]:flex [&>div]:w-full sm:[&>div]:w-auto">
            <Toggle
              value={mode}
              onChange={setMode}
              options={[
                ['all', t('puzzleStats.modeAll')],
                ['free', t('puzzleStats.modeFree')],
                ['sprint', t('puzzles.tabs.sprint')],
                ['woodpecker', t('puzzles.tabs.woodpecker')],
              ]}
            />
            </div>
            <select className="input min-w-0 sm:max-w-56" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label={t('puzzles.theme')}>
              <option value="">{t('puzzles.anyTheme')}</option>
              {options.map((o) => (
                <option key={o.theme} value={o.theme}>{themeName(o.theme)} ({o.n})</option>
              ))}
            </select>
            <select className="input min-w-0" value={period} onChange={(e) => setPeriod(Number(e.target.value))} aria-label={t('puzzleStats.period')}>
              {PERIODS.map((p) => (
                <option key={p} value={p}>{p ? t('puzzleStats.lastDays', { count: p }) : t('puzzleStats.allTime')}</option>
              ))}
            </select>
          </div>
        </div>

        {theme && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-accent/10 py-1 pr-1 pl-2.5 text-sm text-accent ring-1 ring-accent/25">
              {t('puzzleStats.themeChip', { theme: themeName(theme) })}
              <button className="rounded-full px-1.5 hover:bg-accent/20" onClick={() => setTheme('')} aria-label={t('filters.clear')}>✕</button>
            </span>
          </div>
        )}

        {!attempts.length ? (
          <div className="panel p-8 text-center text-ink-2">
            {theme ? t('puzzleStats.emptyTheme', { theme: themeName(theme) }) : t('puzzleStats.empty')}{' '}
            <Link className="text-accent underline" to="/puzzles">{t('puzzles.tabs.train')}</Link>
          </div>
        ) : (
          <Panels attempts={attempts} baseline={scoped} theme={theme} onTheme={setTheme} period={period} />
        )}
      </div>
    </>
  );
}

function Panels({
  attempts,
  baseline,
  theme,
  onTheme,
  period,
}: {
  attempts: PuzzleAttempt[];
  /** The same attempts without the theme filter, for comparison. */
  baseline: PuzzleAttempt[];
  theme: string;
  onTheme: (theme: string) => void;
  period: number;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setTrainTheme = usePuzzlePrefs((p) => p.setTheme);
  const s = useMemo(() => summary(attempts), [attempts]);
  const base = useMemo(() => summary(baseline), [baseline]);
  const trend = useMemo(() => (theme ? accuracyTrend(attempts, TREND_WINDOW) : []), [attempts, theme]);
  const rating = useMemo(() => ratingHistory(attempts), [attempts]);
  const days = useMemo(() => daily(attempts, period && period <= 90 ? period : 90), [attempts, period]);
  // With a theme chosen, the table lists the themes that come with it.
  const themes = useMemo(() => byTheme(attempts).filter((g) => g.key !== theme), [attempts, theme]);
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

      {theme && (
        <Section
          title={t('puzzleStats.themeFocus', { theme: t(`puzzleTheme.${theme}`, { defaultValue: theme }) })}
          aside={
            <button
              className="btn-primary text-xs"
              onClick={() => {
                setTrainTheme(theme);
                navigate('/puzzles');
              }}
            >
              {t('puzzleStats.trainTheme')}
            </button>
          }
        >
          <div className="grid gap-6 px-5 pt-5 sm:grid-cols-3">
            <Compare label={t('puzzleStats.accuracy')} overall={pct(base.rate)} delta={s.rate - base.rate} unit=" pp" />
            <Compare
              label={t('puzzleStats.medianSolve')}
              overall={base.medianSolvedMs ? formatSeconds(base.medianSolvedMs) : '–'}
              delta={s.medianSolvedMs && base.medianSolvedMs ? (s.medianSolvedMs - base.medianSolvedMs) / 1000 : undefined}
              unit=" s"
              lowerIsBetter
            />
            <Compare label={t('puzzleStats.avgRating')} overall={String(base.avgPuzzleRating)} delta={s.avgPuzzleRating - base.avgPuzzleRating} neutral />
          </div>
          <Block title={t('puzzleStats.themeTrend')} subtitle={t('puzzleStats.themeTrendSub', { count: TREND_WINDOW })}>
            {trend.length > 1 ? <ThemeTrendChart points={trend} average={base.rate} window={TREND_WINDOW} /> : <Empty>{t('puzzleStats.fewAttempts')}</Empty>}
          </Block>
        </Section>
      )}

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
        title={theme ? t('puzzleStats.coThemes') : t('puzzleStats.themes')}
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
            <ThemeTable onSelect={onTheme} groups={themes} />
          </div>
        ) : (
          <div className="grid divide-line lg:grid-cols-2 lg:divide-x">
            <Block title={t('puzzleStats.weakest')} subtitle={t('puzzleStats.themesSub')}>
              <ThemeTable onSelect={onTheme} groups={themes.slice(0, THEMES_SHOWN)} />
            </Block>
            <Block title={t('puzzleStats.strongest')} subtitle={t('puzzleStats.themesSub')}>
              <ThemeTable onSelect={onTheme} groups={themes.slice(-THEMES_SHOWN).reverse()} />
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

/** How the chosen theme differs from the user's overall number: the difference big, the overall below it. */
function Compare({
  label,
  overall,
  delta,
  unit = '',
  lowerIsBetter,
  neutral,
}: {
  label: string;
  overall: string;
  delta?: number;
  unit?: string;
  lowerIsBetter?: boolean;
  /** Neither direction is better (e.g. how hard the puzzles were): no good/bad colour. */
  neutral?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const decimals = unit.trim() === 's' ? 1 : 0;
  const shown = delta === undefined ? undefined : Number(delta.toFixed(decimals));
  const good = !!shown && (lowerIsBetter ? shown < 0 : shown > 0);
  const num = new Intl.NumberFormat(i18n.resolvedLanguage, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, signDisplay: 'exceptZero' });
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`tabular font-display text-4xl font-bold tracking-tight ${shown === undefined || !shown || neutral ? 'text-ink' : good ? 'text-good' : 'text-loss'}`}>
        {shown === undefined ? '–' : `${num.format(shown)}${unit}`}
      </div>
      <div className="text-xs text-ink-3">{t('puzzleStats.overallIs', { value: overall })}</div>
    </div>
  );
}

function ThemeTable({ groups, onSelect }: { groups: Group[]; onSelect: (theme: string) => void }) {
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
            <td className="py-1.5 pr-3 font-semibold">
              <button className="text-left hover:text-accent" onClick={() => onSelect(g.key)} title={t('puzzleStats.filterByTheme')}>
                {t(`puzzleTheme.${g.key}`, { defaultValue: g.key })}
              </button>
            </td>
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

import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import PuzzleTabs from '../components/puzzle/PuzzleTabs';
import Section, { Progress } from '../components/puzzle/Section';
import ValueBars from '../components/charts/ValueBars';
import { SERIES } from '../components/charts/theme';
import { Block } from './stats/layout';
import { Empty, Figure } from './stats/shared';
import { originLabel } from '../components/puzzle/Bits';
import { cycleStats, puzzleTracks } from '../puzzles/stats';
import { deleteSet, nextTarget, startCycle } from '../puzzles/woodpecker';
import { formatClock, formatSeconds } from '../puzzles/format';

const TRACKS_SHOWN = 30;

export default function WoodpeckerSet() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const id = useParams().id ?? '';
  const set = useLiveQuery(() => db.woodpeckerSets.get(id), [id], null);
  const cycles = useLiveQuery(() => db.woodpeckerCycles.where('setId').equals(id).sortBy('index'), [id]);
  const attempts = useLiveQuery(() => db.puzzleAttempts.where('setId').equals(id).toArray(), [id]);

  const stats = useMemo(() => cycleStats(cycles ?? []), [cycles]);
  const tracks = useMemo(() => puzzleTracks(cycles ?? [], attempts ?? []), [cycles, attempts]);

  if (set === null || !cycles || !attempts) return <p className="text-ink-3">{t('common.loading')}</p>;
  if (!set) return <p className="panel p-6 text-center text-ink-2">{t('woodpecker.notFound')}</p>;

  const last = cycles[cycles.length - 1];
  const open = last && !last.finishedAt ? last : undefined;
  const finished = stats.filter((c) => c.finished);
  const target = nextTarget(cycles);
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });
  const cycleLabel = (k: string) => t('woodpecker.cycleShort', { index: k });
  const struggling = tracks.filter((p) => p.misses > 0);

  async function play() {
    if (!open) await startCycle(set!);
    navigate(`/puzzles/woodpecker/${id}/play`);
  }

  async function remove() {
    if (!confirm(t('woodpecker.confirmDelete', { name: set!.name }))) return;
    await deleteSet(id);
    navigate('/puzzles/woodpecker');
  }

  return (
    <>
      <PuzzleTabs />
      <div className="space-y-4">
        <div className="panel flex flex-wrap items-center gap-4 p-5">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{set.name}</h1>
            <p className="text-sm text-ink-3">
              {originLabel(set, t)} · {t('woodpecker.puzzleCount', { count: set.puzzleIds.length })} ·{' '}
              {t('woodpecker.created', { date: date.format(set.createdAt) })}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <button className="btn-ghost text-loss" onClick={() => void remove()}>{t('woodpecker.delete')}</button>
            <button className="btn-primary" onClick={() => void play()}>
              {open ? t('woodpecker.continue', { index: open.index }) : t('woodpecker.startCycle', { index: (last?.index ?? 0) + 1 })}
            </button>
          </div>
          {open && (
            <div className="w-full space-y-1">
              <div className="flex justify-between text-xs text-ink-3">
                <span>{t('woodpecker.cycleN', { index: open.index })}</span>
                <span className="tabular">{open.position}/{open.order.length}</span>
              </div>
              <Progress value={open.position} total={open.order.length} />
            </div>
          )}
        </div>

        <div className="panel grid grid-cols-2 gap-6 p-5 sm:grid-cols-4">
          <Figure value={String(finished.length)} label={t('woodpecker.cyclesDone')} />
          <Figure
            value={finished.length ? `${Math.round(Math.max(...finished.map((c) => c.rate)))}%` : '–'}
            label={t('woodpecker.bestAccuracy')}
          />
          <Figure
            value={finished.length ? formatClock(Math.min(...finished.map((c) => c.activeMs))) : '–'}
            label={t('woodpecker.bestTime')}
          />
          <Figure value={target !== undefined ? formatClock(target) : '–'} label={t('woodpecker.nextTarget')} />
        </div>

        {!stats.length ? (
          <Section title={t('woodpecker.cycles')}>
            <Empty>{t('woodpecker.noCycles')}</Empty>
          </Section>
        ) : (
          <Section title={t('woodpecker.cycles')}>
            <div className="grid divide-line lg:grid-cols-2 lg:divide-x">
              <Block title={t('woodpecker.accuracyByCycle')} subtitle={t('woodpecker.accuracyByCycleSub')}>
                <ValueBars
                  rows={stats.map((c) => ({ key: String(c.index), value: c.done ? c.rate : undefined, note: `${c.done}/${c.total}` }))}
                  label={cycleLabel}
                  format={(v) => `${Math.round(v)}%`}
                  seriesLabel={t('woodpecker.accuracy')}
                />
              </Block>
              <Block title={t('woodpecker.timeByCycle')} subtitle={t('woodpecker.timeByCycleSub')}>
                <ValueBars
                  rows={stats.map((c) => ({ key: String(c.index), value: c.done ? c.avgMs / 1000 : undefined, note: formatClock(c.activeMs) }))}
                  label={cycleLabel}
                  format={(v) => `${v.toFixed(1)}s`}
                  domain={[0, 'auto']}
                  color={SERIES[1]}
                  seriesLabel={t('woodpecker.avgPerPuzzle')}
                />
              </Block>
            </div>
            <div className="overflow-x-auto px-5 py-4">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-3">
                  <tr className="border-b border-line">
                    <th className="py-1.5 pr-3 font-normal">{t('woodpecker.cycle')}</th>
                    <th className="py-1.5 pr-3 text-right font-normal">{t('woodpecker.progress')}</th>
                    <th className="py-1.5 pr-3 text-right font-normal">{t('woodpecker.accuracy')}</th>
                    <th className="py-1.5 pr-3 text-right font-normal">{t('woodpecker.cycleTime')}</th>
                    <th className="py-1.5 pr-3 text-right font-normal">{t('woodpecker.avgPerPuzzle')}</th>
                    <th className="py-1.5 text-right font-normal">{t('woodpecker.started')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((c, i) => (
                    <tr key={c.index} className="tabular border-b border-line/50 last:border-0">
                      <td className="py-1.5 pr-3 font-semibold">{cycleLabel(String(c.index))}</td>
                      <td className="py-1.5 pr-3 text-right text-ink-2">{c.done}/{c.total}</td>
                      <td className="py-1.5 pr-3 text-right text-ink-2">{c.done ? `${Math.round(c.rate)}%` : '–'}</td>
                      <td className="py-1.5 pr-3 text-right text-ink-2">{formatClock(c.activeMs)}</td>
                      <td className="py-1.5 pr-3 text-right text-ink-2">{c.done ? formatSeconds(c.avgMs) : '–'}</td>
                      <td className="py-1.5 text-right text-ink-3">{date.format(cycles[i].startedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        <Section title={t('woodpecker.hardest')}>
          {!struggling.length ? (
            <Empty>{t('woodpecker.noMisses')}</Empty>
          ) : (
            <div className="space-y-1.5 px-5 py-4">
              <p className="pb-1 text-xs text-ink-3">{t('woodpecker.hardestSub')}</p>
              {struggling.slice(0, TRACKS_SHOWN).map((p) => (
                <div key={p.puzzleId} className="flex items-center gap-3 text-sm">
                  <Link to={`/puzzles/p/${p.puzzleId}`} className="tabular w-16 font-semibold hover:text-accent">{p.rating}</Link>
                  <div className="flex gap-1">
                    {cycles.map((c) => {
                      const r = p.results.get(c.index);
                      return (
                        <span
                          key={c.index}
                          title={cycleLabel(String(c.index))}
                          className={`h-3 w-3 rounded-sm ${r === undefined ? 'bg-white/10' : r ? 'bg-accent' : 'bg-loss'}`}
                        />
                      );
                    })}
                  </div>
                  <span className="ml-auto text-xs text-ink-3">{t('woodpecker.misses', { count: p.misses })}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}

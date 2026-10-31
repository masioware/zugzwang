import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import ClassificationIcon from '../components/ClassificationIcon';
import PuzzleTabs from '../components/puzzle/PuzzleTabs';
import Clock from '../components/puzzle/Clock';
import { Progress } from '../components/puzzle/Section';
import { ThemeChips } from '../components/puzzle/Bits';
import { SolverBoard, SolverNav, SolverStatus, StatusLine } from '../components/puzzle/Solver';
import { useSolver, type FinishResult } from '../puzzles/useSolver';
import { getPuzzle } from '../puzzles/source';
import { cyclesOf, nextTarget, openCycle, recordResult, startCycle } from '../puzzles/woodpecker';
import { formatClock, formatSeconds } from '../puzzles/format';
import type { Puzzle, WoodpeckerCycle } from '../types';

/** Pause after a clean solve before the next puzzle comes up. */
const ADVANCE_DELAY = 600;

export default function WoodpeckerPlay() {
  const { t } = useTranslation();
  const setId = useParams().id ?? '';
  const set = useLiveQuery(() => db.woodpeckerSets.get(setId), [setId], null);
  const [cycle, setCycle] = useState<WoodpeckerCycle | null | undefined>(undefined);
  const [previous, setPrevious] = useState<WoodpeckerCycle | undefined>();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [error, setError] = useState('');
  const [last, setLast] = useState<FinishResult | null>(null);
  const advanceTimer = useRef<number | undefined>(undefined);

  // Resume the open cycle, if any.
  useEffect(() => {
    void (async () => {
      const open = await openCycle(setId);
      const all = await cyclesOf(setId);
      setPrevious([...all].reverse().find((c) => c.finishedAt && c.id !== open?.id));
      setCycle(open ?? null);
    })();
  }, [setId]);

  // Load the cycle's current puzzle whenever the board is free; a finished puzzle stays until advance().
  useEffect(() => {
    if (!cycle || cycle.finishedAt || puzzle) return;
    let cancelled = false;
    setError('');
    getPuzzle(cycle.order[cycle.position])
      .then((p) => !cancelled && setPuzzle(p))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [cycle, puzzle]);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  function advance() {
    clearTimeout(advanceTimer.current);
    setLast(null);
    setPuzzle(null);
  }

  async function onFinish(r: FinishResult) {
    if (!cycle || !puzzle) return;
    setLast(r);
    const next = await recordResult(cycle, puzzle, r);
    setCycle(next);
    if (r.solved && !next.finishedAt) advanceTimer.current = window.setTimeout(advance, ADVANCE_DELAY);
  }

  const solver = useSolver(puzzle, { retry: false, onFinish: (r) => void onFinish(r) });

  // Enter / space moves on after a miss.
  useEffect(() => {
    if (!solver.done || !last || cycle?.finishedAt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      advance();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [solver.done, last, cycle?.finishedAt]);

  async function begin() {
    if (!set) return;
    setPrevious([...(await cyclesOf(setId))].reverse().find((c) => c.finishedAt));
    setLast(null);
    setPuzzle(null);
    setCycle(await startCycle(set));
  }

  if (set === null || cycle === undefined) return <p className="text-ink-3">{t('common.loading')}</p>;
  if (!set) return <p className="panel p-6 text-center text-ink-2">{t('woodpecker.notFound')}</p>;

  const target = nextTarget(previous ? [previous] : []);
  const finished = !!cycle?.finishedAt && (!puzzle || solver.done);

  // No open cycle: offer the next one.
  if (!cycle)
    return (
      <>
        <PuzzleTabs />
        <div className="panel mx-auto max-w-lg space-y-4 p-6 text-center">
          <h1 className="text-xl font-bold">{set.name}</h1>
          <p className="text-ink-2">{t('woodpecker.puzzleCount', { count: set.puzzleIds.length })}</p>
          {target !== undefined && <p className="text-sm text-ink-3">{t('woodpecker.targetHint', { time: formatSeconds(target) })}</p>}
          <button className="btn-primary h-10 w-full" onClick={() => void begin()}>
            {t('woodpecker.startCycle', { index: (previous?.index ?? 0) + 1 })}
          </button>
        </div>
      </>
    );

  const rate = cycle.position ? Math.round((cycle.solved / cycle.position) * 100) : undefined;
  // While a puzzle is on, the cycle clock adds its running time to what is already banked.
  const running = !!puzzle && !last;
  const projected = cycle.position ? (cycle.activeMs / cycle.position) * cycle.order.length : undefined;

  const status = error ? (
    <StatusLine title={<span className="text-loss">{t('puzzles.errorTitle')}</span>} sub={t('puzzles.loadError', { error })} />
  ) : !puzzle ? (
    <StatusLine title={<span className="text-ink-3">{t('common.loading')}</span>} />
  ) : (
    <SolverStatus
      solver={solver}
      aside={<Clock from={solver.startedAt} to={solver.endedAt} className="text-sm text-ink-3" />}
      done={
        <StatusLine
          icon={<ClassificationIcon c={last?.solved ? 'best' : 'mistake'} size={36} />}
          title={t(last?.solved ? 'puzzles.solved' : 'woodpecker.missed')}
          sub={last ? formatSeconds(last.timeMs) : undefined}
        />
      }
    />
  );

  return (
    <>
      <PuzzleTabs />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <SolverBoard solver={solver} />

        <aside className="space-y-3 lg:sticky lg:top-[72px]">
          <div className="panel space-y-3 p-4">
            <div className="flex items-baseline gap-2">
              <Link to={`/puzzles/woodpecker/${set.id}`} className="min-w-0 truncate font-semibold hover:text-accent">{set.name}</Link>
              <span className="ml-auto shrink-0 text-sm text-ink-3">{t('woodpecker.cycleN', { index: cycle.index })}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-ink-3">
                <span>{t('woodpecker.progress')}</span>
                <span className="tabular">{cycle.position}/{cycle.order.length}</span>
              </div>
              <Progress value={cycle.position} total={cycle.order.length} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label={t('woodpecker.cycleTime')}>
                {running ? <Clock from={solver.startedAt} base={cycle.activeMs} /> : formatClock(cycle.activeMs)}
              </Stat>
              <Stat label={t('woodpecker.accuracy')}>{rate === undefined ? '–' : `${rate}%`}</Stat>
              <Stat label={target !== undefined ? t('woodpecker.target') : t('woodpecker.projected')}>
                {target !== undefined ? formatClock(target) : projected !== undefined ? formatClock(projected) : '–'}
              </Stat>
            </div>
            {target !== undefined && projected !== undefined && (
              <p className={`text-center text-xs ${projected <= target ? 'text-good' : 'text-ink-3'}`}>
                {t('woodpecker.pace', { time: formatClock(projected) })}
              </p>
            )}
          </div>

          {finished ? (
            <CycleSummary cycle={cycle} previous={previous} />
          ) : (
            <div className="panel">
              <div className="p-4">{status}</div>
              {puzzle && solver.done && (
                <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-sm">
                  <span className="text-ink-3">{t('puzzles.puzzle')}</span>
                  <span className="tabular font-semibold">{puzzle.rating}</span>
                  <div className="ml-2 min-w-0"><ThemeChips themes={puzzle.themes} /></div>
                </div>
              )}
              <div className="flex gap-2 border-t border-line p-3">
                {solver.done && last ? (
                  <button className="btn-primary h-10 flex-1" onClick={advance}>{t('puzzles.next')}</button>
                ) : (
                  <>
                    <button className="btn-ghost h-10 flex-1" onClick={solver.showSolution} disabled={solver.phase !== 'play'}>
                      {t('woodpecker.giveUp')}
                    </button>
                    <Link className="btn-ghost h-10 flex-1" to={`/puzzles/woodpecker/${set.id}`}>{t('woodpecker.pause')}</Link>
                  </>
                )}
              </div>
              <SolverNav solver={solver} />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-white/[0.03] px-2 py-2">
      <div className="tabular text-lg font-bold">{children}</div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}

function CycleSummary({ cycle, previous }: { cycle: WoodpeckerCycle; previous?: WoodpeckerCycle }) {
  const { t } = useTranslation();
  const rate = Math.round((cycle.solved / cycle.order.length) * 100);
  const prevRate = previous ? Math.round((previous.solved / previous.order.length) * 100) : undefined;
  return (
    <div className="panel space-y-3 p-5">
      <h2 className="text-lg font-bold">{t('woodpecker.cycleDone', { index: cycle.index })}</h2>
      <div className="space-y-1 text-sm text-ink-2">
        <p>{t('woodpecker.summaryLine', { solved: cycle.solved, total: cycle.order.length, rate, time: formatClock(cycle.activeMs) })}</p>
        {previous && prevRate !== undefined && (
          <p>{t('woodpecker.versusPrevious', { rate: prevRate, time: formatClock(previous.activeMs) })}</p>
        )}
        <p className="text-ink-3">{t('woodpecker.nextGoal', { time: formatClock(cycle.activeMs / 2) })}</p>
        <p className="text-ink-3">{t('woodpecker.restTip')}</p>
      </div>
      <Link className="btn-primary h-10 w-full" to={`/puzzles/woodpecker/${cycle.setId}`}>{t('woodpecker.viewSet')}</Link>
    </div>
  );
}

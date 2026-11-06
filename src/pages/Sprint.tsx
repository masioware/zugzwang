import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import ClassificationIcon from '../components/ClassificationIcon';
import PuzzleTabs from '../components/puzzle/PuzzleTabs';
import Clock from '../components/puzzle/Clock';
import { SolverBoard, SolverNav, SolverStatus, StatusLine } from '../components/puzzle/Solver';
import { savePuzzle, warmBuckets } from '../puzzles/source';
import { MAX_STRIKES, SPRINT_LIMITS, SPRINT_MODES, bestScores, isRecord, pickSprintPuzzle, sprintAttempt } from '../puzzles/sprint';
import { useSolver, type SolveResult } from '../puzzles/useSolver';
import { formatClock, formatSeconds } from '../puzzles/format';
import type { Puzzle, SprintMode, SprintResult, SprintRun } from '../types';

/** Pause after a solve, so the last move registers. */
const SOLVED_PAUSE = 250;
/** Long enough to see the rejected move, and shorter than the solver's wait before it plays the solution. */
const WRONG_PAUSE = 600;

interface Run {
  mode: SprintMode;
  startedAt: number;
  deadline?: number;
  results: SprintResult[];
}

export default function Sprint() {
  const { t } = useTranslation();
  const runs = useLiveQuery(() => db.sprintRuns.orderBy('startedAt').toArray(), []);
  const [run, setRun] = useState<Run | null>(null);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);

  // Timer callbacks outlive the render that scheduled them, so they read the run from here.
  const live = useRef<Run | null>(null);
  const used = useRef(new Set<string>());
  const shown = useRef(0);
  const upcoming = useRef<Promise<Puzzle | undefined> | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // The first rungs of the ladder load instantly and work offline after the first visit.
  useEffect(() => void warmBuckets(1000, 500), []);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      live.current = null;
    },
    [],
  );

  /** Fetches the following puzzle ahead of time: the clock doesn't stop for downloads. */
  function prepareNext() {
    upcoming.current = pickSprintPuzzle(shown.current, used.current).catch(() => undefined);
  }

  function show(p: Puzzle) {
    shown.current++;
    void savePuzzle(p);
    setPuzzle(p);
    prepareNext();
  }

  async function start(mode: SprintMode) {
    setStarting(true);
    setError(false);
    used.current = new Set();
    shown.current = 0;
    const first = await pickSprintPuzzle(0, used.current).catch(() => undefined);
    setStarting(false);
    if (!first) return setError(true);
    // The clock starts only once the first puzzle is at hand.
    const startedAt = Date.now();
    const limit = SPRINT_LIMITS[mode];
    const next: Run = { mode, startedAt, deadline: limit === undefined ? undefined : startedAt + limit, results: [] };
    live.current = next;
    setRun(next);
    show(first);
  }

  async function end() {
    const current = live.current;
    if (!current) return;
    live.current = null;
    clearTimeout(timer.current);
    // A run with nothing played isn't worth a line in the history.
    if (current.results.length) {
      const record: SprintRun = {
        mode: current.mode,
        startedAt: current.startedAt,
        durationMs: Date.now() - current.startedAt,
        score: current.results.filter((r) => r.solved).length,
        results: current.results,
      };
      await db.sprintRuns.add(record);
    }
    setRun(null);
    setPuzzle(null);
  }

  async function advance() {
    const p = await upcoming.current;
    if (!live.current) return;
    // Out of puzzles (offline with little cached): the run ends with what it has.
    if (!p) return void end();
    show(p);
  }

  function onSettle(r: SolveResult) {
    const current = live.current;
    if (!current || !puzzle) return;
    void db.puzzleAttempts.add(sprintAttempt(puzzle, r));
    const results = [...current.results, { puzzleId: puzzle.id, rating: puzzle.rating, solved: r.solved }];
    const next = { ...current, results };
    live.current = next;
    setRun(next);
    const out = results.filter((x) => !x.solved).length >= MAX_STRIKES;
    timer.current = window.setTimeout(() => void (out ? end() : advance()), r.solved ? SOLVED_PAUSE : WRONG_PAUSE);
  }

  const solver = useSolver(puzzle, { retry: false, onSettle });

  if (!run)
    return (
      <>
        <PuzzleTabs />
        <SprintHome runs={runs ?? []} starting={starting} error={error} onStart={(m) => void start(m)} />
      </>
    );

  const score = run.results.filter((r) => r.solved).length;
  const strikes = run.results.length - score;
  const missed = solver.result && !solver.result.solved;

  return (
    <>
      <PuzzleTabs />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <SolverBoard solver={solver} />

        <aside className="space-y-3 lg:sticky lg:top-[72px]">
          <div className="panel space-y-3 p-4">
            <div className="flex items-center justify-between text-sm text-ink-3">
              <span>{t(`sprint.modes.${run.mode}`)}</span>
              {run.deadline !== undefined ? (
                <Countdown deadline={run.deadline} onExpire={() => void end()} />
              ) : (
                <Clock from={run.startedAt} className="text-2xl font-bold text-ink" />
              )}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="tabular text-5xl font-bold">{score}</div>
                <div className="text-xs text-ink-3">{t('sprint.score')}</div>
              </div>
              <Strikes count={strikes} />
            </div>
          </div>

          <div className="panel">
            <div className="p-4">
              {missed ? (
                <StatusLine icon={<ClassificationIcon c="mistake" size={36} />} title={<span className="text-loss">{t('sprint.strike')}</span>} />
              ) : (
                <SolverStatus solver={solver} done={<StatusLine icon={<ClassificationIcon c="best" size={36} />} title={t('puzzles.solved')} />} />
              )}
            </div>
            <div className="border-t border-line p-3">
              <button className="btn-ghost h-10 w-full" onClick={() => void end()}>{t('sprint.finish')}</button>
            </div>
            <SolverNav solver={solver} />
          </div>

          {!!run.results.length && (
            <div className="panel p-4">
              <Results results={run.results} />
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

/** Time left; turns red in the last seconds and fires `onExpire` once at zero. */
function Countdown({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [now, setNow] = useState(Date.now());
  const expire = useRef(onExpire);
  expire.current = onExpire;
  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) expire.current();
    };
    const id = window.setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);
  const left = Math.max(0, deadline - now);
  // Rounded up: the clock shows 0:00 only when time is really over.
  return <span className={`tabular text-2xl font-bold ${left <= 10_000 ? 'text-loss' : 'text-ink'}`}>{formatClock(Math.ceil(left / 1000) * 1000)}</span>;
}

function Strikes({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1.5" role="img" aria-label={t('sprint.strikesLabel', { count, max: MAX_STRIKES })}>
      {Array.from({ length: MAX_STRIKES }, (_, i) => (
        <span
          key={i}
          className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold ${i < count ? 'bg-loss/20 text-loss' : 'bg-white/[0.04] text-ink-3'}`}
        >
          ✕
        </span>
      ))}
    </div>
  );
}

/** The run's puzzles by rating, green or red; links to replay them once the run is over. */
function Results({ results, links }: { results: SprintResult[]; links?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1">
      {results.map((r) => {
        const className = `tabular rounded px-1.5 py-0.5 text-xs font-semibold ${r.solved ? 'bg-good/15 text-good' : 'bg-loss/15 text-loss'}`;
        const title = t(r.solved ? 'puzzles.solved' : 'puzzles.failed');
        return links ? (
          <Link key={r.puzzleId} to={`/puzzles/p/${r.puzzleId}`} title={title} className={className}>{r.rating}</Link>
        ) : (
          <span key={r.puzzleId} title={title} className={className}>{r.rating}</span>
        );
      })}
    </div>
  );
}

function SprintHome({ runs, starting, error, onStart }: { runs: SprintRun[]; starting: boolean; error: boolean; onStart: (m: SprintMode) => void }) {
  const { t } = useTranslation();
  const best = bestScores(runs);
  const last = runs[runs.length - 1];
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="panel space-y-4 p-6">
        <div>
          <h1 className="text-xl font-bold">{t('sprint.title')}</h1>
          <p className="mt-1 text-sm text-ink-2">{t('sprint.intro', { strikes: MAX_STRIKES })}</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SPRINT_MODES.map((m) => (
            <button key={m} className="btn-ghost flex h-auto flex-col gap-1 p-4" disabled={starting} onClick={() => onStart(m)}>
              <span className="font-semibold text-ink">{t(`sprint.modes.${m}`)}</span>
              <span className="text-xs text-ink-3">{t(`sprint.modeHints.${m}`)}</span>
              <span className="tabular text-xs text-ink-3">{t('sprint.best', { score: best[m] ?? '–' })}</span>
            </button>
          ))}
        </div>
        {starting && <p className="text-center text-sm text-ink-3">{t('common.loading')}</p>}
        {error && <p className="text-center text-sm text-loss">{t('sprint.noPuzzles')}</p>}
      </div>

      {last && (
        <div className="panel space-y-3 p-6">
          <div className="flex items-baseline gap-3">
            <span className="tabular text-4xl font-bold">{last.score}</span>
            <div className="min-w-0">
              <div className="font-semibold">
                {t('sprint.lastRun')}
                {isRecord(last, runs) && <span className="ml-2 text-sm text-good">{t('sprint.newRecord')}</span>}
              </div>
              <div className="text-sm text-ink-3">{t(`sprint.modes.${last.mode}`)} · {formatSeconds(last.durationMs)}</div>
            </div>
          </div>
          <Results results={last.results} links />
          <p className="text-xs text-ink-3">{t('sprint.reviewHint')}</p>
        </div>
      )}
    </div>
  );
}

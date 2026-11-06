import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import ClassificationIcon from '../components/ClassificationIcon';
import { ExternalIcon } from '../components/icons';
import PuzzleTabs from '../components/puzzle/PuzzleTabs';
import Clock from '../components/puzzle/Clock';
import { SolverBoard, SolverNav, SolverStatus, StatusLine } from '../components/puzzle/Solver';
import { Delta, ThemeChips, ThemeSelect } from '../components/puzzle/Bits';
import { puzzleFacts } from '../puzzles/solve';
import { getPuzzle, localThemes, nextPuzzle, savePuzzle, warmBuckets } from '../puzzles/source';
import { INITIAL_RATING, PROVISIONAL_RD, updateRating, type Rating } from '../puzzles/rating';
import { DIFFICULTIES, usePuzzlePrefs, type Difficulty } from '../puzzles/prefs';
import { useSolver, type FinishResult, type SolveResult } from '../puzzles/useSolver';
import type { Puzzle, PuzzleAttempt, PuzzleMode } from '../types';

const RATING_WINDOW = 150;

type Load = 'loading' | 'ready' | 'empty' | 'error';

export default function Puzzles() {
  const { t } = useTranslation();
  const routeId = useParams().id;
  const navigate = useNavigate();
  const { theme, setTheme, difficulty, setDifficulty, rated, setRated } = usePuzzlePrefs();

  const lastRated = useLiveQuery(() => db.puzzleAttempts.where('mode').equals('rated').last(), []);
  const rating: Rating = lastRated?.ratingAfter
    ? { rating: lastRated.ratingAfter, rd: lastRated.rdAfter ?? INITIAL_RATING.rd }
    : INITIAL_RATING;
  const history = useLiveQuery(
    () => db.puzzleAttempts.orderBy('id').reverse().filter((a) => a.mode === 'rated' || a.mode === 'practice').limit(40).toArray(),
    [],
  );
  const [themes, setThemes] = useState<string[]>([]);
  useEffect(() => void localThemes().then(setThemes), []);
  // Keep the puzzles around the user's level available offline.
  useEffect(() => void warmBuckets(rating.rating), [Math.round(rating.rating / 100)]);

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [mode, setMode] = useState<PuzzleMode>('practice');
  const [load, setLoad] = useState<Load>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState<PuzzleAttempt | null>(null);
  const [reload, setReload] = useState(0);
  /** Id of the attempt recorded at settle time, completed with the timings when the line ends. */
  const attemptId = useRef<Promise<number> | null>(null);

  // Load the requested puzzle, or the next one matching the filters.
  useEffect(() => {
    let cancelled = false;
    setLoad('loading');
    setPuzzle(null);
    setAttempt(null);
    attemptId.current = null;
    const target = rating.rating + DIFFICULTIES[difficulty];
    const request = routeId
      ? getPuzzle(routeId)
      : nextPuzzle({ theme: theme || undefined, min: target - RATING_WINDOW, max: target + RATING_WINDOW });
    request
      .then(async (p) => {
        if (cancelled) return;
        if (!p) return setLoad('empty');
        // Only a first attempt counts for the rating.
        const seen = await db.puzzleAttempts.where('puzzleId').equals(p.id).count();
        if (cancelled) return;
        void savePuzzle(p);
        setMode(rated && !seen ? 'rated' : 'practice');
        setPuzzle(p);
        setLoad('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoad('error');
      });
    return () => {
      cancelled = true;
    };
    // The rating is read once per load, not tracked: a new rating must not skip the current puzzle.
  }, [routeId, theme, difficulty, reload]);

  /** Records the attempt the first time the result is known (clean solve, mistake, hint or solution). */
  function onSettle(r: SolveResult) {
    if (!puzzle) return;
    const after = mode === 'rated' ? updateRating(rating, puzzle.rating, r.solved) : undefined;
    const record: PuzzleAttempt = {
      puzzleId: puzzle.id,
      mode,
      startedAt: r.startedAt,
      timeMs: r.timeMs,
      solved: r.solved,
      mistakes: r.mistakes,
      usedHint: r.usedHint,
      usedSolution: r.usedSolution,
      puzzleRating: puzzle.rating,
      wrongMoves: r.wrongMoves,
      moveTimes: r.moveTimes,
      ...puzzleFacts(puzzle),
      ...(after && { ratingBefore: rating.rating, ratingAfter: after.rating, rdAfter: after.rd }),
    };
    setAttempt(record);
    attemptId.current = db.puzzleAttempts.add(record) as Promise<number>;
  }

  /** Completes the record with what happened after the result was settled. */
  function onFinish(r: FinishResult) {
    const patch = {
      totalMs: r.totalMs,
      completed: r.completed,
      mistakes: r.mistakes,
      wrongMoves: r.wrongMoves,
      moveTimes: r.moveTimes,
      usedHint: r.usedHint,
      usedSolution: r.usedSolution,
    };
    void attemptId.current?.then((id) => db.puzzleAttempts.update(id, patch));
  }

  const solver = useSolver(load === 'ready' ? puzzle : null, { retry: true, onSettle, onFinish });

  function next() {
    if (routeId) navigate('/puzzles');
    else setReload((n) => n + 1);
  }

  const delta = attempt?.ratingAfter !== undefined ? attempt.ratingAfter - attempt.ratingBefore! : undefined;
  const lastDelta = lastRated?.ratingAfter !== undefined ? lastRated.ratingAfter - lastRated.ratingBefore! : undefined;
  const provisional = rating.rd > PROVISIONAL_RD;
  const clock = <Clock from={solver.startedAt} to={solver.endedAt} className="text-sm text-ink-3" />;

  const status =
    load === 'loading' ? (
      <StatusLine title={<span className="text-ink-3">{t('common.loading')}</span>} />
    ) : load === 'empty' ? (
      <StatusLine title={t('puzzles.empty')} />
    ) : load === 'error' ? (
      <StatusLine
        title={<span className="text-loss">{t('puzzles.errorTitle')}</span>}
        sub={t(!navigator.onLine ? 'puzzles.offline' : error === 'rateLimited' ? 'puzzles.rateLimited' : 'puzzles.loadError', { error })}
      />
    ) : (
      <SolverStatus
        solver={solver}
        aside={clock}
        done={
          <StatusLine
            icon={<ClassificationIcon c={attempt?.solved ? 'best' : 'mistake'} size={36} />}
            title={t(attempt?.solved ? 'puzzles.solved' : 'puzzles.finished')}
            sub={delta !== undefined ? <Delta value={delta} /> : t('puzzles.practiceDone')}
            aside={clock}
          />
        }
      />
    );

  const solvedCount = history?.filter((a) => a.solved).length ?? 0;

  return (
    <>
      <PuzzleTabs />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <SolverBoard solver={solver} />

        <aside className="space-y-3 lg:sticky lg:top-[72px]">
          <div className="panel">
            <div className="p-4">{status}</div>

            {puzzle && load === 'ready' && (
              <div className="space-y-2 border-t border-line px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-ink-3">{t('puzzles.puzzle')}</span>
                  {solver.done || mode === 'practice' ? (
                    <span className="tabular font-semibold">{puzzle.rating}</span>
                  ) : (
                    <span className="cursor-help font-semibold text-ink-3" title={t('puzzles.hiddenRating')}>?</span>
                  )}
                  {mode === 'practice' && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-ink-3">{t('puzzles.practice')}</span>
                  )}
                  <a
                    className="ml-auto inline-flex items-center gap-1 text-xs text-ink-3 hover:text-accent"
                    href={`https://lichess.org/training/${puzzle.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lichess <ExternalIcon className="h-3.5 w-3.5" />
                  </a>
                </div>
                {solver.done && <ThemeChips themes={puzzle.themes} />}
              </div>
            )}

            <div className="flex gap-2 border-t border-line p-3">
              {solver.done || load === 'empty' || load === 'error' ? (
                <button className="btn-primary h-10 flex-1" onClick={next}>{t('puzzles.next')}</button>
              ) : (
                <>
                  <button className="btn-ghost h-10 flex-1" onClick={solver.showHint} disabled={solver.phase !== 'play' || solver.hint}>
                    {t('puzzles.hint')}
                  </button>
                  <button className="btn-ghost h-10 flex-1" onClick={solver.showSolution} disabled={solver.phase !== 'play'}>
                    {t('puzzles.showSolution')}
                  </button>
                </>
              )}
            </div>

            <SolverNav solver={solver} />
          </div>

          <div className="panel space-y-4 p-4">
            <div className="flex items-end gap-3">
              <div>
                <div className="text-xs text-ink-3">{t('puzzles.rating')}</div>
                <div className="flex items-baseline gap-2">
                  <span className="tabular text-3xl font-bold">
                    {rating.rating}
                    {provisional && <span className="text-ink-3" title={t('puzzles.provisional')}>?</span>}
                  </span>
                  {lastDelta !== undefined && <span className="text-sm"><Delta value={lastDelta} /></span>}
                </div>
              </div>
              <label className="ml-auto flex items-center gap-2 pb-1 text-sm text-ink-2">
                <input type="checkbox" className="accent-accent" checked={rated} onChange={(e) => setRated(e.target.checked)} />
                {t('puzzles.rated')}
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-3">
                {t('puzzles.theme')}
                <ThemeSelect themes={themes} value={theme} onChange={(v) => { setTheme(v); if (routeId) navigate('/puzzles'); }} />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-3">
                {t('puzzles.difficulty')}
                <select className="input" value={difficulty} onChange={(e) => { setDifficulty(e.target.value as Difficulty); if (routeId) navigate('/puzzles'); }}>
                  {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                    <option key={d} value={d}>{t(`puzzles.difficulties.${d}`)}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {!!history?.length && (
            <div className="panel p-4">
              <div className="mb-2 flex items-center text-xs text-ink-3">
                {t('puzzles.history')}
                <span className="tabular ml-auto">{t('puzzles.solvedCount', { solved: solvedCount, total: history.length })}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {history.map((a) => (
                  <Link
                    key={a.id}
                    to={`/puzzles/p/${a.puzzleId}`}
                    title={t(a.solved ? 'puzzles.solved' : 'puzzles.failed')}
                    className={`tabular rounded px-1.5 py-0.5 text-xs font-semibold ${
                      a.solved ? 'bg-good/15 text-good' : 'bg-loss/15 text-loss'
                    } ${a.puzzleId === puzzle?.id ? 'ring-1 ring-ink' : ''}`}
                  >
                    {a.puzzleRating}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

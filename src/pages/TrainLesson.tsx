import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../db';
import { LockIcon } from '../components/icons';
import ClassificationIcon from '../components/ClassificationIcon';
import { Progress } from '../components/puzzle/Section';
import { ThemeChips } from '../components/puzzle/Bits';
import { SolverBoard, SolverNav, SolverStatus, StatusLine } from '../components/puzzle/Solver';
import { useSolver, type FinishResult } from '../puzzles/useSolver';
import { puzzleFacts } from '../puzzles/solve';
import { savePuzzle } from '../puzzles/source';
import { buildLesson } from '../training/exercises';
import { baselineOf, buildPath, cleanStreak, drillTarget } from '../training/path';
import { useWeaknesses, weaknessLabel } from '../training/useWeaknesses';
import type { Puzzle, PuzzleAttempt } from '../types';

/** Pause after a clean solve before the next exercise comes up. */
const ADVANCE_DELAY = 600;

export default function TrainLesson() {
  const { t } = useTranslation();
  const id = decodeURIComponent(useParams().id ?? '');
  const weaknesses = useWeaknesses();
  const weakness = weaknesses?.find((w) => w.id === id);
  const progress = useLiveQuery(() => db.trainProgress.toArray(), []);
  const node = weaknesses && progress ? buildPath(weaknesses, progress).find((n) => n.weakness.id === id) : undefined;
  const status = node?.status;

  const [queue, setQueue] = useState<Puzzle[]>();
  const [ownCount, setOwnCount] = useState(0);
  const [position, setPosition] = useState(0);
  const [solved, setSolved] = useState(0);
  const [last, setLast] = useState<FinishResult | null>(null);
  /** Bumped to build a fresh round of exercises for the same lesson. */
  const [round, setRound] = useState(0);
  const [passedNow, setPassedNow] = useState(false);
  const advanceTimer = useRef<number | undefined>(undefined);

  // The lesson is built once per weakness, not rebuilt when the games list refreshes.
  const weaknessId = status === 'locked' ? undefined : weakness?.id;
  useEffect(() => {
    if (!weakness || !weaknessId) return;
    let cancelled = false;
    void buildLesson(weakness).then((l) => {
      if (cancelled) return;
      setOwnCount(l.own.length);
      setQueue([...l.own, ...l.practice]);
      setPosition(0);
      setSolved(0);
      setLast(null);
      setPassedNow(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weaknessId, round]);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const puzzle = queue && position < queue.length ? queue[position] : null;

  function advance() {
    clearTimeout(advanceTimer.current);
    setLast(null);
    setPosition((p) => p + 1);
  }

  function onFinish(r: FinishResult) {
    if (!puzzle || !weakness) return;
    setLast(r);
    if (r.solved) setSolved((n) => n + 1);
    void savePuzzle(puzzle);
    const attempt: PuzzleAttempt = {
      puzzleId: puzzle.id,
      mode: 'train',
      weaknessId: weakness.id,
      startedAt: r.startedAt,
      timeMs: r.timeMs,
      totalMs: r.totalMs,
      solved: r.solved,
      completed: r.completed,
      mistakes: r.mistakes,
      usedHint: r.usedHint,
      usedSolution: r.usedSolution,
      wrongMoves: r.wrongMoves,
      moveTimes: r.moveTimes,
      puzzleRating: puzzle.rating,
      ...puzzleFacts(puzzle),
    };
    void (async () => {
      await db.puzzleAttempts.add(attempt);
      if (status === 'done' || !queue) return;
      const mine = await db.puzzleAttempts.where('mode').equals('train').filter((a) => a.weaknessId === weakness.id).toArray();
      if (cleanStreak(mine) < drillTarget(queue.length)) return;
      await db.trainProgress.put({ id: weakness.id, passedAt: Date.now(), baseline: baselineOf(weakness) });
      // Drilled: nothing more to play in this lesson.
      setQueue(queue.slice(0, position + 1));
      setPassedNow(true);
    })();
    if (r.solved) advanceTimer.current = window.setTimeout(advance, ADVANCE_DELAY);
  }

  const solver = useSolver(puzzle, { retry: false, onFinish });

  if (!weaknesses || (weakness && !queue)) return <p className="text-ink-3">{t('train.loading')}</p>;
  if (weakness && status === 'locked')
    return (
      <div className="panel mx-auto max-w-lg space-y-4 p-6 text-center">
        <LockIcon className="mx-auto h-8 w-8 text-ink-3" />
        <p className="text-ink-2">{t('train.lockedLesson')}</p>
        <Link to="/train" className="btn-primary h-10 w-full">{t('train.back')}</Link>
      </div>
    );
  if (!weakness)
    return (
      <div className="panel mx-auto max-w-lg space-y-4 p-6 text-center">
        <p className="text-ink-2">{t('train.lessonGone')}</p>
        <Link to="/train" className="btn-primary h-10 w-full">{t('train.back')}</Link>
      </div>
    );

  const total = queue?.length ?? 0;
  const label = weaknessLabel(t, weakness);

  if (!puzzle)
    return (
      <div className="panel mx-auto max-w-lg space-y-4 p-6 text-center">
        <h1 className="font-display text-xl font-bold">{label}</h1>
        {total === 0 ? (
          <p className="text-ink-2">{t('train.noExercises')}</p>
        ) : passedNow || status === 'done' ? (
          <p className="text-good">{t(passedNow ? 'train.lessonPassed' : 'train.lessonDone', { solved, total })}</p>
        ) : (
          <p className="text-ink-2">{t('train.lessonRetry', { solved, total, target: drillTarget(total) })}</p>
        )}
        {total > 0 && !passedNow && (
          <button className="btn-primary h-10 w-full" onClick={() => setRound((r) => r + 1)}>{t('train.again')}</button>
        )}
        <Link to="/train" className="btn-ghost h-10 w-full">{t('train.back')}</Link>
      </div>
    );

  const own = position < ownCount;
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <SolverBoard solver={solver} />
      <aside className="space-y-3 lg:sticky lg:top-[72px]">
        <div className="panel space-y-3 p-4">
          <div className="flex items-baseline gap-2">
            <Link to="/train" className="min-w-0 truncate font-semibold hover:text-accent">{label}</Link>
            <span className="chip ml-auto shrink-0">{t(own ? 'train.yourMistake' : 'train.practiceTag')}</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-ink-3">
              <span>{t('train.progress')}</span>
              <span className="tabular">{position}/{total}</span>
            </div>
            <Progress value={position} total={total} />
          </div>
        </div>
        <div className="panel">
          <div className="p-4">
            <SolverStatus
              solver={solver}
              done={
                <StatusLine
                  icon={<ClassificationIcon c={last?.solved ? 'best' : 'mistake'} size={36} />}
                  title={t(last?.solved ? 'puzzles.solved' : 'train.missed')}
                  sub={!last?.solved && own ? t('train.ownMissedSub') : undefined}
                />
              }
            />
          </div>
          {solver.done && !own && puzzle.themes.length > 0 && (
            <div className="border-t border-line px-4 py-3"><ThemeChips themes={puzzle.themes} /></div>
          )}
          <div className="flex gap-2 border-t border-line p-3">
            {solver.done && last ? (
              <button className="btn-primary h-10 flex-1" onClick={advance}>{t('puzzles.next')}</button>
            ) : (
              <button className="btn-ghost h-10 flex-1" onClick={solver.showSolution} disabled={solver.phase !== 'play'}>
                {t('woodpecker.giveUp')}
              </button>
            )}
          </div>
          <SolverNav solver={solver} />
        </div>
      </aside>
    </div>
  );
}

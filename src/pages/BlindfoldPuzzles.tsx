import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { useTranslation } from 'react-i18next';
import ClassificationIcon from '../components/ClassificationIcon';
import PuzzleTabs from '../components/puzzle/PuzzleTabs';
import Overview from '../components/blindfold/Overview';
import MoveInput from '../components/blindfold/MoveInput';
import { SolverBoard, SolverNav, SolverStatus, StatusLine } from '../components/puzzle/Solver';
import { db } from '../db';
import { BLINDFOLD_LEVELS, WINDOW_SECONDS, isBlindfoldFriendly, nextRating, useBlindfoldPrefs } from '../blindfold/prefs';
import { canSpeak, describePosition, langOf, speak, spokenMove, stopSpeaking } from '../blindfold/speech';
import { sampleLocal, savePuzzle, warmBuckets } from '../puzzles/source';
import { puzzleFacts, toMove } from '../puzzles/solve';
import { useSolver, type SolveResult } from '../puzzles/useSolver';
import type { Puzzle } from '../types';

/** Rating windows tried in turn: offline, only the buckets already cached can answer. */
const WINDOWS = [50, 150, 400, 3000];

export default function BlindfoldPuzzles() {
  const { t, i18n } = useTranslation();
  const lang = langOf(i18n.language);
  const { level, setLevel, rating, setRating, voice, setVoice } = useBlindfoldPrefs();
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  /** The board was shown on request: counts as a hint. */
  const [revealed, setRevealed] = useState(false);
  /** Inside the opening window of the peek and blind levels. */
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState({ solved: 0, total: 0 });
  const seen = useRef(new Set<string>());
  const windowTimer = useRef<number | undefined>(undefined);
  const windowFor = useRef<string | undefined>(undefined);

  useEffect(() => void warmBuckets(rating, 400), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      clearTimeout(windowTimer.current);
      stopSpeaking();
    },
    [],
  );

  async function next(target = rating) {
    setLoading(true);
    setError(false);
    let found: Puzzle | undefined;
    for (const w of WINDOWS) {
      const candidates = await sampleLocal({ min: target - w, max: target + w }, 40).catch(() => [] as Puzzle[]);
      found = candidates.find((p) => isBlindfoldFriendly(p) && !seen.current.has(p.id));
      if (found) break;
    }
    setLoading(false);
    if (!found) return setError(true);
    seen.current.add(found.id);
    void savePuzzle(found);
    clearTimeout(windowTimer.current);
    stopSpeaking();
    setRevealed(false);
    setOpen(false);
    setPuzzle(found);
  }

  function onSettle(r: SolveResult) {
    if (!puzzle) return;
    void db.puzzleAttempts.add({
      puzzleId: puzzle.id,
      mode: 'blindfold',
      startedAt: r.startedAt,
      timeMs: r.timeMs,
      totalMs: r.timeMs,
      solved: r.solved,
      completed: r.solved,
      mistakes: r.mistakes,
      usedHint: r.usedHint,
      usedSolution: r.usedSolution,
      wrongMoves: r.wrongMoves,
      moveTimes: r.moveTimes,
      puzzleRating: puzzle.rating,
      ...puzzleFacts(puzzle),
    });
    setRating(nextRating(rating, r.solved));
    setSession((s) => ({ solved: s.solved + (r.solved ? 1 : 0), total: s.total + 1 }));
  }

  const solver = useSolver(puzzle, { retry: true, onSettle });

  // The line in SAN, to read the opponent's moves out.
  const sans = useMemo(() => {
    if (!puzzle) return [];
    const chess = new Chess(puzzle.fen);
    return puzzle.moves.map((m) => chess.move(toMove(m)).san);
  }, [puzzle]);
  const opponentSan = solver.phase === 'play' && solver.shownPly > 0 ? sans[solver.shownPly - 1] : undefined;

  // The opponent has just moved: say it.
  useEffect(() => {
    if (voice && opponentSan) speak(spokenMove(opponentSan, lang), lang);
  }, [opponentSan, solver.shownPly, voice, lang]);

  // The opening window of the peek and blind levels starts when the player can first move.
  useEffect(() => {
    if (level === 'list' || solver.phase !== 'play' || !puzzle || windowFor.current === puzzle.id) return;
    windowFor.current = puzzle.id;
    setOpen(true);
    windowTimer.current = window.setTimeout(() => setOpen(false), WINDOW_SECONDS[level] * 1000);
  }, [level, solver.phase, puzzle]);

  const boardVisible = revealed || solver.phase === 'solution' || solver.done || (level === 'peek' && open);
  const listVisible = !boardVisible && (level === 'list' || (level === 'blind' && open));
  const position = useMemo(() => describePosition(solver.board.fen, lang), [solver.board.fen, lang]);

  function reveal() {
    setRevealed(true);
    solver.showHint();
  }

  function readPosition() {
    speak(`${t('common.white')}. ${position.white}. ${t('common.black')}. ${position.black}.`, lang);
  }

  if (!puzzle)
    return (
      <>
        <PuzzleTabs />
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="panel space-y-4 p-6">
            <div>
              <h1 className="text-xl font-bold">{t('blindfold.title')}</h1>
              <p className="mt-1 text-sm text-ink-2">{t('blindfold.intro')}</p>
            </div>
            <LevelPicker level={level} onChange={setLevel} />
            <div className="flex items-center justify-between gap-3">
              <span className="tabular text-sm text-ink-3">{t('blindfold.rating', { rating })}</span>
              <button className="btn-primary h-11 px-6" disabled={loading} onClick={() => void next()}>
                {loading ? t('common.loading') : t('blindfold.start')}
              </button>
            </div>
            {error && <p className="text-center text-sm text-loss">{t('blindfold.noPuzzles')}</p>}
          </div>
          <Overview />
        </div>
      </>
    );

  const missed = solver.result && !solver.result.solved;
  const done = (
    <StatusLine
      icon={<ClassificationIcon c={missed ? 'mistake' : 'best'} size={36} />}
      title={missed ? <span className="text-loss">{t('blindfold.missed')}</span> : t('puzzles.solved')}
      sub={t('blindfold.nextRating', { rating })}
    />
  );

  return (
    <>
      <PuzzleTabs />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <SolverBoard solver={solver} hidePieces={!boardVisible} movable={false} />

        <aside className="space-y-3 lg:sticky lg:top-[72px]">
          <div className="panel space-y-3 p-4">
            <LevelPicker level={level} onChange={setLevel} />
            <div className="flex items-center justify-between text-sm text-ink-3">
              <span className="tabular">{t('blindfold.rating', { rating })}</span>
              <span className="tabular">{t('blindfold.session', session)}</span>
            </div>
          </div>

          <div className="panel">
            <div className="space-y-3 p-4">
              <SolverStatus solver={solver} done={done} />
              {opponentSan && (
                <p className="text-sm text-ink-2">
                  {t('blindfold.opponentPlayed')} <span className="font-mono text-base font-bold text-ink">{opponentSan}</span>
                </p>
              )}
              {listVisible && (
                <dl className="space-y-1 rounded-lg bg-panel-2/60 p-3 text-sm">
                  <div>
                    <dt className="inline font-semibold">{t('common.white')}: </dt>
                    <dd className="inline text-ink-2">{position.white}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold">{t('common.black')}: </dt>
                    <dd className="inline text-ink-2">{position.black}</dd>
                  </div>
                </dl>
              )}
              {!solver.done && <MoveInput fen={solver.board.fen} lang={lang} disabled={solver.phase !== 'play'} onMove={solver.onMove} />}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-line p-3">
              {!solver.done && (
                <>
                  {canSpeak() && (
                    <button className="btn-ghost h-10 flex-1" onClick={readPosition}>
                      {t('blindfold.readPosition')}
                    </button>
                  )}
                  <button className="btn-ghost h-10 flex-1" disabled={boardVisible || solver.phase !== 'play'} onClick={reveal}>
                    {t('blindfold.reveal')}
                  </button>
                  <button className="btn-ghost h-10 flex-1" onClick={solver.showSolution} disabled={solver.phase !== 'play'}>
                    {t('puzzles.showSolution')}
                  </button>
                </>
              )}
              {canSpeak() && (
                <label className="flex h-10 items-center gap-2 px-2 text-sm text-ink-2">
                  <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
                  {t('blindfold.voice')}
                </label>
              )}
              <button className="btn-primary h-10 flex-1" disabled={loading} onClick={() => void next()}>
                {t('blindfold.nextPuzzle')}
              </button>
            </div>
            {error && <p className="px-4 pb-3 text-sm text-loss">{t('blindfold.noPuzzles')}</p>}
            <SolverNav solver={solver} />
          </div>
        </aside>
      </div>
    </>
  );
}

function LevelPicker({ level, onChange }: { level: (typeof BLINDFOLD_LEVELS)[number]; onChange: (l: (typeof BLINDFOLD_LEVELS)[number]) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <div className="segmented flex" role="radiogroup" aria-label={t('blindfold.level')}>
        {BLINDFOLD_LEVELS.map((l) => (
          <button key={l} role="radio" aria-checked={l === level} className={`segmented-item flex-1`} onClick={() => onChange(l)}>
            {t(`blindfold.levels.${l}`)}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-3">{t(`blindfold.levelHints.${level}`)}</p>
    </div>
  );
}

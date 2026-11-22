import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import ClassificationIcon from '../components/ClassificationIcon';
import PuzzleTabs from '../components/puzzle/PuzzleTabs';
import Clock from '../components/puzzle/Clock';
import { SolverBoard, SolverNav, SolverStatus, StatusLine } from '../components/puzzle/Solver';
import { ThemeChips } from '../components/puzzle/Bits';
import { puzzleFacts } from '../puzzles/solve';
import { useSolver, type FinishResult, type SolveResult } from '../puzzles/useSolver';
import { SET_SIZES, createFromOwn } from '../puzzles/woodpecker';
import { DEFAULT_MIN_LOSS, MIN_LOSS_CHOICES, mistakePuzzles, saveMistakePuzzles, type OwnMistake } from '../training/mistakes';
import { useOwnMistakes } from '../training/useMistakes';
import type { Puzzle, PuzzleAttempt } from '../types';

/** Rows shown before "show more": the list can hold hundreds of mistakes. */
const PAGE = 25;

export default function MyMistakes() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [minLoss, setMinLoss] = useState(DEFAULT_MIN_LOSS);
  const [unsolvedOnly, setUnsolvedOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const mistakes = useOwnMistakes(minLoss);
  const attempts = useLiveQuery(() => db.puzzleAttempts.where('mode').equals('mistakes').toArray(), []);
  const date = useMemo(() => new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' }), [i18n.resolvedLanguage]);

  /** Per puzzle: has it ever been solved cleanly, and was it tried at all. */
  const status = useMemo(() => {
    const map = new Map<string, 'solved' | 'failed'>();
    for (const a of attempts ?? []) if (map.get(a.puzzleId) !== 'solved') map.set(a.puzzleId, a.solved ? 'solved' : 'failed');
    return map;
  }, [attempts]);

  const list = useMemo(() => (unsolvedOnly ? mistakes?.filter((m) => status.get(m.id) !== 'solved') : mistakes), [mistakes, unsolvedOnly, status]);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = list?.find((m) => m.id === selectedId) ?? list?.[0];

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [attempt, setAttempt] = useState<PuzzleAttempt | null>(null);
  const attemptId = useRef<Promise<number> | null>(null);

  // Builds the puzzle of the selected mistake from its stored engine lines.
  const selectedKey = selected?.id;
  useEffect(() => {
    setPuzzle(null);
    setAttempt(null);
    attemptId.current = null;
    if (!selected) return;
    let cancelled = false;
    void mistakePuzzles([selected]).then(async ([p]) => {
      if (cancelled || !p) return;
      await saveMistakePuzzles([p]);
      if (!cancelled) setPuzzle(p);
    });
    return () => {
      cancelled = true;
    };
    // `selected` is rebuilt with every list refresh; only a different mistake needs a new puzzle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  function onSettle(r: SolveResult) {
    if (!puzzle) return;
    const record: PuzzleAttempt = {
      puzzleId: puzzle.id,
      mode: 'mistakes',
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
    };
    setAttempt(record);
    attemptId.current = db.puzzleAttempts.add(record) as Promise<number>;
  }

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

  const solver = useSolver(puzzle, { retry: true, onSettle, onFinish });

  function next() {
    if (!list || !selected) return;
    const i = list.findIndex((m) => m.id === selected.id);
    const target = list.slice(i + 1).find((m) => status.get(m.id) !== 'solved') ?? list[i + 1] ?? list[0];
    setSelectedId(target.id);
    if (list.indexOf(target) >= shown) setShown(list.indexOf(target) + 1);
  }

  const clock = <Clock from={solver.startedAt} to={solver.endedAt} className="text-sm text-ink-3" />;
  const solvedCount = mistakes?.filter((m) => status.get(m.id) === 'solved').length ?? 0;

  return (
    <>
      <PuzzleTabs />
      <div className="mb-5 space-y-1">
        <h1 className="font-display text-2xl font-bold">{t('mistakes.title')}</h1>
        <p className="text-ink-3">{t('mistakes.subtitle')}</p>
      </div>

      {!mistakes ? (
        <p className="text-ink-3">{t('mistakes.loading')}</p>
      ) : mistakes.length === 0 ? (
        <div className="panel space-y-3 p-6 text-center">
          <p className="text-ink-2">{t('mistakes.empty', { loss: minLoss })}</p>
          {minLoss > MIN_LOSS_CHOICES[0] && (
            <button className="btn-ghost" onClick={() => setMinLoss(MIN_LOSS_CHOICES[0])}>{t('mistakes.showSmaller')}</button>
          )}
          <Link to="/games" className="btn-primary mx-auto h-10 max-w-xs">{t('mistakes.goAnalyse')}</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <SolverBoard solver={solver} />

          <aside className="space-y-3 lg:sticky lg:top-[72px]">
            <div className="panel">
              <div className="p-4">
                {!selected ? (
                  <StatusLine title={t('mistakes.allSolved')} />
                ) : !puzzle ? (
                  <StatusLine title={<span className="text-ink-3">{t('common.loading')}</span>} />
                ) : (
                  <SolverStatus
                    solver={solver}
                    aside={clock}
                    done={
                      <StatusLine
                        icon={<ClassificationIcon c={attempt?.solved ? 'best' : 'mistake'} size={36} />}
                        title={t(attempt?.solved ? 'mistakes.fixed' : 'mistakes.stillMissed')}
                        sub={!attempt?.solved ? t('mistakes.stillMissedSub') : undefined}
                        aside={clock}
                      />
                    }
                  />
                )}
              </div>
              {selected && puzzle && (
                <div className="space-y-2 border-t border-line px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-ink-3">
                    <ClassificationIcon c={selected.classification} size={16} />
                    <span>{t(`classification.${selected.classification}`)}</span>
                    <span className="tabular">−{Math.round(selected.example.loss)}%</span>
                    <Link
                      to={`/game/${encodeURIComponent(selected.game.id)}?ply=${selected.example.ply}`}
                      className="ml-auto text-xs hover:text-accent"
                    >
                      {t('mistakes.openGame')}
                    </Link>
                  </div>
                  {solver.done && selected.themes.length > 0 && <ThemeChips themes={selected.themes} />}
                </div>
              )}
              <div className="flex gap-2 border-t border-line p-3">
                {solver.done || !selected ? (
                  <button className="btn-primary h-10 flex-1" onClick={next} disabled={!selected}>{t('puzzles.next')}</button>
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

            <div className="panel space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex min-w-0 flex-col gap-1 text-xs text-ink-3">
                  {t('mistakes.minLoss')}
                  <select className="input" value={minLoss} onChange={(e) => { setMinLoss(Number(e.target.value)); setShown(PAGE); }}>
                    {MIN_LOSS_CHOICES.map((n) => (
                      <option key={n} value={n}>{t('mistakes.lossChoice', { loss: n })}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-end gap-2 pb-2 text-sm text-ink-2">
                  <input type="checkbox" className="accent-accent" checked={unsolvedOnly} onChange={(e) => setUnsolvedOnly(e.target.checked)} />
                  {t('mistakes.unsolvedOnly')}
                </label>
              </div>
              <div className="flex items-center text-xs text-ink-3">
                {t('mistakes.count', { count: mistakes.length })}
                <span className="tabular ml-auto">{t('puzzles.solvedCount', { solved: solvedCount, total: mistakes.length })}</span>
              </div>
              <ul className="-mx-2 max-h-80 divide-y divide-line overflow-y-auto">
                {list?.slice(0, shown).map((m) => (
                  <MistakeRow
                    key={m.id}
                    mistake={m}
                    active={m.id === selected?.id}
                    state={status.get(m.id)}
                    date={date.format(m.game.endTime)}
                    onSelect={() => setSelectedId(m.id)}
                  />
                ))}
              </ul>
              {list && list.length > shown && (
                <button className="btn-ghost w-full" onClick={() => setShown((n) => n + PAGE)}>{t('mistakes.showMore')}</button>
              )}
            </div>

            <SetBuilder key={mistakes.length} mistakes={mistakes} onCreated={(id) => navigate(`/puzzles/woodpecker/${id}`)} />
          </aside>
        </div>
      )}
    </>
  );
}

function MistakeRow({ mistake: m, active, state, date, onSelect }: { mistake: OwnMistake; active: boolean; state?: 'solved' | 'failed'; date: string; onSelect: () => void }) {
  const { t } = useTranslation();
  const opponent = m.game.userColor === 'white' ? m.game.black.name : m.game.white.name;
  return (
    <li>
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-white/5 ${active ? 'bg-white/5' : ''}`}
      >
        <ClassificationIcon c={m.classification} size={18} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{t('mistakes.row', { move: Math.floor(m.example.ply / 2) + 1, opponent })}</span>
          <span className="block text-xs text-ink-3">{date}</span>
        </span>
        <span className="tabular text-xs text-ink-3">−{Math.round(m.example.loss)}%</span>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${state === 'solved' ? 'bg-good' : state === 'failed' ? 'bg-loss' : 'bg-white/15'}`}
          title={t(state === 'solved' ? 'mistakes.stateSolved' : state === 'failed' ? 'mistakes.stateFailed' : 'mistakes.stateNew')}
        />
      </button>
    </li>
  );
}

/** Gathers the mistakes shown above into a Woodpecker set. */
function SetBuilder({ mistakes, onCreated }: { mistakes: OwnMistake[]; onCreated: (setId: string) => void }) {
  const { t } = useTranslation();
  const sizes = SET_SIZES.filter((n) => n < mistakes.length);
  const [size, setSize] = useState(Math.min(mistakes.length, 50));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const options = [...sizes, mistakes.length];

  async function create() {
    setBusy(true);
    setError(false);
    try {
      const set = await createFromOwn(t('woodpecker.fromOwn'), await mistakePuzzles(mistakes), size);
      if (set) onCreated(set.id);
      else setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel space-y-3 p-4">
      <div>
        <div className="font-semibold">{t('mistakes.setTitle')}</div>
        <p className="text-xs text-ink-3">{t('mistakes.setHint')}</p>
      </div>
      <div className="flex gap-2">
        <select className="input flex-1" value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {[...new Set(options)].map((n) => (
            <option key={n} value={n}>{t('woodpecker.puzzleCount', { count: n })}</option>
          ))}
        </select>
        <button className="btn-primary" onClick={() => void create()} disabled={busy}>
          {busy ? t('common.loading') : t('woodpecker.create')}
        </button>
      </div>
      {error && <p className="text-sm text-loss">{t('woodpecker.noMatch')}</p>}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { fenAt, judgeMove, playerColor } from './solve';
import type { Classification, Color, Puzzle } from '../types';

/** Opponent moves and the solution playback are delayed so the player can follow them. */
const OPPONENT_DELAY = 500;
const WRONG_MOVE_SHOWN = 700;

export type SolverPhase = 'idle' | 'opponent' | 'play' | 'solution' | 'done';

/** The result as known when it is first settled (clean solve, first mistake, hint or solution). */
export interface SolveResult {
  solved: boolean;
  mistakes: number;
  usedHint: boolean;
  usedSolution: boolean;
  startedAt: number;
  timeMs: number;
  wrongMoves: string[];
  moveTimes: number[];
}

/** The final record once the line has been played to the end. */
export interface FinishResult extends SolveResult {
  totalMs: number;
  completed: boolean;
}

interface Options {
  /** Wrong moves can be retried (free play); otherwise a wrong move ends the puzzle and the solution plays. */
  retry: boolean;
  onSettle?: (r: SolveResult) => void;
  onFinish?: (r: FinishResult) => void;
}

/** A position shown instead of the puzzle line: a rejected move, or a mate other than the listed one. */
interface Override {
  fen: string;
  from: string;
  to: string;
  classification: Classification;
}

const fresh = () => ({
  readyAt: 0,
  turnAt: 0,
  mistakes: 0,
  usedHint: false,
  usedSolution: false,
  wrongMoves: [] as string[],
  moveTimes: [] as number[],
  settled: null as SolveResult | null,
});

/** Drives one puzzle: setup move, the player's moves, opponent replies, hint, solution and review. */
export function useSolver(puzzle: Puzzle | null, { retry, onSettle, onFinish }: Options) {
  const [current, setCurrent] = useState(puzzle);
  const [phase, setPhase] = useState<SolverPhase>('idle');
  const [ply, setPly] = useState(0);
  const [view, setView] = useState<number | null>(null);
  const [override, setOverride] = useState<Override | null>(null);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [hint, setHint] = useState(false);
  const [flipped, setFlipped] = useState<boolean | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);

  // Reset during render when the puzzle changes, so no frame shows the old state on the new puzzle.
  if (puzzle !== current) {
    setCurrent(puzzle);
    setPhase(puzzle ? 'opponent' : 'idle');
    setPly(0);
    setView(null);
    setOverride(null);
    setFeedback('none');
    setHint(false);
    setFlipped(null);
    setStartedAt(null);
    setEndedAt(null);
    setResult(null);
  }

  const track = useRef(fresh());
  const callbacks = useRef({ onSettle, onFinish });
  callbacks.current = { onSettle, onFinish };
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // Play the opponent's setup move, then hand over to the player.
  useEffect(() => {
    clearTimers();
    track.current = fresh();
    if (!puzzle) return;
    later(() => {
      const now = Date.now();
      track.current.readyAt = now;
      track.current.turnAt = now;
      setStartedAt(now);
      setPly(1);
      setPhase('play');
    }, OPPONENT_DELAY);
    return clearTimers;
  }, [puzzle]);

  const snapshot = (solved: boolean): SolveResult => {
    const t = track.current;
    return {
      solved,
      mistakes: t.mistakes,
      usedHint: t.usedHint,
      usedSolution: t.usedSolution,
      startedAt: t.readyAt,
      timeMs: Date.now() - t.readyAt,
      wrongMoves: [...t.wrongMoves],
      moveTimes: [...t.moveTimes],
    };
  };

  const settle = (solved: boolean) => {
    if (track.current.settled) return;
    const r = snapshot(solved);
    track.current.settled = r;
    setResult(r);
    callbacks.current.onSettle?.(r);
  };

  const finish = (completed: boolean) => {
    const now = Date.now();
    const settled = track.current.settled!;
    const latest = snapshot(settled.solved);
    setEndedAt(now);
    setPhase('done');
    callbacks.current.onFinish?.({ ...latest, timeMs: settled.timeMs, totalMs: now - track.current.readyAt, completed });
  };

  /** Plays the rest of the line from `from` on the board, then ends the puzzle. */
  const playSolution = (from: number) => {
    if (!puzzle) return;
    setOverride(null);
    setHint(false);
    setPhase('solution');
    const end = puzzle.moves.length;
    if (from >= end) return finish(false);
    for (let p = from + 1; p <= end; p++)
      later(() => {
        setPly(p);
        if (p === end) finish(false);
      }, (p - from) * OPPONENT_DELAY);
  };

  function onMove(from: string, to: string, piece: string): boolean {
    if (!puzzle || phase !== 'play' || override) return false;
    const expected = puzzle.moves[ply];
    const promotes = piece.endsWith('P') && (to[1] === '8' || to[1] === '1');
    // Promotion piece: the solution's when the squares match (no picker yet), else a queen.
    const promotion = promotes ? (expected.slice(0, 4) === from + to ? expected[4] : 'q') : undefined;
    const chess = new Chess(fenAt(puzzle.fen, puzzle.moves, ply));
    try {
      chess.move({ from, to, promotion });
    } catch {
      return false;
    }
    const uci = from + to + (promotion ?? '');
    const verdict = judgeMove(puzzle.fen, puzzle.moves, ply, uci);
    const t = track.current;
    const now = Date.now();
    t.moveTimes.push(now - t.turnAt);
    setHint(false);

    if (verdict === 'wrong') {
      t.mistakes++;
      t.wrongMoves.push(uci);
      settle(false);
      setFeedback('wrong');
      setOverride({ fen: chess.fen(), from, to, classification: 'mistake' });
      if (retry)
        later(() => {
          setOverride(null);
          t.turnAt = Date.now();
        }, WRONG_MOVE_SHOWN);
      else {
        setPhase('solution');
        later(() => playSolution(ply), WRONG_MOVE_SHOWN);
      }
      return true;
    }

    setFeedback('correct');
    if (verdict === 'solved') {
      if (uci === expected) setPly(ply + 1);
      else setOverride({ fen: chess.fen(), from, to, classification: 'best' });
      settle(!t.mistakes && !t.usedHint);
      finish(true);
      return true;
    }
    setPly(ply + 1);
    setPhase('opponent');
    later(() => {
      setPly(ply + 2);
      setPhase('play');
      t.turnAt = Date.now();
    }, OPPONENT_DELAY);
    return true;
  }

  function showHint() {
    if (phase !== 'play') return;
    track.current.usedHint = true;
    settle(false);
    setHint(true);
  }

  function showSolution() {
    if (phase !== 'play') return;
    track.current.usedSolution = true;
    settle(false);
    clearTimers();
    setFeedback('none');
    playSolution(ply);
  }

  const done = phase === 'done';
  const end = puzzle?.moves.length ?? 0;
  const shownPly = view ?? ply;
  const goTo = useCallback(
    (p: number) => {
      if (!done) return;
      setOverride(null);
      setView(Math.max(0, Math.min(end, p)));
    },
    [done, end],
  );

  const color: Color = puzzle ? playerColor(puzzle) : 'white';
  const isFlipped = flipped ?? color === 'black';
  const fen = useMemo(() => (puzzle ? fenAt(puzzle.fen, puzzle.moves, shownPly) : new Chess().fen()), [puzzle, shownPly]);
  const lastUci = puzzle && shownPly > 0 ? puzzle.moves[shownPly - 1] : undefined;
  const highlights = useMemo(
    () => (hint && puzzle && phase === 'play' ? { [puzzle.moves[ply].slice(0, 2)]: 'rgba(95, 176, 224, 0.6)' } : undefined),
    [hint, puzzle, phase, ply],
  );

  return {
    puzzle,
    phase,
    done,
    feedback,
    hint,
    result,
    color,
    startedAt,
    endedAt,
    shownPly,
    end,
    flipped: isFlipped,
    flip: () => setFlipped(!isFlipped),
    board: {
      fen: override?.fen ?? fen,
      lastMove: override ?? (lastUci ? { from: lastUci.slice(0, 2), to: lastUci.slice(2, 4) } : undefined),
      marker: override
        ? { square: override.to, classification: override.classification }
        : feedback === 'correct' && lastUci && view === null && shownPly % 2 === 0
          ? { square: lastUci.slice(2, 4), classification: 'best' as const }
          : undefined,
      highlights,
    },
    onMove,
    showHint,
    showSolution,
    goTo,
  };
}

export type Solver = ReturnType<typeof useSolver>;

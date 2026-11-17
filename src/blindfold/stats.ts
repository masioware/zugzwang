import { accuracy, DRILL_KINDS } from './drills';
import type { DrillKind, DrillRun, Game, PuzzleAttempt } from '../types';

export interface DrillSummary {
  kind: DrillKind;
  rounds: number;
  /** Best accuracy of any round, 0..1. */
  best: number;
  /** Accuracy over the last few rounds, 0..1. */
  recent: number;
  /** Average seconds per question over all rounds. */
  secondsPerQuestion: number;
}

const RECENT = 5;

/** One row per drill kind played, in the app's order. */
export function drillSummaries(runs: DrillRun[]): DrillSummary[] {
  return DRILL_KINDS.flatMap((kind) => {
    const mine = runs.filter((r) => r.kind === kind).sort((a, b) => a.startedAt - b.startedAt);
    if (!mine.length) return [];
    const last = mine.slice(-RECENT);
    const questions = mine.reduce((n, r) => n + r.total, 0);
    return [
      {
        kind,
        rounds: mine.length,
        best: Math.max(...mine.map(accuracy)),
        recent: last.reduce((n, r) => n + r.correct, 0) / Math.max(1, last.reduce((n, r) => n + r.total, 0)),
        secondsPerQuestion: questions ? mine.reduce((n, r) => n + r.durationMs, 0) / 1000 / questions : 0,
      },
    ];
  });
}

export interface BlindfoldPuzzleSummary {
  total: number;
  solved: number;
  /** Highest puzzle rating solved cleanly. */
  hardest: number | undefined;
}

export function puzzleSummary(attempts: PuzzleAttempt[]): BlindfoldPuzzleSummary {
  const mine = attempts.filter((a) => a.mode === 'blindfold');
  const solved = mine.filter((a) => a.solved);
  return { total: mine.length, solved: solved.length, hardest: solved.length ? Math.max(...solved.map((a) => a.puzzleRating)) : undefined };
}

export interface BlindfoldGameSummary {
  win: number;
  draw: number;
  loss: number;
  /** Games finished without ever showing the board. */
  clean: number;
}

export function gameSummary(games: Game[]): BlindfoldGameSummary {
  const out = { win: 0, draw: 0, loss: 0, clean: 0 };
  for (const g of games) {
    if (!g.blindfold) continue;
    out[g.outcome]++;
    if (!g.blindfoldPeeks) out.clean++;
  }
  return out;
}

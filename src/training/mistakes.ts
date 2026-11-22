// Puzzles made from the player's own mistakes: every serious error of an analysed game becomes a
// "find the right move" puzzle, solvable one by one or gathered into a Woodpecker set.
import { db } from '../db';
import { replay } from '../lib/chess';
import { savePuzzle } from '../puzzles/source';
import type { AnalysisLines, Classification, Game, GameAnalysis, Phase, Puzzle } from '../types';
import { isMistake, mistakeExample, winLoss, type MistakeExample } from './diagnose';
import { ownPuzzle, themeFor } from './exercises';
import { tacticTags } from './tags';

/** Win% a move must throw away to be worth a puzzle; smaller slips are noise. */
export const DEFAULT_MIN_LOSS = 15;
export const MIN_LOSS_CHOICES = [10, 15, 25, 40];

export interface OwnMistake {
  /** Id of the puzzle it becomes (`own:<game>:<ply>`). */
  id: string;
  example: MistakeExample;
  game: Game;
  classification: Classification;
  phase: Phase;
  /** Lichess themes of the puzzle: the tactical pattern missed, and the phase. */
  themes: string[];
}

export const mistakeId = (gameId: string, ply: number) => `own:${gameId}:${ply}`;

/**
 * Serious mistakes of the user's analysed games, worst first. Only moves where the engine had a better
 * move to show are kept (there is nothing to solve otherwise), and the first move of a game is skipped:
 * a puzzle needs the opponent's previous move as its setup.
 */
export function collectMistakes(games: Game[], analyses: Map<string, GameAnalysis>, minLoss = DEFAULT_MIN_LOSS): OwnMistake[] {
  const out: OwnMistake[] = [];
  for (const game of games) {
    const analysis = analyses.get(game.id);
    if (!analysis || game.userColor === undefined) continue;
    let plies: ReturnType<typeof replay> | undefined;
    for (const m of analysis.moves) {
      if (m.color !== game.userColor || !isMistake(m) || !m.bestUci || m.bestUci === m.uci) continue;
      const loss = winLoss(m);
      if (loss < minLoss) continue;
      plies ??= replay(game.moves);
      const example = mistakeExample(game.id, m, plies, loss);
      if (!example?.setup) continue;
      const tags = tacticTags({ fenBefore: example.fenBefore, playedUci: m.uci, bestUci: m.bestUci, bestSan: m.bestSan });
      const themes = [
        ...tags.map((key) => themeFor({ kind: 'tactic', key })),
        themeFor({ kind: 'phase', key: m.phase }),
      ].filter((t): t is string => !!t);
      out.push({ id: mistakeId(game.id, m.ply), example, game, classification: m.classification, phase: m.phase, themes: [...new Set(themes)] });
    }
  }
  return out.sort((a, b) => b.example.loss - a.example.loss);
}

/** The puzzles for the given mistakes (those whose engine lines are gone or have no move are left out). */
export async function mistakePuzzles(mistakes: OwnMistake[]): Promise<Puzzle[]> {
  const out: Puzzle[] = [];
  const lines = new Map<string, AnalysisLines | undefined>();
  for (const m of mistakes) {
    if (!lines.has(m.game.id)) lines.set(m.game.id, await db.analysisLines.get(m.game.id));
    const p = ownPuzzle(m.example, m.themes, lines.get(m.game.id)?.positions[m.example.ply]?.[0]);
    if (p) out.push(p);
  }
  return out;
}

/** Saves the puzzles so they can be replayed (and put in a Woodpecker set) later. */
export async function saveMistakePuzzles(puzzles: Puzzle[]): Promise<void> {
  await Promise.all(puzzles.map(savePuzzle));
}

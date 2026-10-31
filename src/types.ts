export type Source = 'chesscom' | 'lichess';
/** Where a game came from: an imported account, or a training game against the bot (see pages/Play). */
export type GameSource = Source | 'bot';
export type Color = 'white' | 'black';
export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'daily';
export type Outcome = 'win' | 'loss' | 'draw';
export type Termination =
  | 'checkmate'
  | 'resignation'
  | 'timeout'
  | 'abandoned'
  | 'agreement'
  | 'repetition'
  | 'stalemate'
  | 'insufficient'
  | 'fiftyMove'
  | 'timeVsInsufficient'
  | 'other';

export interface Player {
  name: string;
  rating?: number;
}

export interface Game {
  /** `${source}:${nativeId}`; games of friends' accounts get `@${accountId}` appended (see platformGameId). */
  id: string;
  source: GameSource;
  /** Account id (`${source}:${username}`) this game was imported for. */
  accountId: string;
  url: string;
  pgn: string;
  /** SAN moves of the main line. */
  moves: string[];
  white: Player;
  black: Player;
  userColor: Color;
  outcome: Outcome;
  termination: Termination;
  timeClass: TimeClass;
  /** e.g. "180+2" (seconds + increment) or "1/86400" for daily. */
  timeControl: string;
  /** Initial clock in seconds, when known. */
  initialTime?: number;
  endTime: number;
  rated: boolean;
  opening: { eco?: string; name?: string };
  /** Remaining clock in seconds after each ply, when known. */
  clocks?: number[];
  platformAccuracy?: { white?: number; black?: number };
}

export interface Account {
  id: string;
  source: Source;
  username: string;
  lastSync?: number;
  /** Name of the friend this account belongs to; unset for the user's own accounts. */
  friend?: string;
}

/** Engine score, always from White's point of view. */
export interface Score {
  cp?: number;
  mate?: number;
}

export interface EngineLine extends Score {
  /** Principal variation, UCI moves. */
  pv: string[];
  depth: number;
}

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'miss'
  | 'blunder';

export type Phase = 'opening' | 'middlegame' | 'endgame';

export interface MoveAnalysis {
  ply: number;
  san: string;
  uci: string;
  color: Color;
  classification: Classification;
  /** Win% for the mover before / after the move. */
  winBefore: number;
  winAfter: number;
  accuracy: number;
  bestUci?: string;
  bestSan?: string;
  /** Eval of the position after the move (White POV). */
  scoreAfter: Score;
  phase: Phase;
  /** Clock left for the mover before playing, seconds. */
  clockBefore?: number;
}

export interface GameAnalysis {
  gameId: string;
  depth: number;
  version: number;
  moves: MoveAnalysis[];
  accuracy: { white: number; black: number };
  createdAt: number;
}

/**
 * Engine lines for each position of an analysed game (index 0 = initial position). Kept apart from
 * GameAnalysis: only the review shows them, and lists and statistics load every analysis at once.
 */
export interface AnalysisLines {
  gameId: string;
  positions: EngineLine[][];
}

/** A tactics puzzle, stored in full once seen so it can be replayed offline (e.g. in repetition training). */
export interface Puzzle {
  /** Lichess puzzle id. */
  id: string;
  /** Position before the opponent's move that sets the puzzle up. */
  fen: string;
  /** UCI moves: the opponent's setup move, then the solution (player and opponent alternating). */
  moves: string[];
  rating: number;
  themes: string[];
  /** Lichess opening tag (e.g. "Sicilian_Defense"), when the puzzle comes from the opening. */
  opening?: string;
  /** Where it came from: the bundled subset or the Lichess API. */
  origin: 'local' | 'lichess';
  addedAt: number;
}

export type PuzzleMode = 'rated' | 'practice' | 'woodpecker';

export interface PuzzleAttempt {
  id?: number;
  puzzleId: string;
  mode: PuzzleMode;
  /** When the puzzle became playable (after the opponent's setup move). */
  startedAt: number;
  /** Time until the result was settled (solved, first mistake, hint or solution shown). */
  timeMs: number;
  /** Solved with no wrong move and without hint or solution. */
  solved: boolean;
  mistakes: number;
  usedHint: boolean;
  usedSolution: boolean;
  puzzleRating: number;
  /** Player's puzzle rating before / after; set on rated attempts only. */
  ratingBefore?: number;
  ratingAfter?: number;
  rdAfter?: number;
  // The fields below are filled in when the line ends (older attempts may lack the timing ones).
  /** Time until the end of the line (by the player or by the shown solution); unset if abandoned. */
  totalMs?: number;
  /** The player reached the end of the line themselves, possibly after mistakes. */
  completed?: boolean;
  /** Milliseconds spent on each move the player tried, wrong ones included, in order. */
  moveTimes?: number[];
  /** Wrong moves the player tried, UCI. */
  wrongMoves?: string[];
  /** Copied from the puzzle so statistics need no join. */
  themes?: string[];
  color?: Color;
  /** Number of player moves in the solution. */
  length?: number;
  /** Woodpecker set and cycle the attempt belongs to. */
  setId?: string;
  cycleId?: number;
}

/** A fixed group of puzzles solved again and again in cycles (the Woodpecker Method). */
export interface WoodpeckerSet {
  id: string;
  name: string;
  puzzleIds: string[];
  createdAt: number;
  origin: { kind: 'filter'; theme?: string; min: number; max: number } | { kind: 'failed' };
}

export interface WoodpeckerCycle {
  id?: number;
  setId: string;
  /** 1 for the first pass, 2 for the second… */
  index: number;
  /** Puzzle ids in the order played in this cycle (shuffled each cycle). */
  order: string[];
  /** Index into `order` of the next puzzle; lets a cycle be paused and resumed. */
  position: number;
  solved: number;
  startedAt: number;
  finishedAt?: number;
  /** Time spent solving (sum of the puzzles' times), so pauses don't count. */
  activeMs: number;
}

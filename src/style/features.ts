import { Chess } from 'chess.js';

/**
 * Style features of one player, computed from SAN moves alone (no engine), so the very same code builds the
 * legends' profiles (scripts/build-styles.mjs) and the user's. Every feature is a rate between 0 and 1,
 * except `length`. Features that do not apply to a game (e.g. the reply to 1.e4 in a game that began 1.d4)
 * are NaN and left out of the averages.
 */
export const FEATURES = [
  // What the moves do
  'captures',
  'checks',
  'pawnMoves',
  'knightMoves',
  'bishopMoves',
  'rookMoves',
  'queenMoves',
  'kingMoves',
  'pawnAdvance',
  // Structure of the game
  'castleKing',
  'castleQueen',
  'oppositeCastling',
  'earlyQueenMove',
  'queensOff',
  'length',
  'draws',
  // Openings
  // Kind of position reached (snapshots after ply 30 and ply 50)
  'pieces30',
  'pieces50',
  'pawns30',
  'openFiles30',
  'centerPawns30',
  'pawnSpace30',
  'bishopPairEdge30',
  'bishopsOverKnights30',
  'isolatedPawns30',
  'doubledPawns30',
  'kingAdvance50',
  // When things happen
  'firstCapturePly',
  'castlePly',
  'queenTradePly',
  'pawnCaptures',
  'whiteE4',
  'whiteD4',
  'whiteFlank',
  'blackVsE4E5',
  'blackVsE4C5',
  'blackVsD4D5',
  'blackVsD4Nf6',
] as const;

export type FeatureKey = (typeof FEATURES)[number];

export type FeatureGroup = 'openings' | 'moves' | 'structure' | 'positions';

/** Where each feature belongs, for showing and weighing them by kind. */
export const FEATURE_GROUP: Record<FeatureKey, FeatureGroup> = {
  captures: 'moves',
  checks: 'moves',
  pawnMoves: 'moves',
  knightMoves: 'moves',
  bishopMoves: 'moves',
  rookMoves: 'moves',
  queenMoves: 'moves',
  kingMoves: 'moves',
  pawnAdvance: 'moves',
  pawnCaptures: 'moves',
  castleKing: 'structure',
  castleQueen: 'structure',
  oppositeCastling: 'structure',
  earlyQueenMove: 'structure',
  queensOff: 'structure',
  length: 'structure',
  draws: 'structure',
  firstCapturePly: 'structure',
  castlePly: 'structure',
  queenTradePly: 'structure',
  pieces30: 'positions',
  pieces50: 'positions',
  pawns30: 'positions',
  openFiles30: 'positions',
  centerPawns30: 'positions',
  pawnSpace30: 'positions',
  bishopPairEdge30: 'positions',
  bishopsOverKnights30: 'positions',
  isolatedPawns30: 'positions',
  doubledPawns30: 'positions',
  kingAdvance50: 'positions',
  whiteE4: 'openings',
  whiteD4: 'openings',
  whiteFlank: 'openings',
  blackVsE4E5: 'openings',
  blackVsE4C5: 'openings',
  blackVsD4D5: 'openings',
  blackVsD4Nf6: 'openings',
};

/**
 * The features that describe the player and not the whole game: only these differ between the two sides of a
 * game, so only these are left once a player is compared with their opponent (see pairedFeatures). Whole-game
 * features (length, trades, pieces left, draws) are zero then and are not used for style.
 */
export const HABITS: readonly FeatureKey[] = [
  'captures',
  'checks',
  'pawnMoves',
  'knightMoves',
  'bishopMoves',
  'rookMoves',
  'queenMoves',
  'kingMoves',
  'pawnAdvance',
  'pawnCaptures',
  'castleKing',
  'castleQueen',
  'castlePly',
  'earlyQueenMove',
  'pawnSpace30',
  'bishopPairEdge30',
  'bishopsOverKnights30',
  'isolatedPawns30',
  'doubledPawns30',
  'kingAdvance50',
];
export type FeatureValues = Record<FeatureKey, number>;

export type GameResult = 'win' | 'draw' | 'loss';

const PIECE_KEY: Record<string, FeatureKey | undefined> = {
  p: 'pawnMoves',
  n: 'knightMoves',
  b: 'bishopMoves',
  r: 'rookMoves',
  q: 'queenMoves',
  k: 'kingMoves',
};

/** Own moves (not plies) in which a queen move counts as early. */
const EARLY_MOVES = 10;
/** The queens are "off" when both are gone before this ply. */
const QUEENS_OFF_BY_PLY = 40;

/** Shortest game worth profiling, in plies. */
export const MIN_PLIES = 20;

type Board = ReturnType<Chess['board']>;

/** Counts of what the board looks like, from `me`'s side (pieces are non-pawn, non-king). */
function snapshot(board: Board, me: 'w' | 'b') {
  const own = { pawns: 0, n: 0, b: 0, pieces: 0 };
  const theirB = { b: 0 };
  let pieces = 0;
  let pawns = 0;
  let center = 0;
  const filePawns = { w: Array(8).fill(0), b: Array(8).fill(0) } as Record<'w' | 'b', number[]>;
  let advance = 0;
  let king: { file: number; rank: number } | undefined;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const rank = 8 - r; // 1..8 from White's side
      if (sq.type === 'p') {
        pawns++;
        filePawns[sq.color][c]++;
        if (c === 3 || c === 4) center++;
        if (sq.color === me) {
          own.pawns++;
          advance += (me === 'w' ? rank : 9 - rank) - 2;
        }
      } else if (sq.type === 'k') {
        if (sq.color === me) king = { file: c, rank: me === 'w' ? rank : 9 - rank };
      } else {
        pieces++;
        if (sq.color === me) {
          if (sq.type === 'n') own.n++;
          if (sq.type === 'b') own.b++;
        } else if (sq.type === 'b') theirB.b++;
      }
    }
  }
  let open = 0;
  let isolated = 0;
  let doubled = 0;
  for (let c = 0; c < 8; c++) {
    if (!filePawns.w[c] && !filePawns.b[c]) open++;
    const mine = filePawns[me][c];
    if (mine > 1) doubled++;
    if (mine && !(c > 0 && filePawns[me][c - 1]) && !(c < 7 && filePawns[me][c + 1])) isolated++;
  }
  return { pieces, pawns, center, open, isolated, doubled, own, theirB, advance, king };
}

function empty(): FeatureValues {
  return Object.fromEntries(FEATURES.map((k) => [k, NaN])) as FeatureValues;
}

/**
 * Features of one game from the point of view of `color`. Returns null when the moves do not replay or the
 * game is too short to say anything.
 */
export function gameFeatures(moves: string[], color: 'white' | 'black', result: GameResult): FeatureValues | null {
  if (moves.length < MIN_PLIES) return null;
  const me = color === 'white' ? 'w' : 'b';
  const chess = new Chess();
  const f = empty();

  let mine = 0;
  const counts: Partial<Record<FeatureKey, number>> = {};
  const bump = (k: FeatureKey) => (counts[k] = (counts[k] ?? 0) + 1);
  const castled: string[] = [];
  const theirs: string[] = [];
  let queens = 2;
  let queensOffAt = Infinity;
  let queenEarly = 0;
  let firstCapture = 0;
  let queenTrade = 0;
  let castlePly = 0;
  let pawnCaptures = 0;
  let snap30: ReturnType<typeof snapshot> | undefined;
  let snap50: ReturnType<typeof snapshot> | undefined;

  try {
    for (let ply = 0; ply < moves.length; ply++) {
      const m = chess.move(moves[ply]);
      const own = m.color === me;
      if (m.captured && !firstCapture) firstCapture = ply + 1;
      if (ply + 1 === 30) snap30 = snapshot(chess.board(), me);
      if (ply + 1 === 50) snap50 = snapshot(chess.board(), me);
      if (m.captured === 'q' || m.promotion === 'q') {
        queens += m.captured === 'q' ? -1 : 1;
        if (queens <= 0 && queensOffAt === Infinity) queensOffAt = ply + 1;
        if (queens <= 0 && !queenTrade) queenTrade = ply + 1;
      }
      if (!own) {
        if (m.flags.includes('k') || m.flags.includes('q')) theirs.push(m.flags.includes('k') ? 'k' : 'q');
        continue;
      }

      mine++;
      if (m.captured) bump('captures');
      if (m.captured && m.piece === 'p') pawnCaptures++;
      if (m.san.includes('+') || m.san.includes('#')) bump('checks');
      if (m.flags.includes('k') || m.flags.includes('q')) {
        castled.push(m.flags.includes('k') ? 'k' : 'q');
        if (!castlePly) castlePly = ply + 1;
      } else {
        const key = PIECE_KEY[m.piece];
        if (key) bump(key);
      }
      if (m.piece === 'p') {
        const rank = Number(m.to[1]);
        if ((me === 'w' ? rank : 9 - rank) >= 5) bump('pawnAdvance');
      }
      if (m.piece === 'q' && mine <= EARLY_MOVES) queenEarly = 1;
    }
  } catch {
    return null;
  }

  const rate = (k: FeatureKey) => (counts[k] ?? 0) / mine;
  for (const k of ['captures', 'checks', 'pawnMoves', 'knightMoves', 'bishopMoves', 'rookMoves', 'queenMoves', 'kingMoves', 'pawnAdvance'] as const) {
    f[k] = rate(k);
  }

  f.castleKing = castled.includes('k') ? 1 : 0;
  f.castleQueen = castled.includes('q') ? 1 : 0;
  // Castling to different wings: the pawn storms that make such games sharp.
  f.oppositeCastling = castled.length > 0 && theirs.length > 0 && castled[0] !== theirs[0] ? 1 : 0;
  f.earlyQueenMove = queenEarly;
  f.queensOff = queensOffAt <= QUEENS_OFF_BY_PLY ? 1 : 0;
  f.length = Math.log(moves.length / 2);
  f.draws = result === 'draw' ? 1 : 0;

  if (snap30) {
    f.pieces30 = snap30.pieces / 14;
    f.pawns30 = snap30.pawns / 16;
    f.openFiles30 = snap30.open / 8;
    f.centerPawns30 = snap30.center / 8;
    f.pawnSpace30 = snap30.own.pawns ? snap30.advance / snap30.own.pawns / 5 : NaN;
    f.bishopPairEdge30 = (snap30.own.b >= 2 ? 1 : 0) - (snap30.theirB.b >= 2 ? 1 : 0);
    f.bishopsOverKnights30 = snap30.own.b - snap30.own.n;
    f.isolatedPawns30 = snap30.own.pawns ? snap30.isolated / snap30.own.pawns : NaN;
    f.doubledPawns30 = snap30.own.pawns ? snap30.doubled / snap30.own.pawns : NaN;
  }
  if (snap50) {
    f.pieces50 = snap50.pieces / 14;
    f.kingAdvance50 = snap50.king ? (snap50.king.rank - 1) / 7 : NaN;
  }
  if (firstCapture) f.firstCapturePly = Math.log(firstCapture);
  if (castlePly) f.castlePly = Math.log(castlePly);
  if (queenTrade) f.queenTradePly = Math.log(queenTrade);
  f.pawnCaptures = counts.captures ? pawnCaptures / counts.captures : NaN;

  const first = moves[0].replace(/[+#]/g, '');
  const reply = moves[1]?.replace(/[+#]/g, '');
  if (color === 'white') {
    f.whiteE4 = first === 'e4' ? 1 : 0;
    f.whiteD4 = first === 'd4' ? 1 : 0;
    f.whiteFlank = first !== 'e4' && first !== 'd4' ? 1 : 0;
  } else if (first === 'e4') {
    f.blackVsE4E5 = reply === 'e5' ? 1 : 0;
    f.blackVsE4C5 = reply === 'c5' ? 1 : 0;
  } else if (first === 'd4') {
    f.blackVsD4D5 = reply === 'd5' ? 1 : 0;
    f.blackVsD4Nf6 = reply === 'Nf6' ? 1 : 0;
  }
  return f;
}

/** A player's style: the average of each feature over the games it applies to. */
export interface Profile {
  games: number;
  values: Partial<FeatureValues>;
}

export function aggregate(records: FeatureValues[]): Profile {
  const values: Partial<FeatureValues> = {};
  for (const k of FEATURES) {
    let sum = 0;
    let n = 0;
    for (const r of records) {
      if (Number.isNaN(r[k])) continue;
      sum += r[k];
      n++;
    }
    if (n) values[k] = sum / n;
  }
  return { games: records.length, values };
}

/**
 * Each feature of the player minus the same feature of the opponent in the same game. Whatever the game
 * does to both sides (length, pace, how many pieces get traded, the platform) cancels out, and so does most
 * of the gap in strength when the opponent is a peer; what is left is how this player differs from the
 * other one. Features that describe the whole position or the game come out near zero and carry nothing.
 */
export function pairedFeatures(moves: string[], color: 'white' | 'black', result: GameResult): FeatureValues | null {
  const mine = gameFeatures(moves, color, result);
  const theirs = gameFeatures(moves, color === 'white' ? 'black' : 'white', result === 'win' ? 'loss' : result === 'loss' ? 'win' : 'draw');
  if (!mine || !theirs) return null;
  return Object.fromEntries(FEATURES.map((k) => [k, mine[k] - theirs[k]])) as FeatureValues;
}

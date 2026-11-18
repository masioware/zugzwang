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
  'sacrifices',
  // Structure of the game
  'castleKing',
  'castleQueen',
  'oppositeCastling',
  'earlyQueenMove',
  'queensOff',
  'length',
  'draws',
  // Openings
  'whiteE4',
  'whiteD4',
  'whiteFlank',
  'blackVsE4E5',
  'blackVsE4C5',
  'blackVsD4D5',
  'blackVsD4Nf6',
] as const;

export type FeatureKey = (typeof FEATURES)[number];
export type FeatureValues = Record<FeatureKey, number>;

export type GameResult = 'win' | 'draw' | 'loss';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_KEY: Record<string, FeatureKey | undefined> = {
  p: 'pawnMoves',
  n: 'knightMoves',
  b: 'bishopMoves',
  r: 'rookMoves',
  q: 'queenMoves',
  k: 'kingMoves',
};

/** Material down by at least this much, and still down 4 plies later, counts as a sacrifice. */
const SACRIFICE_MATERIAL = 2;
const SACRIFICE_HORIZON = 5;
/** Own moves (not plies) in which a queen move counts as early. */
const EARLY_MOVES = 10;
/** The queens are "off" when both are gone before this ply. */
const QUEENS_OFF_BY_PLY = 40;

/** Shortest game worth profiling, in plies. */
export const MIN_PLIES = 20;

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
  const balance: number[] = [0]; // material, mine minus theirs, after each ply
  let material = 0;

  try {
    for (let ply = 0; ply < moves.length; ply++) {
      const m = chess.move(moves[ply]);
      const own = m.color === me;
      const sign = own ? 1 : -1;
      if (m.captured) material += sign * VALUE[m.captured];
      if (m.promotion) material += sign * (VALUE[m.promotion] - 1);
      balance.push(material);
      if (m.captured === 'q' || m.promotion === 'q') {
        queens += m.captured === 'q' ? -1 : 1;
        if (queens <= 0 && queensOffAt === Infinity) queensOffAt = ply + 1;
      }
      if (!own) {
        if (m.flags.includes('k') || m.flags.includes('q')) theirs.push(m.flags.includes('k') ? 'k' : 'q');
        continue;
      }

      mine++;
      if (m.captured) bump('captures');
      if (m.san.includes('+') || m.san.includes('#')) bump('checks');
      if (m.flags.includes('k') || m.flags.includes('q')) {
        castled.push(m.flags.includes('k') ? 'k' : 'q');
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

  // Sacrifices: material given up (not just traded) that stays given up. Only in games not lost, so a
  // blunder that decided the game is not mistaken for one.
  let sacrifices = 0;
  if (result !== 'loss') {
    let last = -Infinity;
    const first = me === 'w' ? 1 : 2; // 1-based plies of my moves
    for (let p = first; p + 1 < balance.length; p += 2) {
      const before = balance[p - 1];
      if (balance[p + 1] > before - SACRIFICE_MATERIAL || p - last < 8) continue;
      const horizon = Math.min(p + SACRIFICE_HORIZON, balance.length - 1);
      if (balance[horizon] <= before - SACRIFICE_MATERIAL) {
        sacrifices++;
        last = p;
      }
    }
  }
  f.sacrifices = sacrifices / mine;

  f.castleKing = castled.includes('k') ? 1 : 0;
  f.castleQueen = castled.includes('q') ? 1 : 0;
  // Castling to different wings: the pawn storms that make such games sharp.
  f.oppositeCastling = castled.length > 0 && theirs.length > 0 && castled[0] !== theirs[0] ? 1 : 0;
  f.earlyQueenMove = queenEarly;
  f.queensOff = queensOffAt <= QUEENS_OFF_BY_PLY ? 1 : 0;
  f.length = Math.log(moves.length / 2);
  f.draws = result === 'draw' ? 1 : 0;

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

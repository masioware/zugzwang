import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregate, FEATURES, gameFeatures, HABITS, pairedFeatures, type FeatureKey, type FeatureValues } from '../style/features';
import { buildRepertoire, MIN_REPERTOIRE_GAMES, openingKey, overlap, repertoireSimilarity, type OpeningBook, type Repertoire } from '../style/repertoire';
import { matchStyle, REPERTOIRE_WEIGHT, type Legend, type StyleData, type YourStyle } from '../style/match';

const san = (pgn: string) => pgn.split(' ');
// A quiet 1.e4 e5 game of 30 plies where both sides castle kingside; a bishop pair is traded.
const QUIET = san('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 Nbd2 Be6 Nf1 Bxb3 axb3 h6 Ng3 Re8 h3 Qd7 Bd2 Rad8 Qc2 Nh7');
// Morphy's Opera Game.
const OPERA = san('e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#');
const RUY = san('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7 Nbd2 Bb7 Bc2 Re8 Nf1 Bf8 Ng3 g6 a4 c5');
const QGD = san('d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3 dxc4 Bxc4 Nd5 Bxe7 Qxe7 O-O Nxc3 Rxc3 e5 Qc2 exd4 exd4 Nb6 Bb3 Bf5');

const book = JSON.parse(readFileSync('public/data/openings.json', 'utf8')) as OpeningBook;

describe('gameFeatures', () => {
  it('rejects games that are too short or do not replay', () => {
    expect(gameFeatures(['e4', 'e5'], 'white', 'win')).toBeNull();
    expect(gameFeatures([...QUIET.slice(0, 20), 'Qh9'], 'white', 'win')).toBeNull();
  });

  it('describes a quiet game from either side', () => {
    const w = gameFeatures(QUIET, 'white', 'draw')!;
    expect(w.whiteE4).toBe(1);
    expect(w.castleKing).toBe(1);
    expect(w.oppositeCastling).toBe(0);
    expect(w.draws).toBe(1);
    expect(w.blackVsE4E5).toBeNaN(); // only applies to Black
    const b = gameFeatures(QUIET, 'black', 'draw')!;
    expect(b.blackVsE4E5).toBe(1);
    expect(b.whiteE4).toBeNaN();
  });

  it('times the first capture and the castling, in plies', () => {
    const w = gameFeatures(QUIET, 'white', 'draw')!;
    expect(w.firstCapturePly).toBeCloseTo(Math.log(20)); // 10.Bxb3 is the first capture
    expect(w.castlePly).toBeCloseTo(Math.log(11));
    expect(w.queenTradePly).toBeNaN(); // the queens never come off
    expect(gameFeatures(QUIET, 'black', 'draw')!.castlePly).toBeCloseTo(Math.log(12));
  });

  it('reads the position after ply 30, but only once the game gets there', () => {
    const w = gameFeatures(QUIET, 'white', 'draw')!;
    expect(w.pieces30).toBeCloseTo(12 / 14); // a pair of bishops traded off
    expect(w.pawns30).toBe(1);
    expect(w.pieces50).toBeNaN(); // the game has 30 plies only
  });
});

describe('pairedFeatures', () => {
  it('is the player minus the opponent, so whole-game features cancel out', () => {
    const p = pairedFeatures(QUIET, 'white', 'draw')!;
    expect(p.length).toBe(0);
    expect(p.pieces30).toBe(0);
    expect(p.draws).toBe(0);
    expect(p.castlePly).toBeCloseTo(Math.log(11) - Math.log(12)); // White castled a move earlier
    expect(pairedFeatures(QUIET, 'black', 'draw')!.castlePly).toBeCloseTo(Math.log(12) - Math.log(11));
  });

  it('mirrors between the two sides', () => {
    const w = pairedFeatures(OPERA, 'white', 'win')!;
    const b = pairedFeatures(OPERA, 'black', 'loss')!;
    for (const k of HABITS) if (!Number.isNaN(w[k])) expect(w[k] + b[k]).toBeCloseTo(0);
  });

  it('is null when either side cannot be read', () => {
    expect(pairedFeatures(['e4', 'e5'], 'white', 'win')).toBeNull();
  });
});

describe('aggregate', () => {
  it('averages over the games a feature applies to', () => {
    const w = gameFeatures(QUIET, 'white', 'win')!;
    const b = gameFeatures(QUIET, 'black', 'loss')!;
    const p = aggregate([w, b]);
    expect(p.games).toBe(2);
    expect(p.values.whiteE4).toBe(1); // the black game has no opinion
    expect(p.values.draws).toBe(0);
  });
});

describe('repertoire', () => {
  it('names the opening a game reaches, by family and variation', () => {
    const ruy = openingKey(RUY, book)!;
    expect(ruy.family).toBe('Ruy Lopez');
    expect(ruy.variation.startsWith('Ruy Lopez')).toBe(true);
    expect(openingKey(QGD, book)!.family).toMatch(/Queen's Gambit/);
  });

  it('is null when the moves do not replay', () => {
    expect(openingKey(['e4', 'Qh9'], book)).toBeNull();
  });

  const rep = (white: (typeof RUY)[], black: (typeof RUY)[]) =>
    buildRepertoire([
      ...white.map((m) => ({ color: 'white' as const, key: openingKey(m, book) })),
      ...black.map((m) => ({ color: 'black' as const, key: openingKey(m, book) })),
    ]);
  const many = (m: string[], n: number) => Array.from({ length: n }, () => m);

  it('needs a few games of a colour before it counts', () => {
    const r = rep(many(RUY, MIN_REPERTOIRE_GAMES - 1), many(QGD, MIN_REPERTOIRE_GAMES));
    expect(r.white).toBeUndefined();
    expect(r.black?.games).toBe(MIN_REPERTOIRE_GAMES);
  });

  it('measures how much two repertoires overlap', () => {
    const a = rep(many(RUY, 20), many(QGD, 20));
    const same = rep(many(RUY, 15), many(QGD, 15));
    const other = rep(many(QGD, 20), many(RUY, 20));
    expect(repertoireSimilarity(a, same)!.overall).toBeCloseTo(1);
    expect(repertoireSimilarity(a, other)!.overall).toBeCloseTo(0);
    expect(overlap({ x: 0.5, y: 0.5 }, { x: 0.5, z: 0.5 })).toBeCloseTo(0.5);
    expect(repertoireSimilarity({ white: a.white }, { black: a.black })).toBeUndefined(); // no colour in common
  });
});

describe('matchStyle', () => {
  const rep = (w: typeof RUY, b: typeof RUY): Repertoire =>
    buildRepertoire([
      ...Array.from({ length: 20 }, () => ({ color: 'white' as const, key: openingKey(w, book) })),
      ...Array.from({ length: 20 }, () => ({ color: 'black' as const, key: openingKey(b, book) })),
    ]);
  const flat = (v: number) => Object.fromEntries(HABITS.map((k) => [k, v])) as Partial<Record<FeatureKey, number>>;
  const legend = (id: string, repertoire: Repertoire, habit: number): Legend => ({ id, name: id, games: 100, values: flat(habit), repertoire });
  const data: StyleData = {
    scale: Object.fromEntries(HABITS.map((k) => [k, { mean: 0, std: 1, weight: 1 }])),
    legends: [legend('classical', rep(RUY, QGD), 1), legend('queens', rep(QGD, RUY), -1)],
  };
  const you = (r: Repertoire, habit: number): YourStyle => ({ habits: { games: 50, values: flat(habit) as Partial<FeatureValues> }, repertoire: r });

  it('ranks by repertoire, with the habits as a small push', () => {
    const m = matchStyle(you(rep(RUY, QGD), 0.2), data);
    expect(m.map((x) => x.legend.id)).toEqual(['classical', 'queens']);
    expect(m[0].repertoire.overall).toBe(100);
    expect(m[0].shared[0].family).toBe('Ruy Lopez');
    expect(m[0].shared[0].you).toBe(1);
  });

  it('keeps habits from overturning a clearly different repertoire', () => {
    // The habits look like `queens`, the repertoire like `classical`.
    const m = matchStyle(you(rep(RUY, QGD), -1), data);
    expect(m[0].legend.id).toBe('classical');
    expect(m[0].habits).toBeLessThan(m[1].habits!);
    const w = REPERTOIRE_WEIGHT;
    expect(m[0].similarity).toBe(Math.round(100 * (w * 1 + (1 - w) * (m[0].habits! / 100))));
  });

  it('falls back to the repertoire alone with too few habits, or data without them', () => {
    const few = matchStyle({ habits: { games: 50, values: { captures: 0.1 } }, repertoire: rep(RUY, QGD) }, data);
    expect(few[0].habits).toBeUndefined();
    expect(few[0].similarity).toBe(100);
    const stale: StyleData = { scale: {}, legends: data.legends.map((l) => ({ ...l, values: {} })) };
    expect(matchStyle(you(rep(RUY, QGD), 0), stale)[0].habits).toBeUndefined();
  });

  it('gives no answer without a repertoire to compare', () => {
    expect(matchStyle(you({}, 0), data)).toEqual([]);
  });

  it('only names reliable habits as reasons', () => {
    const weak: StyleData = { ...data, scale: Object.fromEntries(HABITS.map((k) => [k, { mean: 0, std: 1, weight: 0.05 }])) };
    const m = matchStyle(you(rep(RUY, QGD), 0), weak);
    expect(m[0].closest).toEqual([]);
    expect(m[0].furthest).toEqual([]);
  });
});

describe('features', () => {
  it('keeps the habits to features that exist', () => {
    for (const k of HABITS) expect(FEATURES).toContain(k);
  });
});

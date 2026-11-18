import { describe, expect, it } from 'vitest';
import { aggregate, FEATURES, FEATURE_GROUP, gameFeatures, LEVEL_SENSITIVE, OPENING_WEIGHT, type FeatureValues } from '../style/features';
import { featureWeight, matchStyle, type StyleData } from '../style/match';
import { axisScores } from '../style/axes';

// A quiet 1.e4 e5 game of 30 plies where both sides castle kingside and nothing is sacrificed.
const QUIET = 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O Re1 a6 Bb3 Ba7 Nbd2 Be6 Nf1 Bxb3 axb3 h6 Ng3 Re8 h3 Qd7 Bd2 Rad8 Qc2 Nh7'.split(' ');
// Morphy's Opera Game, with White's queen sacrifice (Qb8+) at the end.
const OPERA = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ');

describe('gameFeatures', () => {
  it('rejects games that are too short or do not replay', () => {
    expect(gameFeatures(['e4', 'e5'], 'white', 'win')).toBeNull();
    expect(gameFeatures([...QUIET.slice(0, 20), 'Qh9'], 'white', 'win')).toBeNull();
  });

  it('describes a quiet game from either side', () => {
    const w = gameFeatures(QUIET, 'white', 'draw')!;
    expect(w.whiteE4).toBe(1);
    expect(w.whiteD4).toBe(0);
    expect(w.castleKing).toBe(1);
    expect(w.oppositeCastling).toBe(0);
    expect(w.draws).toBe(1);
    expect(Number.isNaN(w.blackVsE4E5)).toBe(true); // only applies to Black
    const b = gameFeatures(QUIET, 'black', 'draw')!;
    expect(b.blackVsE4E5).toBe(1);
    expect(b.blackVsE4C5).toBe(0);
    expect(Number.isNaN(b.whiteE4)).toBe(true);
  });

  it('times the first capture and the castling, in plies', () => {
    const w = gameFeatures(QUIET, 'white', 'draw')!;
    expect(w.firstCapturePly).toBeCloseTo(Math.log(20)); // 10.Bxb3 is the first capture
    expect(w.castlePly).toBeCloseTo(Math.log(11)); // White castles on ply 11
    expect(w.queenTradePly).toBeNaN(); // the queens never come off
    expect(gameFeatures(QUIET, 'black', 'draw')!.castlePly).toBeCloseTo(Math.log(12));
  });

  it('reads the position after ply 30, but only once the game gets there', () => {
    const w = gameFeatures(QUIET, 'white', 'draw')!;
    expect(w.pieces30).toBeCloseTo(12 / 14); // a pair of bishops traded off
    expect(w.pawns30).toBe(1);
    expect(w.openFiles30).toBe(0);
    expect(w.pieces50).toBeNaN(); // the game has 30 plies only
    const opera = gameFeatures(OPERA, 'white', 'win')!;
    expect(opera.pieces30).toBeLessThan(w.pieces30);
    expect(opera.castleQueen).toBe(1);
    expect(opera.checks).toBeGreaterThan(0);
  });
});

describe('aggregate', () => {
  it('averages over the games a feature applies to', () => {
    const w = gameFeatures(QUIET, 'white', 'win')!;
    const b = gameFeatures(QUIET, 'black', 'loss')!;
    const p = aggregate([w, b]);
    expect(p.games).toBe(2);
    expect(p.values.whiteE4).toBe(1); // the black game has no opinion
    expect(p.values.blackVsE4E5).toBe(1);
    expect(p.values.draws).toBe(0);
  });
});

describe('matchStyle', () => {
  const flat = (v: number): FeatureValues => Object.fromEntries(FEATURES.map((k) => [k, v])) as FeatureValues;
  const data: StyleData = {
    scale: Object.fromEntries(FEATURES.map((k) => [k, { mean: 0.5, std: 0.2 }])) as StyleData['scale'],
    legends: [
      { id: 'low', name: 'Low', games: 100, values: flat(0.2) },
      { id: 'high', name: 'High', games: 100, values: flat(0.8) },
    ],
  };

  it('ranks the nearest legend first', () => {
    const m = matchStyle({ games: 50, values: flat(0.75) }, data);
    expect(m.map((x) => x.legend.id)).toEqual(['high', 'low']);
    expect(m[0].similarity).toBeGreaterThan(m[1].similarity);
    expect(m[0].similarity).toBeGreaterThan(90);
  });

  it('weighs by reliability, holds the openings back and reports each group', () => {
    const feats = (open: number, rest: number) =>
      Object.fromEntries(FEATURES.map((k) => [k, FEATURE_GROUP[k] === 'openings' ? open : rest])) as FeatureValues;
    const two: StyleData = {
      scale: Object.fromEntries(FEATURES.map((k) => [k, { mean: 0.5, std: 0.2, weight: FEATURE_GROUP[k] === 'openings' ? 1 : 0.5 }])) as StyleData['scale'],
      legends: [
        { id: 'sameOpenings', name: 'A', games: 100, values: feats(0.8, 0.2) },
        { id: 'sameRest', name: 'B', games: 100, values: feats(0.2, 0.8) },
      ],
    };
    const m = matchStyle({ games: 50, values: feats(0.8, 0.8) }, two);
    const a = m.find((x) => x.legend.id === 'sameOpenings')!;
    const b = m.find((x) => x.legend.id === 'sameRest')!;
    expect(a.byGroup.openings).toBeGreaterThan(95);
    expect(a.byGroup.moves).toBeLessThan(40);
    expect(b.byGroup.moves).toBeGreaterThan(95);
    // 7 opening features count 1 * 0.5 each (3.5 in all); the 14 counted others 0.5 each (7 in all): they decide.
    expect(m[0].legend.id).toBe('sameRest');
  });

  it('copes with a data file built before some features existed', () => {
    const old = structuredClone(data) as StyleData;
    delete (old.scale as Partial<StyleData['scale']>).pawns30;
    for (const l of old.legends) delete (l.values as Partial<FeatureValues>).pawns30;
    expect(matchStyle({ games: 50, values: flat(0.75) }, old)[0].legend.id).toBe('high');
    expect(axisScores(flat(0.75), old.scale).closedPlay).toBeDefined();
  });

  it('does not let level-driven features change who is closest', () => {
    const base = matchStyle({ games: 50, values: flat(0.75) }, data)[0];
    const odd = matchStyle({ games: 50, values: { ...flat(0.75), length: 0, captures: 0, draws: 1 } }, data)[0];
    expect(odd.legend.id).toBe(base.legend.id);
    expect(odd.similarity).toBe(base.similarity);
  });

  it('gives no answer without enough features', () => {
    expect(matchStyle({ games: 50, values: { captures: 0.2 } }, data)).toEqual([]);
  });

  it('ignores features the player has no data for', () => {
    const values = { ...flat(0.8), whiteE4: undefined } as Partial<FeatureValues>;
    expect(matchStyle({ games: 50, values }, data)[0].legend.id).toBe('high');
  });
});

describe('axisScores', () => {
  const flat = (v: number): FeatureValues => Object.fromEntries(FEATURES.map((k) => [k, v])) as FeatureValues;
  const scale = Object.fromEntries(FEATURES.map((k) => [k, { mean: 0.5, std: 0.2 }])) as StyleData['scale'];

  it('sits at 50 for an average player', () => {
    for (const score of Object.values(axisScores(flat(0.5), scale))) expect(score).toBe(50);
  });

  it('lets opposing features cancel and signs pull axes down', () => {
    const s = axisScores(flat(0.7), scale); // +1 sd on everything
    expect(s.aggression).toBe(70);
    expect(s.closedPlay).toBe(57); // two features up (+1 sd), one down: mean +1/3 sd
    expect(s.openness).toBe(50 + Math.round((20 * (3 - 4)) / 7));
  });

  it('counts reliable features for more', () => {
    const weighted = { ...scale, pawnAdvance: { ...scale.pawnAdvance, weight: 1 }, pawnSpace30: { ...scale.pawnSpace30, weight: 0 }, oppositeCastling: { ...scale.oppositeCastling, weight: 0 }, castleQueen: { ...scale.castleQueen, weight: 0 } };
    const values = { ...flat(0.5), pawnAdvance: 0.7, pawnSpace30: 0.3 }; // +1 sd and -1 sd
    expect(axisScores(values, weighted).aggression).toBe(70); // only `pawnAdvance` counts
    expect(axisScores(values, scale).aggression).toBe(50); // equal weights: they cancel
  });

  it('ignores features that mostly reflect level, not style', () => {
    expect(LEVEL_SENSITIVE.has('length')).toBe(true);
    expect(featureWeight('length', scale)).toBe(0);
    expect(featureWeight('knightMoves', scale)).toBe(1);
    expect(featureWeight('whiteE4', scale)).toBe(OPENING_WEIGHT);
    const level = { ...flat(0.5), length: 0.99, captures: 0.01, draws: 0 }; // wildly off the legends, on level only
    expect(axisScores(level, scale).aggression).toBe(50);
  });

  it('leaves out axes without data and stays within 0-100', () => {
    const s = axisScores({ pawnAdvance: 100 }, scale);
    expect(s.aggression).toBe(100);
    expect(s.closedPlay).toBeUndefined();
  });
});

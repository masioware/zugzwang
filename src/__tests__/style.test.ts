import { describe, expect, it } from 'vitest';
import { aggregate, FEATURES, gameFeatures, type FeatureValues } from '../style/features';
import { matchStyle, type StyleData } from '../style/match';

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
    expect(w.sacrifices).toBe(0);
    expect(Number.isNaN(w.blackVsE4E5)).toBe(true); // only applies to Black
    const b = gameFeatures(QUIET, 'black', 'draw')!;
    expect(b.blackVsE4E5).toBe(1);
    expect(b.blackVsE4C5).toBe(0);
    expect(Number.isNaN(b.whiteE4)).toBe(true);
  });

  it('spots a sacrifice, but not in a lost game', () => {
    const w = gameFeatures(OPERA, 'white', 'win')!;
    expect(w.castleQueen).toBe(1);
    expect(w.checks).toBeGreaterThan(0);
    expect(w.sacrifices).toBeGreaterThan(0);
    expect(gameFeatures(OPERA, 'white', 'loss')!.sacrifices).toBe(0);
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

  it('gives no answer without enough features', () => {
    expect(matchStyle({ games: 50, values: { captures: 0.2 } }, data)).toEqual([]);
  });

  it('ignores features the player has no data for', () => {
    const values = { ...flat(0.8), whiteE4: undefined } as Partial<FeatureValues>;
    expect(matchStyle({ games: 50, values }, data)[0].legend.id).toBe('high');
  });
});

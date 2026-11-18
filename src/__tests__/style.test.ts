import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildRepertoire,
  distinctiveShared,
  meanRepertoire,
  MIN_REPERTOIRE_GAMES,
  openingKey,
  overlap,
  pruneRepertoire,
  repertoireSimilarity,
  type OpeningBook,
  type Repertoire,
} from '../style/repertoire';
import { matchStyle, type Legend, type StyleData } from '../style/match';

const san = (pgn: string) => pgn.split(' ');
const RUY = san('e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7 Nbd2 Bb7 Bc2 Re8 Nf1 Bf8 Ng3 g6 a4 c5');
const QGD = san('d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6 Bd3 dxc4 Bxc4 Nd5 Bxe7 Qxe7 O-O Nxc3 Rxc3 e5 Qc2 exd4 exd4 Nb6 Bb3 Bf5');
const SICILIAN = san('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7 g4 b5 g5 b4 Ne2 Ne8 f4 a5 f5 Bc4');

const book = JSON.parse(readFileSync('public/data/openings.json', 'utf8')) as OpeningBook;

const rep = (white: string[][], black: string[][]) =>
  buildRepertoire([
    ...white.map((m) => ({ color: 'white' as const, key: openingKey(m, book) })),
    ...black.map((m) => ({ color: 'black' as const, key: openingKey(m, book) })),
  ]);
const many = (m: string[], n: number) => Array.from({ length: n }, () => m);

describe('openingKey', () => {
  it('names the opening a game reaches, by family and variation', () => {
    const ruy = openingKey(RUY, book)!;
    expect(ruy.family).toBe('Ruy Lopez');
    expect(ruy.variation.startsWith('Ruy Lopez')).toBe(true);
    expect(openingKey(QGD, book)!.family).toMatch(/Queen's Gambit/);
    expect(openingKey(SICILIAN, book)!.family).toBe('Sicilian Defense');
  });

  it('is null when the moves do not replay', () => {
    expect(openingKey(['e4', 'Qh9'], book)).toBeNull();
  });
});

describe('repertoire', () => {
  it('needs a few games of a colour before it counts', () => {
    const r = rep(many(RUY, MIN_REPERTOIRE_GAMES - 1), many(QGD, MIN_REPERTOIRE_GAMES));
    expect(r.white).toBeUndefined();
    expect(r.black?.games).toBe(MIN_REPERTOIRE_GAMES);
  });

  it('prunes the rarest entries for storage', () => {
    const r = rep([...many(RUY, 300), SICILIAN], many(QGD, 20));
    expect(Object.keys(r.white!.family)).toContain('Sicilian Defense');
    expect(Object.keys(pruneRepertoire(r).white!.family)).not.toContain('Sicilian Defense'); // 1 in 301 is below the floor
  });

  it('measures how much two repertoires overlap', () => {
    const a = rep(many(RUY, 20), many(QGD, 20));
    expect(repertoireSimilarity(a, rep(many(RUY, 15), many(QGD, 15)))!.overall).toBeCloseTo(1);
    expect(repertoireSimilarity(a, rep(many(QGD, 20), many(RUY, 20)))!.overall).toBeCloseTo(0);
    expect(overlap({ x: 0.5, y: 0.5 }, { x: 0.5, z: 0.5 })).toBeCloseTo(0.5);
    expect(repertoireSimilarity({ white: a.white }, { black: a.black })).toBeUndefined(); // no colour in common
  });
});

describe('centred repertoire similarity: what everybody plays counts for little', () => {
  // Most legends play the Ruy Lopez and the QGD; a few play the Sicilian.
  const crowd = (i: number): Repertoire => rep(many(i % 5 === 0 ? SICILIAN : RUY, 20), many(QGD, 20));
  const reps = Array.from({ length: 20 }, (_, i) => crowd(i));
  const mean = meanRepertoire(reps);

  it('computes the average repertoire per colour', () => {
    expect(mean.white!.family['Ruy Lopez']).toBeCloseTo(0.8);
    expect(mean.white!.family['Sicilian Defense']).toBeCloseTo(0.2);
    expect(mean.black!.family["Queen's Gambit Declined"] ?? Object.values(mean.black!.family)[0]).toBeGreaterThan(0.9);
  });

  it('rates alike those who depart from the average the same way, and the average player as alike to nobody', () => {
    const average = rep([...many(RUY, 16), ...many(SICILIAN, 4)], many(QGD, 20)); // exactly the mean repertoire
    const sicilianFan = rep(many(SICILIAN, 20), many(SICILIAN, 20)); // departs from the average with both colours
    const alsoFan = rep([...many(SICILIAN, 18), ...many(RUY, 2)], [...many(SICILIAN, 18), ...many(QGD, 2)]);
    const ruyOnly = rep(many(RUY, 20), many(QGD, 20));
    const plain = (a: Repertoire, b: Repertoire) => repertoireSimilarity(a, b)!.overall;
    const centred = (a: Repertoire, b: Repertoire) => repertoireSimilarity(a, b, mean)!.overall;
    expect(centred(sicilianFan, alsoFan)).toBeGreaterThan(0.8); // both lean the same way away from the average
    expect(centred(sicilianFan, ruyOnly)).toBeLessThan(0.1); // opposite departures
    expect(centred(average, ruyOnly)).toBe(0); // playing what everybody plays says nothing
    expect(plain(average, ruyOnly)).toBeGreaterThan(0.5); // which plain overlap would have rated as quite alike
  });

  it('names the distinctive openings two players share, not the usual ones', () => {
    const a = rep([...many(RUY, 10), ...many(SICILIAN, 10)], many(QGD, 20)).white!;
    const b = rep([...many(RUY, 10), ...many(SICILIAN, 10)], many(QGD, 20)).white!;
    const shared = distinctiveShared(a, b, mean.white!.family);
    expect(shared[0].family).toBe('Sicilian Defense'); // both play it far more than the average legend
    expect(shared.map((s) => s.family)).not.toContain('Ruy Lopez'); // at 50% vs the average 80% it is below the usual
  });
});

describe('matchStyle', () => {
  const legend = (id: string, repertoire: Repertoire): Legend => ({ id, name: id, games: 100, repertoire });
  const classical = rep(many(RUY, 20), many(QGD, 20));
  const queens = rep(many(QGD, 20), many(RUY, 20));
  const data: StyleData = { legends: [legend('classical', classical), legend('queens', queens)] };

  it('ranks by repertoire, with the openings both play named', () => {
    const m = matchStyle({ repertoire: classical }, data);
    expect(m.map((x) => x.legend.id)).toEqual(['classical', 'queens']);
    expect(m[0].similarity).toBe(100);
    expect(m[0].white).toBe(100);
    expect(m[0].black).toBe(100);
    expect(m[1].similarity).toBe(0);
    expect(m[0].shared[0].family).toBe('Ruy Lopez');
    expect(m[0].shared[0].you).toBe(1);
  });

  it('with the average repertoire, names what stands out in both and not what everybody plays', () => {
    const crowd = Array.from({ length: 20 }, (_, i) => legend(`l${i}`, rep(many(i % 5 === 0 ? SICILIAN : RUY, 20), many(QGD, 20))));
    const withMean: StyleData = { legends: [...crowd, legend('fan', rep(many(SICILIAN, 20), many(SICILIAN, 20)))], repertoireMean: meanRepertoire(crowd.map((l) => l.repertoire)) };
    const you = rep([...many(SICILIAN, 15), ...many(RUY, 5)], [...many(SICILIAN, 15), ...many(QGD, 5)]);
    const m = matchStyle({ repertoire: you }, withMean);
    expect(m[0].legend.id).toBe('fan');
    expect(m[0].shared.map((s) => s.family)).toContain('Sicilian Defense');
    expect(m[0].shared.map((s) => s.family)).not.toContain('Ruy Lopez'); // the usual line is not what the two have in common
  });

  it('gives no answer without a repertoire to compare, or with no colour in common', () => {
    expect(matchStyle({ repertoire: {} }, data)).toEqual([]);
    expect(matchStyle({ repertoire: { white: classical.white } }, { legends: [legend('b', { black: classical.black })] })).toEqual([]);
  });
});

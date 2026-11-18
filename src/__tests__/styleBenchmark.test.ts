import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import labels from '../style/labels.json';
import { faceValidity } from '../style/benchmark';
import { buildRepertoire, type OpeningKey } from '../style/repertoire';
import type { Legend, StyleData } from '../style/match';

const real = JSON.parse(readFileSync('public/data/styles.json', 'utf8')) as StyleData;

describe('faceValidity', () => {
  // Two groups of legends whose repertoires are disjoint: the nearest neighbour is always from the same group.
  const key = (family: string): OpeningKey => ({ family, variation: family });
  const rep = (family: string) =>
    buildRepertoire([
      ...Array.from({ length: 20 }, () => ({ color: 'white' as const, key: key(family) })),
      ...Array.from({ length: 20 }, () => ({ color: 'black' as const, key: key(family) })),
    ]);
  const legend = (id: string, family: string): Legend => ({ id, name: id, games: 100, repertoire: rep(family) });
  const data: StyleData = {
    legends: [legend('a1', 'Sicilian Defense'), legend('a2', 'Sicilian Defense'), legend('a3', 'Sicilian Defense'), legend('p1', 'Queen\'s Gambit'), legend('p2', 'Queen\'s Gambit'), legend('p3', 'Queen\'s Gambit')],
  };
  const lab = { attacking: ['a1', 'a2', 'a3'], positional: ['p1', 'p2', 'p3'] };

  it('is perfect when the similarity separates the two styles, and chance-like when it does not', () => {
    const good = faceValidity(data, lab, (m) => m.similarity)!;
    expect(good.n).toBe(6);
    expect(good.nearest).toBe(1);
    expect(good.top3).toBeCloseTo(2 / 3 + 0 * 1, 0); // only two same-style neighbours exist, of three ranked
    expect(faceValidity(data, lab, () => 0.5)!.nearest).toBeLessThanOrEqual(1);
  });

  it('has no answer when the similarity has no value to rank by', () => {
    expect(faceValidity(data, lab, () => undefined)).toBeNull();
  });
});

// Guards the shipped data: the match must keep telling attackers from positional players better than chance.
describe('the legends data', () => {
  it('groups legends of the same style, well above chance', () => {
    const r = faceValidity(real, labels, (m) => m.similarity)!;
    expect(r.n).toBeGreaterThanOrEqual(30);
    expect(r.nearest).toBeGreaterThanOrEqual(0.7); // chance is 0.5
    expect(r.top3).toBeGreaterThanOrEqual(0.65);
  }, 60_000);

  it('centring on the average repertoire does better than plain overlap', () => {
    const plain = faceValidity({ ...real, repertoireMean: undefined }, labels, (m) => m.similarity)!;
    const centred = faceValidity(real, labels, (m) => m.similarity)!;
    expect(centred.nearest).toBeGreaterThanOrEqual(plain.nearest);
    expect(centred.top3).toBeGreaterThan(plain.top3);
  }, 60_000);

  it('labels only legends that exist', () => {
    const ids = new Set(real.legends.map((l) => l.id));
    for (const id of [...labels.attacking, ...labels.positional]) expect(ids.has(id)).toBe(true);
  });
});

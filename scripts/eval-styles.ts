// Face validity of each part of the style match, from public/data/styles.json:
//
//   npx vite-node scripts/eval-styles.ts
//
// For every legend with a known style (src/style/labels.json), are its nearest neighbours of the same style?
// Chance is about 50%. Identification (finding a legend from unseen games of theirs) is measured separately,
// since it rewards what is personal, like the opening repertoire, more than how a player plays.
import { readFileSync } from 'node:fs';
import labels from '../src/style/labels.json';
import { faceValidity } from '../src/style/benchmark';
import type { Match, StyleData } from '../src/style/match';

const data = JSON.parse(readFileSync('public/data/styles.json', 'utf8')) as StyleData;
const parts: [string, (m: Match) => number | undefined, StyleData][] = [
  ['repertoire, centred (shipped)', (m) => m.similarity, data],
  ['repertoire, plain overlap', (m) => m.similarity, { ...data, repertoireMean: undefined }],
];
console.log('part'.padEnd(30), 'nearest   top-3');
for (const [name, score, d] of parts) {
  const r = faceValidity(d, labels, score);
  console.log(name.padEnd(30), r ? `${(100 * r.nearest).toFixed(0).padStart(5)}%  ${(100 * r.top3).toFixed(0).padStart(5)}%   (n=${r.n})` : '   no data');
}

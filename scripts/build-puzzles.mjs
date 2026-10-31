// Builds public/data/puzzles/ from the CC0 Lichess puzzle database (https://database.lichess.org/#puzzles).
//
//   curl -LO --output-dir data-src https://database.lichess.org/lichess_db_puzzle.csv.zst
//   node scripts/build-puzzles.mjs [data-src/lichess_db_puzzle.csv.zst] [perBucket]
//
// Keeps well-tested puzzles (many plays, popular, stable rating) and splits them into 100-point rating
// buckets, one JSON file each, so the app only downloads the ratings it needs. Within a bucket every theme
// gets some puzzles first, then the rest is filled by quality. Rows are [id, fen, moves, rating, themes,
// opening]: themes and opening are indexes into index.json.
import { createReadStream, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { Decompress } from 'fzstd';

const input = process.argv[2] ?? 'data-src/lichess_db_puzzle.csv.zst';
const PER_BUCKET = Number(process.argv[3] ?? 4000);
const PER_THEME = 40;
const MIN_PLAYS = 300;
const MIN_POPULARITY = 80;
const MAX_DEVIATION = 90;
const OUT = 'public/data/puzzles';

/** Lines of a (possibly zstd-compressed) text file. */
async function* lines(path) {
  const decoder = new TextDecoder();
  let pending = [];
  const zstd = path.endsWith('.zst') ? new Decompress((chunk) => pending.push(decoder.decode(chunk, { stream: true }))) : null;
  let buffer = '';
  for await (const chunk of createReadStream(path)) {
    if (zstd) zstd.push(chunk);
    else pending.push(decoder.decode(chunk, { stream: true }));
    buffer += pending.join('');
    pending = [];
    const parts = buffer.split('\n');
    buffer = parts.pop();
    yield* parts;
  }
  if (buffer) yield buffer;
}

const buckets = new Map(); // rating bucket -> candidates
let total = 0;
let kept = 0;
for await (const line of lines(input)) {
  if (!line || line.startsWith('PuzzleId')) continue;
  total++;
  const [id, fen, moves, rating, deviation, popularity, plays, themes, , openingTags] = line.split(',');
  if (+plays < MIN_PLAYS || +popularity < MIN_POPULARITY || +deviation > MAX_DEVIATION) continue;
  kept++;
  const r = +rating;
  const b = Math.floor(r / 100) * 100;
  if (!buckets.has(b)) buckets.set(b, []);
  buckets.get(b).push({
    id,
    fen,
    moves,
    rating: r,
    themes: themes.split(' ').filter(Boolean),
    opening: openingTags?.split(' ')[0] || '',
    score: +popularity + 10 * Math.log10(+plays),
  });
}

const themeIdx = new Map();
const openingIdx = new Map();
const indexOf = (map, key) => {
  if (!map.has(key)) map.set(key, map.size);
  return map.get(key);
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const index = [];
let written = 0;
for (const b of [...buckets.keys()].sort((x, y) => x - y)) {
  const candidates = buckets.get(b).sort((x, y) => y.score - x.score);
  const chosen = new Set();
  const perTheme = new Map();
  for (const p of candidates) {
    if (p.themes.some((t) => (perTheme.get(t) ?? 0) < PER_THEME)) {
      chosen.add(p);
      for (const t of p.themes) perTheme.set(t, (perTheme.get(t) ?? 0) + 1);
    }
  }
  for (const p of candidates) {
    if (chosen.size >= PER_BUCKET) break;
    chosen.add(p);
  }
  const rows = [...chosen].map((p) => [
    p.id,
    p.fen,
    p.moves,
    p.rating,
    p.themes.map((t) => indexOf(themeIdx, t)),
    p.opening ? indexOf(openingIdx, p.opening) : -1,
  ]);
  writeFileSync(`${OUT}/${b}.json`, JSON.stringify(rows));
  index.push([b, rows.length]);
  written += rows.length;
}

writeFileSync(
  `${OUT}/index.json`,
  JSON.stringify({ version: 1, themes: [...themeIdx.keys()], openings: [...openingIdx.keys()], buckets: index }),
);
console.log(`${total} puzzles read, ${kept} passed the quality filter, ${written} written in ${index.length} buckets`);

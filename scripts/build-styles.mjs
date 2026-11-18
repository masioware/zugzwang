// Builds public/data/styles.json: the playing-style profile of each chess legend, for the "Style" page.
//
//   mkdir -p data-src/legends && cd data-src/legends
//   for p in Fischer Kasparov Tal ...; do curl -LO https://www.pgnmentor.com/players/$p.zip; done; unzip '*.zip'
//   node --experimental-strip-types scripts/build-styles.mjs [data-src/legends] [maxGamesPerPlayer] [onlyNames]
//
// Each <Name>.pgn holds the games of one player (PGN Mentor layout). A game counts for the player when
// the file name is the surname that starts the White or Black header ("Tal, Mikhail"). Games are replayed with the same feature code
// the app runs on the user's games, so the two are comparable.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { aggregate, FEATURES, gameFeatures, MIN_PLIES } from '../src/style/features.ts';

const dir = process.argv[2] ?? 'data-src/legends';
const MAX_GAMES = Number(process.argv[3] ?? 2000);
const MIN_GAMES = 40;
// Optional comma-separated file names: rebuild only those and keep the other legends from the existing file.
const ONLY = process.argv[4]?.split(',');
const OUT = 'public/data';

// Display names; the file name is the surname used to find the player in each game.
const NAMES = {
  Alekhine: 'Alexander Alekhine',
  Adams: 'Michael Adams',
  Aronian: 'Levon Aronian',
  Bronstein: 'David Bronstein',
  Chigorin: 'Mikhail Chigorin',
  Euwe: 'Max Euwe',
  Flohr: 'Salo Flohr',
  Geller: 'Efim Geller',
  Gelfand: 'Boris Gelfand',
  Giri: 'Anish Giri',
  Grischuk: 'Alexander Grischuk',
  Gukesh: 'Gukesh Dommaraju',
  Keres: 'Paul Keres',
  Leko: 'Peter Leko',
  Mamedyarov: 'Shakhriyar Mamedyarov',
  Maroczy: 'Géza Maróczy',
  Marshall: 'Frank Marshall',
  Nepomniachtchi: 'Ian Nepomniachtchi',
  Pillsbury: 'Harry Pillsbury',
  PolgarJ: 'Judit Polgár',
  Polugaevsky: 'Lev Polugaevsky',
  Portisch: 'Lajos Portisch',
  Radjabov: 'Teimour Radjabov',
  Reshevsky: 'Samuel Reshevsky',
  Reti: 'Richard Réti',
  Stein: 'Leonid Stein',
  Svidler: 'Peter Svidler',
  Taimanov: 'Mark Taimanov',
  Tarrasch: 'Siegbert Tarrasch',
  Timman: 'Jan Timman',
  Anand: 'Viswanathan Anand',
  Anderssen: 'Adolf Anderssen',
  Botvinnik: 'Mikhail Botvinnik',
  Capablanca: 'José Raúl Capablanca',
  Carlsen: 'Magnus Carlsen',
  Caruana: 'Fabiano Caruana',
  Ding: 'Ding Liren',
  Firouzja: 'Alireza Firouzja',
  Fischer: 'Bobby Fischer',
  Ivanchuk: 'Vasily Ivanchuk',
  Karpov: 'Anatoly Karpov',
  Kasparov: 'Garry Kasparov',
  Korchnoi: 'Viktor Korchnoi',
  Kramnik: 'Vladimir Kramnik',
  Larsen: 'Bent Larsen',
  Lasker: 'Emanuel Lasker',
  Morphy: 'Paul Morphy',
  Nakamura: 'Hikaru Nakamura',
  Nimzowitsch: 'Aron Nimzowitsch',
  Petrosian: 'Tigran Petrosian',
  Rubinstein: 'Akiba Rubinstein',
  Shirov: 'Alexei Shirov',
  Short: 'Nigel Short',
  Smyslov: 'Vasily Smyslov',
  Spassky: 'Boris Spassky',
  Steinitz: 'Wilhelm Steinitz',
  Tal: 'Mikhail Tal',
  Topalov: 'Veselin Topalov',
};

// How the player is written in the headers when the file name is not enough.
const HEADER = { PolgarJ: 'Polgar, Judit' };

const RESULTS = { '1-0': 'white', '0-1': 'black', '1/2-1/2': 'draw' };

/** Games of a PGN file as { headers, moves } (SAN, variations and comments removed). */
function* games(text) {
  for (const chunk of text.split(/\r?\n\r?\n(?=\[Event )/)) {
    const headers = Object.fromEntries([...chunk.matchAll(/^\[(\w+) "(.*)"\]/gm)].map((m) => [m[1], m[2]]));
    if (headers.FEN || headers.SetUp) continue;
    const body = chunk.replace(/^\[.*\]\s*$/gm, '');
    const moves = body
      .replace(/\{[^}]*\}|;[^\n]*|\$\d+/g, ' ')
      .replace(/\([^()]*\)/g, ' ')
      .replace(/\([^()]*\)/g, ' ')
      .replace(/\d+\.(\.\.)?/g, ' ')
      .split(/\s+/)
      .filter((t) => t && !(t in RESULTS) && t !== '*')
      .map((t) => t.replace(/[!?]+$/, ''));
    yield { headers, moves };
  }
}

const legends = ONLY ? JSON.parse(readFileSync(`${OUT}/styles.json`, 'utf8')).legends.filter((l) => !ONLY.some((n) => n.toLowerCase() === l.id)) : [];
for (const file of readdirSync(dir).filter((f) => f.endsWith('.pgn')).sort()) {
  const surname = file.replace(/\.pgn$/, '');
  if (ONLY && !ONLY.includes(surname)) continue;
  const name = NAMES[surname];
  if (!name) continue;
  const mine = [];
  for (const g of games(readFileSync(`${dir}/${file}`, 'latin1'))) {
    const is = (header) => header !== undefined && (HEADER[surname] ? header.startsWith(HEADER[surname]) : header === surname || header.startsWith(`${surname},`) || header.startsWith(`${surname} `));
    const side = is(g.headers.White) ? 'white' : is(g.headers.Black) ? 'black' : null;
    const winner = RESULTS[g.headers.Result];
    if (!side || !winner || g.moves.length < MIN_PLIES) continue;
    mine.push({ ...g, side, result: winner === 'draw' ? 'draw' : winner === side ? 'win' : 'loss' });
  }
  // An even sample across the career when there are more games than needed.
  const step = Math.max(1, mine.length / MAX_GAMES);
  const sample = Array.from({ length: Math.min(mine.length, MAX_GAMES) }, (_, i) => mine[Math.floor(i * step)]);
  const records = sample.flatMap((g) => gameFeatures(g.moves, g.side, g.result) ?? []);
  if (records.length < MIN_GAMES) {
    console.warn(`skip ${surname}: only ${records.length} usable games`);
    continue;
  }
  const { games: n, values } = aggregate(records);
  legends.push({ id: surname.toLowerCase(), name, games: n, values });
  console.log(`${surname.padEnd(12)} ${String(n).padStart(4)} games`);
}

// Features are compared in units of how much legends differ from each other on them.
const scale = {};
for (const k of FEATURES) {
  const xs = legends.map((l) => l.values[k]);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const std = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  scale[k] = { mean: +mean.toFixed(5), std: +std.toFixed(5) };
}
for (const l of legends) for (const k of FEATURES) l.values[k] = +l.values[k].toFixed(5);

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/styles.json`, JSON.stringify({ scale, legends }));
console.log(`wrote ${OUT}/styles.json (${legends.length} legends)`);

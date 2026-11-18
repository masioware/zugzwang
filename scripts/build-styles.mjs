// Builds public/data/styles.json: the repertoire and playing habits of each chess legend, for the "Style" page.
//
//   mkdir -p data-src/legends && cd data-src/legends
//   for p in Fischer Kasparov Tal ...; do curl -LO https://www.pgnmentor.com/players/$p.zip; done; unzip '*.zip'
//   node --experimental-strip-types scripts/build-styles.mjs [data-src/legends] [maxGamesPerPlayer] [onlyNames]
//
// Each <Name>.pgn holds the games of one player (PGN Mentor layout). A game counts for the player when the
// file name is the surname that starts the White or Black header ("Tal, Mikhail"). Games are replayed with
// the same code the app runs on the user's games, so the two are comparable.
//
//  - repertoire: how often each opening family and variation shows up, per colour (every game, only the
//    first moves are replayed);
//  - habits: the player's features minus the opponent's in the same game (see pairedFeatures), over an even
//    sample of up to maxGamesPerPlayer games.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { aggregate, HABITS, MIN_PLIES, pairedFeatures } from '../src/style/features.ts';
import { buildRepertoire, openingKey, pruneRepertoire } from '../src/style/repertoire.ts';

const dir = process.argv[2] ?? 'data-src/legends';
const MAX_GAMES = Number(process.argv[3] ?? 500);
const MIN_GAMES = 40;
// Optional comma-separated file names: rebuild only those and keep the other legends from the existing file.
const ONLY = process.argv[4]?.split(',');
const OUT = 'public/data';
const book = JSON.parse(readFileSync(`${OUT}/openings.json`, 'utf8'));

// Display names; the file name is the surname used to find the player in each game.
const NAMES = {
  Adams: 'Michael Adams',
  Alekhine: 'Alexander Alekhine',
  Anand: 'Viswanathan Anand',
  Anderssen: 'Adolf Anderssen',
  Aronian: 'Levon Aronian',
  Botvinnik: 'Mikhail Botvinnik',
  Bronstein: 'David Bronstein',
  Capablanca: 'José Raúl Capablanca',
  Carlsen: 'Magnus Carlsen',
  Caruana: 'Fabiano Caruana',
  Chigorin: 'Mikhail Chigorin',
  Ding: 'Ding Liren',
  Euwe: 'Max Euwe',
  Firouzja: 'Alireza Firouzja',
  Fischer: 'Bobby Fischer',
  Flohr: 'Salo Flohr',
  Geller: 'Efim Geller',
  Gelfand: 'Boris Gelfand',
  Giri: 'Anish Giri',
  Grischuk: 'Alexander Grischuk',
  Gukesh: 'Gukesh Dommaraju',
  Ivanchuk: 'Vasily Ivanchuk',
  Karpov: 'Anatoly Karpov',
  Kasparov: 'Garry Kasparov',
  Keres: 'Paul Keres',
  Korchnoi: 'Viktor Korchnoi',
  Kramnik: 'Vladimir Kramnik',
  Larsen: 'Bent Larsen',
  Lasker: 'Emanuel Lasker',
  Leko: 'Peter Leko',
  Mamedyarov: 'Shakhriyar Mamedyarov',
  Maroczy: 'Géza Maróczy',
  Marshall: 'Frank Marshall',
  Morphy: 'Paul Morphy',
  Nakamura: 'Hikaru Nakamura',
  Nepomniachtchi: 'Ian Nepomniachtchi',
  Nimzowitsch: 'Aron Nimzowitsch',
  Petrosian: 'Tigran Petrosian',
  Pillsbury: 'Harry Pillsbury',
  PolgarJ: 'Judit Polgár',
  Polugaevsky: 'Lev Polugaevsky',
  Portisch: 'Lajos Portisch',
  Radjabov: 'Teimour Radjabov',
  Reshevsky: 'Samuel Reshevsky',
  Reti: 'Richard Réti',
  Rubinstein: 'Akiba Rubinstein',
  Shirov: 'Alexei Shirov',
  Short: 'Nigel Short',
  Smyslov: 'Vasily Smyslov',
  Spassky: 'Boris Spassky',
  Stein: 'Leonid Stein',
  Steinitz: 'Wilhelm Steinitz',
  Svidler: 'Peter Svidler',
  Taimanov: 'Mark Taimanov',
  Tal: 'Mikhail Tal',
  Tarrasch: 'Siegbert Tarrasch',
  Timman: 'Jan Timman',
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

const within = {}; // habit -> { ss, n }: squared deviations of games from their own player's mean
const previous = ONLY ? JSON.parse(readFileSync(`${OUT}/styles.json`, 'utf8')) : { legends: [], scale: {} };
const legends = previous.legends.filter((l) => !ONLY?.some((n) => n.toLowerCase() === l.id));

for (const file of readdirSync(dir).filter((f) => f.endsWith('.pgn')).sort()) {
  const surname = file.replace(/\.pgn$/, '');
  const name = NAMES[surname];
  if (!name || (ONLY && !ONLY.includes(surname))) continue;
  const is = (header) =>
    header !== undefined && (HEADER[surname] ? header.startsWith(HEADER[surname]) : header === surname || header.startsWith(`${surname},`) || header.startsWith(`${surname} `));
  const mine = [];
  for (const g of games(readFileSync(`${dir}/${file}`, 'latin1'))) {
    const side = is(g.headers.White) ? 'white' : is(g.headers.Black) ? 'black' : null;
    const winner = RESULTS[g.headers.Result];
    if (!side || !winner || g.moves.length < MIN_PLIES) continue;
    mine.push({ ...g, side, result: winner === 'draw' ? 'draw' : winner === side ? 'win' : 'loss' });
  }

  const repertoire = pruneRepertoire(buildRepertoire(mine.map((g) => ({ color: g.side, key: openingKey(g.moves, book) }))));

  // Habits over an even sample across the career when there are more games than needed.
  const step = Math.max(1, mine.length / MAX_GAMES);
  const sample = Array.from({ length: Math.min(mine.length, MAX_GAMES) }, (_, i) => mine[Math.floor(i * step)]);
  const records = sample.flatMap((g) => pairedFeatures(g.moves, g.side, g.result) ?? []);
  if (records.length < MIN_GAMES || !repertoire.white || !repertoire.black) {
    console.warn(`skip ${surname}: ${records.length} usable games`);
    continue;
  }
  const { games: n, values: all } = aggregate(records);
  const values = Object.fromEntries(HABITS.map((k) => [k, all[k]]));
  for (const k of HABITS) {
    const w = (within[k] ??= { ss: 0, n: 0 });
    for (const r of records) {
      if (Number.isNaN(r[k])) continue;
      w.ss += (r[k] - values[k]) ** 2;
      w.n++;
    }
  }
  legends.push({ id: surname.toLowerCase(), name, games: mine.length, values, repertoire });
  console.log(`${surname.padEnd(12)} ${String(mine.length).padStart(5)} games, ${n} for habits`);
}
legends.sort((a, b) => a.id.localeCompare(b.id));

// Habits are compared in units of how much legends differ from each other on them.
//
// Each habit also gets a weight in 0-1 for how reliably it tells players apart: the spread between players
// against the noise of one player's average over PROFILE_GAMES games, as r / (1 + r). When only some players
// are rebuilt (ONLY) the weights of the others are kept.
const PROFILE_GAMES = 60;
const scale = {};
for (const k of HABITS) {
  const xs = legends.map((l) => l.values[k]);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  const noise = within[k]?.n ? within[k].ss / within[k].n : 0;
  const r = noise ? (variance * PROFILE_GAMES) / noise : undefined;
  const weight = ONLY || r === undefined ? previous.scale[k]?.weight ?? 1 : r / (1 + r);
  scale[k] = { mean: +mean.toFixed(6), std: +Math.sqrt(variance).toFixed(6), weight: +weight.toFixed(3) };
}
for (const l of legends) for (const k of HABITS) l.values[k] = +l.values[k].toFixed(6);

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/styles.json`, JSON.stringify({ scale, legends }));
console.log(`wrote ${OUT}/styles.json (${legends.length} legends)`);

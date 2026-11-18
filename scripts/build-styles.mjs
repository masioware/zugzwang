// Builds public/data/styles.json: the opening repertoire of each chess legend, for the "Style" page.
//
//   mkdir -p data-src/legends && cd data-src/legends
//   for p in Fischer Kasparov Tal ...; do curl -LO https://www.pgnmentor.com/players/$p.zip; done; unzip '*.zip'
//   node --experimental-strip-types scripts/build-styles.mjs [data-src/legends] [unused] [onlyNames]
//
// Each <Name>.pgn holds the games of one player (PGN Mentor layout). A game counts for the player when the
// file name is the surname that starts the White or Black header ("Tal, Mikhail"). Games are replayed with
// the same code the app runs on the user's games, so the two are comparable.
//
// The repertoire is how often each opening family and variation shows up, per colour, over every game of the
// player (only the first moves are replayed), plus the average repertoire of all the legends.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildRepertoire, meanRepertoire, MIN_PLIES, openingKey, pruneRepertoire } from '../src/style/repertoire.ts';

const dir = process.argv[2] ?? 'data-src/legends';
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

const previous = ONLY ? JSON.parse(readFileSync(`${OUT}/styles.json`, 'utf8')) : { legends: [] };
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
    if (!side || !RESULTS[g.headers.Result] || g.moves.length < MIN_PLIES) continue;
    mine.push({ ...g, side });
  }

  const repertoire = pruneRepertoire(buildRepertoire(mine.map((g) => ({ color: g.side, key: openingKey(g.moves, book) }))));
  if (mine.length < MIN_GAMES || !repertoire.white || !repertoire.black) {
    console.warn(`skip ${surname}: ${mine.length} usable games`);
    continue;
  }

  legends.push({ id: surname.toLowerCase(), name, games: mine.length, repertoire });
  console.log(`${surname.padEnd(12)} ${String(mine.length).padStart(5)} games`);
}
legends.sort((a, b) => a.id.localeCompare(b.id));

// What the average legend plays: the baseline that "common" is measured against.
const repertoireMean = meanRepertoire(legends.map((l) => l.repertoire));

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/styles.json`, JSON.stringify({ repertoireMean, legends }));
console.log(`wrote ${OUT}/styles.json (${legends.length} legends)`);

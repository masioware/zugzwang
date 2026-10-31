// Builds public/data/openings.json from the CC0 lichess-org/chess-openings TSV files in data-src/.
// Keys are EPD-like position keys (FEN without move counters) so transpositions are recognised.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chess.js';

const positions = {};
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = readFileSync(`data-src/${f}.tsv`, 'utf8').trim().split('\n').slice(1);
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    const chess = new Chess();
    for (const san of pgn.replace(/\d+\.\s*/g, '').trim().split(/\s+/)) {
      chess.move(san);
      const key = chess.fen().split(' ').slice(0, 4).join(' ');
      positions[key] ??= null; // intermediate position of a known line: still "book"
    }
    const key = chess.fen().split(' ').slice(0, 4).join(' ');
    positions[key] = [eco, name];
  }
}
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/openings.json', JSON.stringify(positions));
console.log(Object.keys(positions).length, 'positions');

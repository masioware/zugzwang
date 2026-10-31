// Builds public/data/openings.json and public/data/theory.json from the CC0 lichess-org/chess-openings TSV
// files in data-src/. Keys are EPD-like position keys (FEN without move counters) so transpositions are
// recognised.
//
// openings.json: position key -> [eco, name] for named positions, null for intermediate book positions.
// theory.json:   { names: [line names], tree: { position key -> [[san, [line indices through it]], ...] } }
//                — the theory moves from each position and which named lines continue through each.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chess.js';

const positions = {};
const names = [];
const tree = {};
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  const lines = readFileSync(`data-src/${f}.tsv`, 'utf8').trim().split('\n').slice(1);
  for (const line of lines) {
    const [eco, name, pgn] = line.split('\t');
    const chess = new Chess();
    const id = names.push(name) - 1;
    for (const san of pgn.replace(/\d+\.\s*/g, '').trim().split(/\s+/)) {
      const before = chess.fen().split(' ').slice(0, 4).join(' ');
      const moved = chess.move(san).san;
      const children = (tree[before] ??= {});
      (children[moved] ??= []).push(id);
      const key = chess.fen().split(' ').slice(0, 4).join(' ');
      positions[key] ??= null; // intermediate position of a known line: still "book"
    }
    const key = chess.fen().split(' ').slice(0, 4).join(' ');
    positions[key] = [eco, name];
  }
}
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/openings.json', JSON.stringify(positions));
const theory = Object.fromEntries(Object.entries(tree).map(([key, children]) => [key, Object.entries(children)]));
writeFileSync('public/data/theory.json', JSON.stringify({ names, tree: theory }));
console.log(Object.keys(positions).length, 'positions,', names.length, 'lines,', Object.keys(theory).length, 'theory positions');

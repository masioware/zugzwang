// Copies the single-threaded Stockfish WASM build into public/ so it can be loaded as a Web Worker.
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const src = join('node_modules', 'stockfish', 'bin');
if (!existsSync(src)) process.exit(0);
const dest = join('public', 'stockfish');
mkdirSync(dest, { recursive: true });
for (const f of readdirSync(src)) {
  if (/lite-single/.test(f) && /\.(js|wasm)$/.test(f)) cpSync(join(src, f), join(dest, f));
}

// Runs the real Stockfish WASM build over a short game. Slow, so opt-in: RUN_ENGINE=1 npm test
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { analyseMoves } from '../analysis/classify';
import { replay, sideToMove } from '../lib/chess';
import type { EngineLine } from '../types';
import { Chess } from 'chess.js';

async function analysePositions(fens: string[], depth: number): Promise<EngineLine[][]> {
  const proc = spawn('node', ['node_modules/stockfish/bin/stockfish-19-lite-single.js']);
  let buffer = '';
  const waiters: ((line: string) => boolean)[] = [];
  proc.stdout.on('data', (d: Buffer) => {
    buffer += d.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop()!;
    for (const l of lines) if (waiters[0]?.(l)) waiters.shift();
  });
  const send = (c: string) => proc.stdin.write(c + '\n');
  send('uci');
  send('setoption name MultiPV value 2');
  const out: EngineLine[][] = [];
  for (const fen of fens) {
    if (new Chess(fen).isGameOver()) {
      out.push([]);
      continue;
    }
    const lines: EngineLine[] = [];
    const sign = sideToMove(fen) === 'white' ? 1 : -1;
    await new Promise<void>((resolve) => {
      waiters.push((l) => {
        if (l.startsWith('bestmove')) return resolve(), true;
        const m = l.match(/ depth (\d+) .*multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/);
        if (m && !l.includes('bound')) {
          const v = Number(m[4]) * sign;
          lines[Number(m[2]) - 1] = { depth: Number(m[1]), pv: m[5].split(' '), ...(m[3] === 'cp' ? { cp: v } : { mate: v }) };
        }
        return false;
      });
      send(`position fen ${fen}`);
      send(`go depth ${depth}`);
    });
    out.push(lines);
  }
  proc.kill();
  return out;
}

describe.runIf(process.env.RUN_ENGINE)('engine integration', () => {
  it('classifies a miniature with a blunder and the mating move', async () => {
    // Scholar's mate: 3...Nf6?? allows Qxf7#.
    const plies = replay(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']);
    const fens = [plies[0].fenBefore, ...plies.map((p) => p.fenAfter)];
    const positions = await analysePositions(fens, 12);
    const { moves, accuracy } = analyseMoves({ plies, positions, bookPlies: 2 });
    console.table(moves.map((m) => ({ san: m.san, c: m.classification, before: m.winBefore.toFixed(1), after: m.winAfter.toFixed(1), best: m.bestSan })));
    expect(moves[5].classification).toBe('blunder');
    expect(moves[6].classification).toBe('best');
    expect(accuracy.white).toBeGreaterThan(accuracy.black);
  }, 60_000);
});

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Lists user-provided assets that are not part of the repo:
 *   public/pieces/local/<set>/wp.png … bk.png
 *   public/boards/local/<theme>.png
 * Served at /local-assets.json in dev and emitted into the build.
 */
export function scanLocalAssets(root = 'public') {
  const piecesDir = join(root, 'pieces', 'local');
  const boardsDir = join(root, 'boards', 'local');
  const pieces = existsSync(piecesDir)
    ? readdirSync(piecesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(join(piecesDir, d.name, 'wn.png')))
        .map((d) => d.name)
        .sort()
    : [];
  const boards = existsSync(boardsDir)
    ? readdirSync(boardsDir)
        .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
        .sort()
    : [];
  return { pieces, boards };
}

export default function localAssets(): Plugin {
  return {
    name: 'zugzwang-local-assets',
    configureServer(server) {
      server.middlewares.use('/local-assets.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(scanLocalAssets()));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'local-assets.json', source: JSON.stringify(scanLocalAssets()) });
    },
  };
}

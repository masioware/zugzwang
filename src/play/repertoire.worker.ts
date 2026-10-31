import { buildRepertoire } from './repertoire';
import type { Color } from '../types';

/** Builds a repertoire off the main thread; the Map is posted back as is (structured clone keeps Maps). */
self.onmessage = (e: MessageEvent<{ id: number; games: { moves: string[]; userColor: Color }[] }>) => {
  self.postMessage({ id: e.data.id, repertoire: buildRepertoire(e.data.games) });
};

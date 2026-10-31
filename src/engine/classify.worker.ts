import { replay } from '../lib/chess';
import { analyseMoves } from '../analysis/classify';
import { identifyOpening, loadOpeningBook } from '../analysis/openings';
import type { ClassifyInput } from './classifyClient';

/** Classifies an analysed game's moves off the main thread (sacrifice detection replays many positions). */
self.onmessage = async (e: MessageEvent<{ id: number; input: ClassifyInput }>) => {
  const { moves, positions, clocks, initialTime } = e.data.input;
  const plies = replay(moves);
  const { bookPlies } = identifyOpening(plies.map((p) => p.fenAfter), await loadOpeningBook());
  self.postMessage({ id: e.data.id, result: analyseMoves({ plies, positions, bookPlies, clocks, initialTime }) });
};

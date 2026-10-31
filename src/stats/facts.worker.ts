import { loadOpeningBook } from '../analysis/openings';
import { computeFacts, FACTS_VERSION, type FactsInput, type StoredFacts } from './facts';
import type { Game } from '../types';

/** Replays a batch of games off the main thread; replies with their facts in the same order. */
self.onmessage = async (e: MessageEvent<{ id: number; games: FactsInput[] }>) => {
  const book = await loadOpeningBook();
  const facts: StoredFacts[] = e.data.games.map((g) => ({ gameId: g.id, v: FACTS_VERSION, ...computeFacts(g as Game, book) }));
  self.postMessage({ id: e.data.id, facts });
};

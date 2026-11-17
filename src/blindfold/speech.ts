// Spoken notation, a text description of a position, and the browser's speech APIs (all optional).
import { Chess, type Color, type PieceSymbol } from 'chess.js';

export type Lang = 'en' | 'pt';
export const langOf = (language: string | undefined): Lang => (language?.toLowerCase().startsWith('pt') ? 'pt' : 'en');
const VOICE_LANG: Record<Lang, string> = { en: 'en-US', pt: 'pt-BR' };

const NAMES: Record<Lang, Record<string, string>> = {
  en: { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' },
  pt: { K: 'Rei', Q: 'Dama', R: 'Torre', B: 'Bispo', N: 'Cavalo', P: 'Peão' },
};
const WORDS: Record<Lang, { takes: string; check: string; mate: string; short: string; long: string; promotes: string }> = {
  en: { takes: 'takes', check: 'check', mate: 'checkmate', short: 'castles short', long: 'castles long', promotes: 'promotes to' },
  pt: { takes: 'captura', check: 'xeque', mate: 'xeque-mate', short: 'roque pequeno', long: 'roque grande', promotes: 'promove para' },
};

/** "e 4" reads better than "e4" in most synthetic voices. */
const spaced = (square: string) => `${square[0]} ${square[1]}`;

/** A move in SAN as it should be read aloud. */
export function spokenMove(san: string, lang: Lang): string {
  const w = WORDS[lang];
  const suffix = san.endsWith('#') ? ` ${w.mate}` : san.endsWith('+') ? ` ${w.check}` : '';
  const core = san.replace(/[+#]/g, '');
  if (core === 'O-O') return w.short + suffix;
  if (core === 'O-O-O') return w.long + suffix;
  const m = core.match(/^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?$/);
  if (!m) return san;
  const [, piece, file, rank, capture, to, promo] = m;
  const parts: string[] = [];
  if (piece) parts.push(NAMES[lang][piece]);
  // A pawn capture says its file ("e takes d 5"); a piece's disambiguation is the file and/or rank.
  if (file) parts.push(file);
  if (rank) parts.push(rank);
  if (capture) parts.push(w.takes);
  parts.push(spaced(to));
  if (promo) parts.push(w.promotes, NAMES[lang][promo]);
  return parts.join(' ') + suffix;
}

const ORDER: PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p'];

/** Every piece of both sides, grouped by kind: "King e1. Rook a1 h1. …". Used as a hint and read aloud on request. */
export function describePosition(fen: string, lang: Lang): { white: string; black: string } {
  const board = new Chess(fen).board();
  const by = (color: Color) => {
    const found = new Map<PieceSymbol, string[]>();
    for (const row of board)
      for (const p of row)
        if (p && p.color === color) found.set(p.type, [...(found.get(p.type) ?? []), p.square]);
    return ORDER.filter((t) => found.has(t))
      .map((t) => `${NAMES[lang][t.toUpperCase()]} ${found.get(t)!.sort().join(' ')}`)
      .join('. ');
  };
  return { white: by('w'), black: by('b') };
}

/** Makes the text speakable: "a1" -> "a 1". */
export const speakable = (text: string) => text.replace(/\b([a-h])([1-8])\b/g, '$1 $2');

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string, lang: Lang): boolean {
  if (!canSpeak()) return false;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(speakable(text));
  u.lang = VOICE_LANG[lang];
  window.speechSynthesis.speak(u);
  return true;
}

export const stopSpeaking = () => {
  if (canSpeak()) window.speechSynthesis.cancel();
};

// --- Speech recognition (Chrome, Edge, Safari): the types aren't in lib.dom yet.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const canListen = () => !!recognitionCtor();

/** Listens once; calls `onText` with the alternatives the recogniser heard (best first), then `onEnd`. */
export function listen(lang: Lang, onText: (alternatives: string[]) => void, onEnd: () => void): () => void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    onEnd();
    return () => {};
  }
  const r = new Ctor();
  r.lang = VOICE_LANG[lang];
  r.continuous = false;
  r.interimResults = false;
  r.maxAlternatives = 5;
  r.onresult = (e) => {
    const first = e.results[0];
    if (first) onText(Array.from(first, (a) => a.transcript));
  };
  r.onend = onEnd;
  r.onerror = onEnd;
  r.start();
  return () => r.stop();
}

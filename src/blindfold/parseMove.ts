// Turns what the player typed or said ("Nf3", "cavalo f3", "e2e4", "roque pequeno") into a legal move.
import { Chess } from 'chess.js';

export type ParsedMove =
  | { ok: true; from: string; to: string; promotion?: string; san: string; piece: string }
  | { ok: false; reason: 'empty' | 'invalid' };

/** Spoken forms, accent-free; numbers matter because speech recognition writes "f três". */
const WORDS: [RegExp, string][] = [
  [/\b(?:roque grande|castle long|long castle|castles long|queenside castle|castle queenside)\b/gi, 'o-o-o'],
  [/\b(?:roque pequeno|roque|short castle|castle short|castles short|kingside castle|castle kingside|castle|castles)\b/gi, 'o-o'],
  [/\b(?:rei|king)\b/gi, 'K'],
  [/\b(?:dama|rainha|queen)\b/gi, 'Q'],
  [/\b(?:torre|rook)\b/gi, 'R'],
  [/\b(?:bispo|bishop)\b/gi, 'B'],
  [/\b(?:cavalo|knight)\b/gi, 'N'],
  [/\b(?:peao|pawn)\b/gi, ''],
  [/\b(?:captura|capturando|come|takes|captures|taking)\b/gi, 'x'],
  [/\b(?:promove|promocao|promotes|promotion)\b/gi, '='],
  [/\b(?:um|uma|one)\b/gi, '1'],
  [/\b(?:dois|duas|two)\b/gi, '2'],
  [/\b(?:tres|three)\b/gi, '3'],
  [/\b(?:quatro|four)\b/gi, '4'],
  [/\b(?:cinco|five)\b/gi, '5'],
  [/\b(?:seis|six)\b/gi, '6'],
  [/\b(?:sete|seven)\b/gi, '7'],
  [/\b(?:oito|eight)\b/gi, '8'],
  [/\b(?:para|to|em|on|move|mova|mover|joga|jogar|play|check|xeque|mate|checkmate)\b/gi, ''],
];

/** The text with words replaced by notation and everything but notation characters removed. */
export function normalizeMoveText(text: string): string {
  let s = text.normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [re, to] of WORDS) s = s.replace(re, ` ${to} `);
  return s.replace(/[^a-zA-Z0-9=\-]/g, '').replace(/^-+|-+$/g, '');
}

function candidates(compact: string): string[] {
  const lower = compact.toLowerCase();
  if (/^(?:o-o-o|0-0-0|ooo)$/.test(lower)) return ['O-O-O'];
  if (/^(?:o-o|0-0|oo)$/.test(lower)) return ['O-O'];
  const out: string[] = [];
  const promo = lower.match(/^([a-h](?:x[a-h])?[1-8])=?([qrbn])$/);
  if (promo) out.push(`${promo[1]}=${promo[2].toUpperCase()}`);
  // A piece move keeps its capital letter; the rest is squares, so lower case.
  if (/^[KQRBN]/.test(compact)) out.push(compact[0] + compact.slice(1).toLowerCase());
  out.push(lower);
  // "bxc3" is a pawn capture first and a bishop move second; "nf3" can only be a knight.
  if (/^[kqrbn]/.test(lower)) out.push(lower[0].toUpperCase() + lower.slice(1));
  return out;
}

export function parseMove(text: string, fen: string): ParsedMove {
  const compact = normalizeMoveText(text);
  if (!compact) return { ok: false, reason: 'empty' };
  try {
    new Chess(fen);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const attempts: Parameters<Chess['move']>[0][] = [];
  const coords = compact.toLowerCase().match(/^([a-h][1-8])-?([a-h][1-8])([qrbn])?$/);
  if (coords) attempts.push({ from: coords[1], to: coords[2], promotion: coords[3] ?? 'q' });
  for (const c of candidates(compact)) attempts.push(c);
  for (const a of attempts) {
    try {
      // chess.js mutates on success, so each try gets its own board.
      const m = new Chess(fen).move(a);
      return { ok: true, from: m.from, to: m.to, promotion: m.promotion, san: m.san, piece: m.color + m.piece.toUpperCase() };
    } catch {
      // Next reading.
    }
  }
  return { ok: false, reason: 'invalid' };
}

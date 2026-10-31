import { useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { Chessboard, defaultArrowOptions } from 'react-chessboard';
import type { Classification } from '../types';
import ClassificationIcon, { CLASS_COLOR } from './ClassificationIcon';
import { BOARD_THEMES, DEFAULT_PIECE_SET, PIECES, boardImageUrl, pieceUrl, useSettings, type PieceSet } from '../lib/settings';

const pieceCache = new Map<PieceSet, Record<string, () => React.JSX.Element>>();

/** react-chessboard renderers for a piece set (memoised so the board doesn't re-mount pieces). */
function piecesFor(set: PieceSet) {
  if (!pieceCache.has(set))
    pieceCache.set(
      set,
      Object.fromEntries(
        PIECES.map((p) => [
          p,
          () => (
            <img
              src={pieceUrl(set, p)}
              alt=""
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              // A missing local image falls back to the default set instead of a broken icon.
              onError={(e) => {
                const fallback = pieceUrl(DEFAULT_PIECE_SET, p);
                if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback;
              }}
            />
          ),
        ]),
      ),
    );
  return pieceCache.get(set)!;
}

export interface BoardArrow {
  from: string;
  to: string;
  color: string;
}

interface Props {
  fen: string;
  flipped: boolean;
  lastMove?: { from: string; to: string };
  marker?: { square: string; classification: Classification };
  arrows: BoardArrow[];
  /** Extra square tints (square -> CSS colour), e.g. a puzzle hint. */
  highlights?: Record<string, string>;
  onMove: (from: string, to: string, piece: string) => boolean;
  /** False while the user may not move (e.g. the opponent's reply in a puzzle): no selection, no dots. */
  movable?: boolean;
}

type MarkColor = 'red' | 'green';
const MARK_COLOR: Record<MarkColor, string> = { red: 'rgba(235, 97, 80, 0.82)', green: 'rgba(172, 206, 89, 0.82)' };

/** Legal destinations of the piece on `square`, split into quiet moves and captures; plus the checked king. */
function legalTargets(fen: string, square: string | null) {
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return { quiet: new Set<string>(), captures: new Set<string>(), checkedKing: undefined };
  }
  const quiet = new Set<string>();
  const captures = new Set<string>();
  // chess.js only lists legal moves, so a side in check sees just the moves that get out of it.
  if (square)
    for (const m of chess.moves({ square: square as Square, verbose: true }))
      (m.captured ? captures : quiet).add(m.to);
  const checkedKing = chess.inCheck()
    ? chess.board().flat().find((p) => p?.type === 'k' && p.color === chess.turn())?.square
    : undefined;
  return { quiet, captures, checkedKing };
}

export default function Board({ fen, flipped, lastMove, marker, arrows, highlights, onMove, movable = true }: Props) {
  // The selected square belongs to one position: any new position (a move, navigation) clears it.
  const [picked, setPicked] = useState<{ fen: string; square: string } | null>(null);
  const selected = movable && picked?.fen === fen ? picked.square : null;
  const turn = fen.split(' ')[1] === 'b' ? 'b' : 'w';
  const { quiet, captures, checkedKing } = useMemo(() => legalTargets(fen, selected), [fen, selected]);

  const select = (square: string | null) => setPicked(square ? { fen, square } : null);
  // Right-click marks (red; green with Shift), like chess.com. They belong to the position on the board.
  const [marks, setMarks] = useState<{ fen: string; squares: Record<string, MarkColor> }>({ fen, squares: {} });
  const shownMarks = marks.fen === fen ? marks.squares : {};
  /** Where the right button went down (and whether Shift was held): a mark needs it to come up on the same square. */
  const rightDown = useRef<{ square: string; shift: boolean } | null>(null);
  const toggleMark = (square: string, color: MarkColor) => {
    const { [square]: current, ...rest } = shownMarks;
    setMarks({ fen, squares: current === color ? rest : { ...rest, [square]: color } });
  };

  const onSquareClick = ({ piece, square }: { piece: { pieceType: string } | null; square: string }) => {
    // A left click clears the marks, as on chess.com.
    if (Object.keys(shownMarks).length) setMarks({ fen, squares: {} });
    if (!movable) return;
    if (selected && (quiet.has(square) || captures.has(square))) {
      const from = selected;
      select(null);
      onMove(from, square, piece?.pieceType ?? '');
      return;
    }
    // Clicking a piece of the side to move selects it (again: deselects); anything else clears.
    if (piece && piece.pieceType[0] === turn && square !== selected) select(square);
    else select(null);
  };

  const boardTheme = useSettings((s) => s.boardTheme);
  // Image boards (local themes) are drawn as one background with transparent squares.
  const boardImage = boardImageUrl(boardTheme);
  const theme = boardImage
    ? { light: 'transparent', dark: 'transparent' }
    : (BOARD_THEMES[boardTheme] ?? BOARD_THEMES.graphite);
  const pieceSet = useSettings((s) => s.pieceSet);
  // The last move's squares take the colour of its classification (plain yellow when unclassified).
  const tint = marker ? `color-mix(in srgb, ${CLASS_COLOR[marker.classification]} 55%, transparent)` : 'rgba(255, 214, 10, 0.5)';
  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      s[lastMove.from] = { background: tint };
      s[lastMove.to] = { background: tint };
    }
    for (const [square, color] of Object.entries(highlights ?? {})) s[square] = { background: color };
    for (const [square, mark] of Object.entries(shownMarks)) s[square] = { background: MARK_COLOR[mark] };
    if (selected) s[selected] = { ...s[selected], background: 'rgba(255, 214, 10, 0.55)' };
    if (checkedKing) {
      // Layered over whatever tint the square already has (a last-move colour is a valid bottom layer).
      const glow = 'radial-gradient(circle, rgba(239, 68, 68, 0.95) 0%, rgba(239, 68, 68, 0.55) 40%, transparent 72%)';
      const under = s[checkedKing]?.background;
      s[checkedKing] = { background: under ? `${glow}, ${under}` : glow };
    }
    return s;
  }, [lastMove, tint, highlights, checkedKing, selected, shownMarks]);

  return (
    // No text selection (Shift+click would extend it over the pieces) and no focus ring on the pieces,
    // which the library makes focusable buttons: both drew yellow artefacts on the squares.
    <div className="board-root select-none">
    <Chessboard
      options={{
        id: 'review',
        position: fen,
        boardOrientation: flipped ? 'black' : 'white',
        pieces: piecesFor(pieceSet),
        darkSquareStyle: { backgroundColor: theme.dark },
        lightSquareStyle: { backgroundColor: theme.light },
        boardStyle: {
          borderRadius: 12,
          overflow: 'hidden',
          ...(boardImage && { backgroundImage: `url("${boardImage}")`, backgroundSize: '100% 100%' }),
        },
        darkSquareNotationStyle: boardImage
          ? { color: '#fff', fontWeight: 700, textShadow: '0 0 2px rgba(0,0,0,0.6)' }
          : { color: theme.light, fontWeight: 700 },
        lightSquareNotationStyle: boardImage
          ? { color: '#fff', fontWeight: 700, textShadow: '0 0 2px rgba(0,0,0,0.6)' }
          : { color: theme.dark, fontWeight: 700 },
        arrowOptions: {
          ...defaultArrowOptions,
          arrowWidthDenominator: 5,
          arrowStartOffset: 0.3,
          opacity: 0.8,
        },
        animationDurationInMs: 150,
        // The library outlines the square under a dragged piece with a 1px black line; the dots already guide the drop.
        dropSquareStyle: { boxShadow: 'none' },
        squareStyles,
        // A picked piece's dots matter more than the engine arrow, which would cover them.
        arrows: selected ? [] : arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color })),
        allowDragging: movable,
        // Picking a piece up shows its moves, like a click does.
        onPieceDrag: ({ square, piece }) => square && piece.pieceType[0] === turn && select(square),
        onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
          if (!targetSquare || targetSquare === sourceSquare) return false;
          const ok = onMove(sourceSquare, targetSquare, piece.pieceType);
          if (ok) select(null);
          return ok;
        },
        onSquareClick,
        // A right click is down and up on the same square; ending elsewhere is an arrow drag (drawn by the
        // library). The contextmenu event can't tell them apart: it fires on mouse down on some systems.
        onSquareMouseDown: ({ square }, e) => {
          if (e.button === 2) rightDown.current = { square, shift: e.shiftKey };
        },
        onSquareMouseUp: ({ square }, e) => {
          if (e.button !== 2) return;
          const down = rightDown.current;
          rightDown.current = null;
          if (down?.square === square) toggleMark(square, down.shift || e.shiftKey ? 'green' : 'red');
        },
        squareRenderer: ({ square, children }) => (
          <div style={{ width: '100%', height: '100%', position: 'relative', ...squareStyles[square] }}>
            {children}
            {quiet.has(square) && (
              <span className="pointer-events-none absolute top-1/2 left-1/2 z-10 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/25" />
            )}
            {captures.has(square) && (
              <span
                className="pointer-events-none absolute inset-0 z-10"
                // Corners shaded around a clear circle that touches the edges (closest-side = half a square).
                style={{ background: 'radial-gradient(circle closest-side, transparent 97%, rgba(0, 0, 0, 0.2) 100%)' }}
              />
            )}
            {marker?.square === square && (
              // ~37% of the square near its top-right corner, poking out of the square — except on the
              // board's top/right edge (as seen by the viewer), where it tucks inside to avoid being cut.
              <span
                className="pointer-events-none absolute z-10 w-[37%]"
                style={{
                  top: square[1] === (flipped ? '1' : '8') ? '3%' : '-15%',
                  right: square[0] === (flipped ? 'a' : 'h') ? '3%' : '-6%',
                }}
              >
                <ClassificationIcon c={marker.classification} className="block h-auto w-full" />
              </span>
            )}
          </div>
        ),
      }}
    />
    </div>
  );
}

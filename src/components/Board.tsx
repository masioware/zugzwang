import { useMemo } from 'react';
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
}

export default function Board({ fen, flipped, lastMove, marker, arrows, highlights, onMove }: Props) {
  const boardTheme = useSettings((s) => s.boardTheme);
  // Image boards (local themes) are drawn as one background with transparent squares.
  const boardImage = boardImageUrl(boardTheme);
  const theme = boardImage
    ? { light: 'transparent', dark: 'transparent' }
    : (BOARD_THEMES[boardTheme] ?? BOARD_THEMES.green);
  const pieceSet = useSettings((s) => s.pieceSet);
  // The last move's squares take the colour of its classification (plain yellow when unclassified).
  const tint = marker ? `color-mix(in srgb, ${CLASS_COLOR[marker.classification]} 55%, transparent)` : 'rgba(255, 255, 51, 0.45)';
  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      s[lastMove.from] = { background: tint };
      s[lastMove.to] = { background: tint };
    }
    for (const [square, color] of Object.entries(highlights ?? {})) s[square] = { background: color };
    return s;
  }, [lastMove, tint, highlights]);

  return (
    <Chessboard
      options={{
        id: 'review',
        position: fen,
        boardOrientation: flipped ? 'black' : 'white',
        pieces: piecesFor(pieceSet),
        darkSquareStyle: { backgroundColor: theme.dark },
        lightSquareStyle: { backgroundColor: theme.light },
        boardStyle: boardImage ? { backgroundImage: `url("${boardImage}")`, backgroundSize: '100% 100%' } : undefined,
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
        squareStyles,
        arrows: arrows.map((a) => ({ startSquare: a.from, endSquare: a.to, color: a.color })),
        onPieceDrop: ({ sourceSquare, targetSquare, piece }) =>
          !!targetSquare && onMove(sourceSquare, targetSquare, piece.pieceType),
        squareRenderer: ({ square, children }) => (
          <div style={{ width: '100%', height: '100%', position: 'relative', ...squareStyles[square] }}>
            {children}
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
  );
}

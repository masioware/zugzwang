import { useTranslation } from 'react-i18next';
import type { EngineLine } from '../types';
import { formatScore } from '../analysis/winprob';
import { fullmoveNumber, pvToSan, sideToMove } from '../lib/chess';

interface Props {
  fen: string;
  lines: EngineLine[];
  onPlay: (uci: string) => void;
}

export default function EngineLines({ fen, lines, onPlay }: Props) {
  const { t } = useTranslation();
  const depth = lines[0]?.depth;
  const blackToMove = sideToMove(fen) === 'black';
  const moveNo = fullmoveNumber(fen);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-ink-3">
        <span className="font-semibold uppercase tracking-wide">{t('review.engineLines')}</span>
        {depth && <span>{t('review.depth', { depth })}</span>}
      </div>
      {lines.length === 0 && <div className="h-6 animate-pulse rounded bg-white/5" />}
      {lines.map((line, i) => {
        const san = pvToSan(fen, line.pv).slice(0, 12);
        const whiteAhead = (line.mate ?? line.cp ?? 0) >= 0;
        return (
          <button
            key={i}
            onClick={() => onPlay(line.pv[0])}
            className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-white/5"
          >
            <span
              className={`tabular w-14 shrink-0 rounded px-1 text-center text-xs font-bold ${
                whiteAhead ? 'bg-ink text-panel-2' : 'bg-panel-2 text-ink ring-1 ring-line'
              }`}
            >
              {formatScore(line)}
            </span>
            <span className="truncate text-ink-2">
              {san.map((m, j) => {
                const ply = j + (blackToMove ? 1 : 0);
                const prefix = ply % 2 === 0 ? `${moveNo + ply / 2}. ` : j === 0 ? `${moveNo}… ` : '';
                return (
                  <span key={j} className={j === 0 ? 'font-semibold text-ink' : ''}>
                    {prefix}
                    {m}{' '}
                  </span>
                );
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
}

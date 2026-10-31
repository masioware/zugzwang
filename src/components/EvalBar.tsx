import type { Score } from '../types';
import { formatScore, winPercent } from '../analysis/winprob';

export default function EvalBar({ score, flipped }: { score?: Score; flipped: boolean }) {
  const white = score ? winPercent(score) : 50;
  const label = score ? formatScore(score).replace('+', '') : '0.00';
  const whiteAhead = white >= 50;
  return (
    <div
      className={`relative w-7 shrink-0 overflow-hidden rounded bg-[#403d39] ${flipped ? 'rotate-180' : ''}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white)}
      aria-label={label}
    >
      <div className="absolute inset-x-0 bottom-0 bg-ink transition-[height] duration-300" style={{ height: `${white}%` }} />
      <span
        className={`absolute inset-x-0 text-center text-[9px] font-bold tracking-tighter ${flipped ? 'rotate-180' : ''} ${
          whiteAhead ? 'bottom-1 text-panel-2' : 'top-1 text-ink'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

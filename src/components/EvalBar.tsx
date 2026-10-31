import type { Score } from '../types';
import { formatScore, winPercent } from '../analysis/winprob';

export default function EvalBar({ score, flipped }: { score?: Score; flipped: boolean }) {
  const white = score ? winPercent(score) : 50;
  const label = score ? formatScore(score).replace('+', '') : '0.00';
  const whiteAhead = white >= 50;
  return (
    <div
      className={`relative w-7 shrink-0 overflow-hidden rounded-lg bg-panel-3 ring-1 ring-line ${flipped ? 'rotate-180' : ''}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(white)}
      aria-label={label}
    >
      <div className="absolute inset-x-0 bottom-0 bg-[#f2f1ec] transition-[height] duration-500 ease-out" style={{ height: `${white}%` }} />
      <div className="absolute inset-x-0 top-1/2 h-px bg-accent/60" />
      <span
        className={`absolute inset-x-0 text-center font-mono text-[9px] font-bold tracking-tighter ${flipped ? 'rotate-180' : ''} ${
          whiteAhead ? 'bottom-1 text-bg' : 'top-1 text-ink'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

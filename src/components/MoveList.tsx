import { useEffect, useRef } from 'react';
import type { MoveAnalysis } from '../types';
import type { Ply } from '../lib/chess';
import ClassificationIcon from './ClassificationIcon';

interface Props {
  plies: Ply[];
  analysis?: MoveAnalysis[];
  /** Number of plies played (0 = starting position). */
  current: number;
  onSelect: (ply: number) => void;
}

export default function MoveList({ plies, analysis, current, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Scroll only the list itself (scrollIntoView would also scroll the page).
  useEffect(() => {
    const box = ref.current;
    const el = box?.querySelector<HTMLElement>('[data-current="true"]');
    if (!box) return;
    if (!el) return void (current === 0 && (box.scrollTop = 0));
    const top = el.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + el.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTop = top - box.clientHeight / 2;
  }, [current]);

  const rows: number[] = [];
  for (let i = 0; i < plies.length; i += 2) rows.push(i);

  const cell = (i: number) => {
    const p = plies[i];
    if (!p) return <span />;
    const a = analysis?.[i];
    const isCurrent = current === i + 1;
    return (
      <button
        data-current={isCurrent}
        onClick={() => onSelect(i + 1)}
        className={`flex items-center gap-1.5 rounded px-1.5 py-[3px] text-left font-semibold ${
          isCurrent ? 'bg-white/15 text-ink shadow-[inset_0_-2px_0_rgba(255,255,255,0.15)]' : 'text-ink-2 hover:bg-white/5 hover:text-ink'
        }`}
      >
        {a && a.classification !== 'best' && a.classification !== 'excellent' && a.classification !== 'good' ? (
          <ClassificationIcon c={a.classification} size={14} />
        ) : (
          <span className="w-[14px]" />
        )}
        {p.san}
      </button>
    );
  };

  return (
    <div ref={ref} className="relative h-52 overflow-y-auto py-1 text-sm">
      {rows.map((i) => (
        <div key={i} className={`grid grid-cols-[2.25rem_1fr_1fr] items-center px-3 ${i % 4 === 0 ? 'bg-white/[0.025]' : ''}`}>
          <span className="tabular text-ink-3">{i / 2 + 1}.</span>
          {cell(i)}
          {cell(i + 1)}
        </div>
      ))}
    </div>
  );
}

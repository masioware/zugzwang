import { useEffect, useState } from 'react';
import { formatClock } from '../../puzzles/format';

/** Running stopwatch: `base` plus the time since `from` (frozen at `to` once set). */
export default function Clock({ from, to, base = 0, className }: { from: number | null; to?: number | null; base?: number; className?: string }) {
  const [now, setNow] = useState(Date.now());
  const running = from !== null && !to;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);
  const elapsed = from === null ? 0 : (to ?? now) - from;
  return <span className={`tabular ${className ?? ''}`}>{formatClock(base + Math.max(0, elapsed))}</span>;
}

import type { Player } from '../types';

function formatClock(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = sec < 10 && !h && !m ? sec.toFixed(1).padStart(4, '0') : String(Math.floor(sec)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export default function PlayerCard({
  player,
  color,
  clock,
  active,
}: {
  player: Player;
  color: 'white' | 'black';
  clock?: number;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold ${
            color === 'white' ? 'bg-ink text-bg' : 'bg-panel-3 text-ink ring-1 ring-line-2'
          }`}
        >
          {player.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate font-semibold">{player.name}</span>
        {player.rating && <span className="chip tabular font-mono">{player.rating}</span>}
      </div>
      {clock !== undefined && (
        <span
          className={`tabular rounded-lg px-2.5 py-1 font-mono text-lg font-semibold transition-colors ${
            active ? 'bg-accent text-accent-ink shadow-[0_0_18px_-4px_var(--color-accent)]' : 'bg-panel-2 text-ink-3 ring-1 ring-line'
          }`}
        >
          {formatClock(clock)}
        </span>
      )}
    </div>
  );
}

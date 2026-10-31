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
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className={`h-6 w-6 rounded ${color === 'white' ? 'bg-ink' : 'border border-line bg-panel-2'}`} />
        <span className="font-semibold">{player.name}</span>
        {player.rating && <span className="tabular text-ink-3">({player.rating})</span>}
      </div>
      {clock !== undefined && (
        <span
          className={`tabular rounded px-2 py-0.5 font-mono text-lg ${
            active ? (color === 'white' ? 'bg-ink text-panel-2' : 'bg-panel-2 text-ink') : 'bg-white/5 text-ink-3'
          }`}
        >
          {formatClock(clock)}
        </span>
      )}
    </div>
  );
}

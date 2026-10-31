import type { GameSource } from '../types';

const MARK: Record<GameSource, { letter: string; title: string; style: string }> = {
  chesscom: { letter: 'C', title: 'Chess.com', style: 'bg-[#81b64c] text-[#0b0b0c]' },
  lichess: { letter: 'L', title: 'Lichess', style: 'bg-ink text-bg' },
  bot: { letter: 'B', title: 'Bot', style: 'bg-accent text-accent-ink' },
};

/** Small letter mark for where a game came from (not the platforms' logos). */
export default function PlatformIcon({ source, className = '' }: { source: GameSource; className?: string }) {
  const m = MARK[source];
  return (
    <span
      title={m.title}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${m.style} ${className}`}
    >
      {m.letter}
    </span>
  );
}

import type { Source } from '../types';

/** Small letter mark for the platform (not the platforms' logos). */
export default function PlatformIcon({ source, className = '' }: { source: Source; className?: string }) {
  return (
    <span
      title={source === 'chesscom' ? 'Chess.com' : 'Lichess'}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black ${
        source === 'chesscom' ? 'bg-accent text-white' : 'bg-ink text-panel-2'
      } ${className}`}
    >
      {source === 'chesscom' ? 'C' : 'L'}
    </span>
  );
}

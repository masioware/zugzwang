import type { TimeClass } from '../types';

type IconProps = { className?: string };

const base = (path: React.ReactNode, viewBox = '0 0 24 24') =>
  function Icon({ className = 'h-5 w-5' }: IconProps) {
    return (
      <svg viewBox={viewBox} className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {path}
      </svg>
    );
  };

export const FirstIcon = base(<><path d="M18 6l-6 6 6 6" /><path d="M7 6v12" /></>);
export const PrevIcon = base(<path d="M15 6l-6 6 6 6" />);
export const NextIcon = base(<path d="M9 6l6 6-6 6" />);
export const LastIcon = base(<><path d="M6 6l6 6-6 6" /><path d="M17 6v12" /></>);
export const FlipIcon = base(<><path d="M7 4v16" /><path d="M3 8l4-4 4 4" /><path d="M17 20V4" /><path d="M13 16l4 4 4-4" /></>);
export const ExternalIcon = base(<><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></>);

const BulletIcon = base(<><path d="M5 19l4-4" /><path d="M8 12l6-6c2-2 5-2 5-2s0 3-2 5l-6 6z" /></>);
const BlitzIcon = base(<path d="M13 2L4 14h7l-1 8 9-12h-7z" />);
const RapidIcon = base(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5" /><path d="M10 2h4" /></>);
const ClassicalIcon = base(<><path d="M6 3h12M6 21h12" /><path d="M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9s10 4 10 9" /></>);
const DailyIcon = base(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);

const TIME_ICONS: Record<TimeClass, (p: IconProps) => React.JSX.Element> = {
  bullet: BulletIcon,
  blitz: BlitzIcon,
  rapid: RapidIcon,
  classical: ClassicalIcon,
  daily: DailyIcon,
};

/** Time-control glyph in the colour chess players associate with it. */
export function TimeClassIcon({ timeClass, className = 'h-4 w-4' }: { timeClass: TimeClass; className?: string }) {
  const Icon = TIME_ICONS[timeClass];
  const color = { bullet: 'text-[#e3aa24]', blitz: 'text-[#fad541]', rapid: 'text-[#81b64c]', classical: 'text-[#c3c2b7]', daily: 'text-[#f7c631]' }[timeClass];
  return (
    <span className={color}>
      <Icon className={className} />
    </span>
  );
}

export const BoardIcon = base(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>);
export const OverviewIcon = base(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /><path d="M8 13l2-2 2 2 2-3" /></>);
export const TrophyIcon = base(<><path d="M8 4h8v5a4 4 0 01-8 0z" /><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4" /><path d="M12 13v4M8 21h8M9 17h6" /></>);
export const FlagIcon = base(<><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>);
export const BookIcon = base(<><path d="M12 6c-2-1.5-5-2-8-1.8V18c3-.2 6 .3 8 1.8 2-1.5 5-2 8-1.8V4.2C17 4 14 4.5 12 6z" /><path d="M12 6v13.8" /></>);
export const MedalIcon = base(<><circle cx="12" cy="14" r="5" /><path d="M8.5 10.5L6 3h4l2 5 2-5h4l-2.5 7.5" /></>);
export const TargetIcon = base(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>);
export const CastleIcon = base(<><path d="M6 21h12M7 21l1-8h8l1 8" /><path d="M6 13V5h3v2h2V5h2v2h2V5h3v8z" /></>);
export const ClockIcon = base(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const CalendarIcon = base(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>);
export const PieceIcon = base(<><circle cx="12" cy="6" r="2.5" /><path d="M9 21h6M10 9h4l1 7H9z" /><path d="M7 21h10" /></>);

export const MoonIcon = base(<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />);
export const SunriseIcon = base(<><path d="M4 18h16M7 18a5 5 0 0110 0" /><path d="M12 4v4M9 7l3-3 3 3M4.6 11.6l1.4 1.4M19.4 11.6L18 13" /></>);
export const SunIcon = base(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
export const SunsetIcon = base(<><path d="M4 18h16M7 18a5 5 0 0110 0" /><path d="M12 9V4M9 6l3 3 3-3M4.6 11.6l1.4 1.4M19.4 11.6L18 13" /></>);

export const PlayIcon = base(<><path d="M8 21h8M9 21l1-6M15 21l-1-6" /><path d="M8 9a4 4 0 118 0c0 2-1.5 3.5-2 6h-4c-.5-2.5-2-4-2-6z" /></>);
export const ChartIcon = base(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>);
export const PuzzleIcon = base(<path d="M10 3h4v2.5a1.5 1.5 0 003 0V3h4v7h-2.5a1.5 1.5 0 000 3H21v8h-7v-2.5a1.5 1.5 0 00-3 0V21H3v-8h2.5a1.5 1.5 0 000-3H3V3h7z" />);
export const UsersIcon = base(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14a6.5 6.5 0 013.5 6" /></>);
export const UserIcon = base(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>);
export const CpuIcon = base(<><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></>);

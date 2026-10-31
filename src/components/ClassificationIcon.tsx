import { useTranslation } from 'react-i18next';
import type { Classification } from '../types';
import brilliant from '../assets/classifications/chess-brilliant.svg';
import great from '../assets/classifications/chess-great_find.svg';
import best from '../assets/classifications/chess-best.svg';
import excellent from '../assets/classifications/chess-excellent.svg';
import good from '../assets/classifications/chess-good.svg';
import book from '../assets/classifications/chess-book.svg';
import inaccuracy from '../assets/classifications/chess-inaccuracy.svg';
import mistake from '../assets/classifications/chess-mistake.svg';
import miss from '../assets/classifications/chess-incorrect.svg';
import blunder from '../assets/classifications/chess-blunder.svg';

/** Background colour of each badge (matches the SVGs), for text and square tints. */
export const CLASS_COLOR: Record<Classification, string> = {
  brilliant: 'var(--color-c-brilliant)',
  great: 'var(--color-c-great)',
  best: 'var(--color-c-best)',
  excellent: 'var(--color-c-excellent)',
  good: 'var(--color-c-good)',
  book: 'var(--color-c-book)',
  inaccuracy: 'var(--color-c-inaccuracy)',
  mistake: 'var(--color-c-mistake)',
  miss: 'var(--color-c-miss)',
  blunder: 'var(--color-c-blunder)',
};

const ICONS: Record<Classification, string> = {
  brilliant,
  great,
  best,
  excellent,
  good,
  book,
  inaccuracy,
  mistake,
  miss,
  blunder,
};

/**
 * Round classification badge. Pass `size` in px, or omit it and size the badge with
 * `className` (e.g. a percentage of a board square).
 */
export default function ClassificationIcon({
  c,
  size,
  className = '',
}: {
  c: Classification;
  size?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const label = t(`classification.${c}`);
  return (
    <img
      src={ICONS[c]}
      width={size}
      height={size === undefined ? undefined : (size * 19) / 18}
      alt={label}
      title={label}
      draggable={false}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}

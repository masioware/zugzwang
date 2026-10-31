import { useTranslation } from 'react-i18next';
import type { Outcome } from '../types';

const STYLE: Record<Outcome, string> = {
  win: 'bg-win/15 text-win ring-win/35',
  draw: 'bg-draw/20 text-ink-2 ring-draw/40',
  loss: 'bg-loss/15 text-loss ring-loss/35',
};
const GLYPH: Record<Outcome, string> = { win: '+', draw: '=', loss: '−' };

export default function ResultBadge({ outcome }: { outcome: Outcome }) {
  const { t } = useTranslation();
  return (
    <span
      title={t(`common.${outcome}`)}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-sm leading-none font-bold ring-1 ring-inset ${STYLE[outcome]}`}
    >
      {GLYPH[outcome]}
    </span>
  );
}

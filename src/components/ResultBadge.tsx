import { useTranslation } from 'react-i18next';
import type { Outcome } from '../types';

const STYLE: Record<Outcome, string> = {
  win: 'bg-win',
  draw: 'bg-draw',
  loss: 'bg-loss',
};
const GLYPH: Record<Outcome, string> = { win: '+', draw: '=', loss: '−' };

export default function ResultBadge({ outcome }: { outcome: Outcome }) {
  const { t } = useTranslation();
  return (
    <span
      title={t(`common.${outcome}`)}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-sm leading-none font-bold text-white ${STYLE[outcome]}`}
    >
      {GLYPH[outcome]}
    </span>
  );
}

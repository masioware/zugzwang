import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FORM_DAYS, highlights, type Highlight } from '../../stats/highlights';
import type { StatsData } from './shared';

/** A strip of the few findings worth reading first; each links to the section that explains it. */
export default function Highlights({ games, analyses, base, search }: Pick<StatsData, 'games' | 'analyses'> & { base: string; search: string }) {
  const { t } = useTranslation();
  const items = useMemo(() => highlights(games, analyses), [games, analyses]);
  if (!items.length) return null;

  const tile = (h: Highlight) => {
    switch (h.kind) {
      case 'form': {
        const diff = h.previous === undefined ? undefined : h.score - h.previous;
        return {
          label: t('highlights.form', { count: FORM_DAYS }),
          value: `${h.score.toFixed(0)}%`,
          sub:
            diff === undefined
              ? t('highlights.formGames', { count: h.games })
              : t('highlights.formDiff', { diff: `${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(0)}` }),
          tone: diff === undefined ? '' : diff >= 0 ? 'text-win' : 'text-loss',
          to: `${base}/calendar${search}`,
        };
      }
      case 'phase':
        return { label: t('highlights.phase'), value: t(`phase.${h.phase}`), sub: t('highlights.phaseSub', { accuracy: h.accuracy.toFixed(1) }), tone: '', to: `#phase` };
      case 'opening':
        return {
          label: t('highlights.opening'),
          value: h.name,
          sub: t('highlights.openingSub', { score: h.score.toFixed(0), games: h.games, color: t(`common.${h.color}`).toLowerCase() }),
          tone: 'text-loss',
          to: `${base}/openings${search}`,
        };
      case 'dayPart':
        return { label: t('highlights.dayPart'), value: t(`dayPart.${h.part}`), sub: t('highlights.dayPartSub', { score: h.score.toFixed(0), games: h.games }), tone: '', to: `${base}/calendar${search}` };
    }
  };

  return (
    <section aria-label={t('highlights.title')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((h) => {
        const { label, value, sub, tone, to } = tile(h);
        const body = (
          <>
            <div className="eyebrow">{label}</div>
            <div className="mt-1.5 truncate font-display text-xl font-bold" title={value}>{value}</div>
            <div className={`mt-0.5 text-xs ${tone || 'text-ink-3'}`}>{sub}</div>
          </>
        );
        const cls = 'panel block p-4 transition-colors hover:bg-white/[0.04]';
        return to.startsWith('#') ? (
          <a key={h.kind} href={to} className={cls} onClick={(e) => { e.preventDefault(); document.getElementById('phase')?.scrollIntoView({ behavior: 'smooth' }); }}>{body}</a>
        ) : (
          <Link key={h.kind} to={to} className={cls}>{body}</Link>
        );
      })}
    </section>
  );
}

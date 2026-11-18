import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAnalyses, useGames } from '../lib/hooks';
import { diagnose, type Weakness } from '../training/diagnose';
import { me } from '../stats/aggregate';

export function weaknessLabel(t: (k: string, o?: Record<string, unknown>) => string, w: Weakness): string {
  return w.kind === 'opening' ? t('train.openingLabel', { name: w.key }) : t(`train.${w.kind}.${w.key}`);
}

export default function Train() {
  const { t } = useTranslation();
  const games = useGames();
  const analyses = useAnalyses();
  const [weaknesses, setWeaknesses] = useState<Weakness[]>();

  useEffect(() => {
    if (!games || !analyses) return;
    // Replaying every mistake is CPU work: let the page paint first.
    const id = setTimeout(() => setWeaknesses(diagnose(games.filter((g) => me(g)), analyses)), 0);
    return () => clearTimeout(id);
  }, [games, analyses]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold">{t('train.title')}</h1>
        <p className="text-ink-3">{t('train.subtitle')}</p>
      </header>
      {!weaknesses ? (
        <p className="text-ink-3">{t('train.loading')}</p>
      ) : weaknesses.length === 0 ? (
        <p className="panel p-5 text-ink-2">{t('train.empty')}</p>
      ) : (
        <ol className="space-y-3">
          {weaknesses.map((w, i) => (
            <li key={w.id} className="panel space-y-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display font-semibold">
                  <span className="tabular mr-2 text-ink-3">{i + 1}</span>
                  {weaknessLabel(t, w)}
                </h2>
                <span className="chip tabular">{t('train.rate', { rate: w.rate.toFixed(1) })}</span>
              </div>
              <p className="text-xs text-ink-3">{t('train.count', { count: w.count, loss: Math.round(w.loss) })}</p>
              <div className="flex flex-wrap gap-2">
                {w.examples.slice(0, 3).map((e) => (
                  <Link key={`${e.gameId}:${e.ply}`} to={`/game/${encodeURIComponent(e.gameId)}?ply=${e.ply}`} className="btn-ghost text-xs">
                    {t('train.example', { move: Math.ceil(e.ply / 2) })}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

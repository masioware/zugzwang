import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWeaknesses, weaknessLabel } from '../training/useWeaknesses';

export default function Train() {
  const { t } = useTranslation();
  const weaknesses = useWeaknesses();

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
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/train/${encodeURIComponent(w.id)}`} className="btn-primary h-9 px-4 text-sm">
                  {t('train.practice')}
                </Link>
                {w.examples.slice(0, 3).map((e) => (
                  <Link key={`${e.gameId}:${e.ply}`} to={`/game/${encodeURIComponent(e.gameId)}?ply=${e.ply}`} className="btn-ghost text-xs">
                    {t('train.example', { move: Math.floor(e.ply / 2) + 1 })}
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

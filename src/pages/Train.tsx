import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { CheckIcon, EyeIcon, LockIcon } from '../components/icons';
import { useWeaknesses, weaknessLabel } from '../training/useWeaknesses';
import { useVerification } from '../training/useVerification';
import { buildPath, cleanStreak, DRILL_STREAK, VERIFY_GAMES, type NodeStatus } from '../training/path';

const NODE_STYLE: Record<NodeStatus, string> = {
  done: 'bg-good/15 text-good',
  active: 'bg-accent text-bg shadow-[0_0_14px_var(--color-accent)]',
  verifying: 'bg-accent/15 text-accent',
  locked: 'bg-white/5 text-ink-3',
};

export default function Train() {
  const { t } = useTranslation();
  const weaknesses = useWeaknesses();
  const { progress, measures } = useVerification();
  const attempts = useLiveQuery(() => db.puzzleAttempts.where('mode').equals('train').toArray(), []);

  const path = weaknesses && progress ? buildPath(weaknesses, progress) : undefined;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="page-title">{t('train.title')}</h1>
        <p className="text-ink-3">{t('train.subtitle')}</p>
      </header>
      {!path ? (
        <p className="text-ink-3">{t('train.loading')}</p>
      ) : path.length === 0 ? (
        <p className="panel p-5 text-ink-2">{t('train.empty')}</p>
      ) : (
        <>
          <p className="text-sm text-ink-3">{t('train.pathHint', { count: DRILL_STREAK })}</p>
          <ol className="space-y-3">
            {path.map(({ weakness: w, status }, i) => {
              const record = progress?.find((p) => p.id === w.id);
              const streak = cleanStreak((attempts ?? []).filter((a) => a.weaknessId === w.id && a.startedAt > (record?.resetAt ?? 0)));
              const seen = Math.min(VERIFY_GAMES, measures.get(w.id)?.games ?? 0);
              return (
                <li key={w.id} className={`panel flex gap-4 p-5 ${status === 'locked' ? 'opacity-60' : ''}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${NODE_STYLE[status]}`} title={t(`train.status.${status}`)}>
                    {status === 'done' ? <CheckIcon className="h-5 w-5" /> : status === 'verifying' ? <EyeIcon className="h-5 w-5" /> : status === 'locked' ? <LockIcon className="h-5 w-5" /> : <span className="tabular font-bold">{i + 1}</span>}
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-display font-semibold">{weaknessLabel(t, w)}</h2>
                      <span className="chip tabular">{t('train.rate', { rate: w.rate.toFixed(1) })}</span>
                    </div>
                    <p className="text-xs text-ink-3">
                      {t('train.count', { count: w.count, loss: Math.round(w.loss) })}
                      {status === 'active' && streak > 0 && ` · ${t('train.streak', { streak, target: DRILL_STREAK })}`}
                    </p>
                    {status === 'active' && record?.status === 'redo' && (
                      <p className="text-xs text-loss">{t(record.reason === 'relapse' ? 'train.reasonRelapse' : 'train.reasonUnproven')}</p>
                    )}
                    {status === 'verifying' && (
                      <div className="space-y-1">
                        <p className="text-sm text-ink-2">{t('train.verifying', { count: VERIFY_GAMES })}</p>
                        <p className="tabular text-xs text-ink-3">{t('train.verifyProgress', { seen, total: VERIFY_GAMES })}</p>
                      </div>
                    )}
                    {status === 'done' && record?.masteredAt && (
                      <p className="text-xs text-good">{t('train.masteredNote', { from: record.baseline.rate.toFixed(1), to: (measures.get(w.id)?.rate ?? 0).toFixed(1) })}</p>
                    )}
                    {status === 'locked' ? (
                      <p className="text-xs text-ink-3">{t('train.lockedHint')}</p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/train/${encodeURIComponent(w.id)}`} className={`${status === 'active' ? 'btn-primary' : 'btn-ghost'} h-9 px-4 text-sm`}>
                          {t(status === 'active' ? 'train.practice' : 'train.again')}
                        </Link>
                        {w.examples.slice(0, 3).map((e) => (
                          <Link key={`${e.gameId}:${e.ply}`} to={`/game/${encodeURIComponent(e.gameId)}?ply=${e.ply}`} className="btn-ghost text-xs">
                            {t('train.example', { move: Math.floor(e.ply / 2) + 1 })}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

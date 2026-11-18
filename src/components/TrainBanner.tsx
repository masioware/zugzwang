import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVerification } from '../training/useVerification';
import { statusOf, VERIFY_GAMES } from '../training/path';
import { weaknessLabelOfId } from '../training/useWeaknesses';

/**
 * A reminder of the lesson in progress, from the stored progress only (no diagnosis, so it is cheap on
 * pages that are open all the time): a weakness being checked in new games, or one sent back to drills.
 */
export default function TrainBanner() {
  const { t } = useTranslation();
  const { progress, measures } = useVerification();
  const current = progress?.find((p) => statusOf(p) === 'redo') ?? progress?.find((p) => statusOf(p) === 'verifying');
  if (!current) return null;
  const name = weaknessLabelOfId(t, current.id);
  const redo = statusOf(current) === 'redo';
  return (
    <Link to="/train" className="panel flex flex-wrap items-center gap-x-4 gap-y-1 border-accent/30 px-4 py-3 text-sm transition-colors hover:border-accent/60">
      <span className="font-semibold">
        {redo ? t('train.bannerRedo', { name }) : t('train.bannerVerifying', { name, seen: Math.min(VERIFY_GAMES, measures.get(current.id)?.games ?? 0), total: VERIFY_GAMES })}
      </span>
      <span className="ml-auto text-accent">{t('train.bannerGo')} →</span>
    </Link>
  );
}

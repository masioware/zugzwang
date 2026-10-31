import { useTranslation } from 'react-i18next';
import type { Game, GameAnalysis } from '../types';
import { CLASSIFICATIONS, countClassifications } from '../stats/aggregate';
import ClassificationIcon, { CLASS_COLOR } from './ClassificationIcon';

export default function ReviewSummary({ game, analysis }: { game: Game; analysis: GameAnalysis }) {
  const { t } = useTranslation();
  const white = countClassifications(analysis, 'white');
  const black = countClassifications(analysis, 'black');
  const platformName = t(`platform.${game.source}`);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1 text-sm">
        <span />
        <span className="w-20 truncate text-center text-xs text-ink-3" title={game.white.name}>{game.white.name}</span>
        <span className="w-20 truncate text-center text-xs text-ink-3" title={game.black.name}>{game.black.name}</span>
        <span className="font-semibold">{t('common.accuracy')}</span>
        <span className="tabular rounded-xl bg-[#f2f1ec] py-1.5 text-center font-display text-2xl font-bold text-bg">
          {analysis.accuracy.white.toFixed(1)}
        </span>
        <span className="tabular rounded-xl bg-panel-3 py-1.5 text-center font-display text-2xl font-bold ring-1 ring-line-2">
          {analysis.accuracy.black.toFixed(1)}
        </span>
        {game.platformAccuracy?.white !== undefined && (
          <>
            <span className="text-xs text-ink-3">{platformName}</span>
            <span className="tabular text-center text-xs text-ink-3">{game.platformAccuracy.white?.toFixed(1)}</span>
            <span className="tabular text-center text-xs text-ink-3">{game.platformAccuracy.black?.toFixed(1)}</span>
          </>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-sm">
        {CLASSIFICATIONS.map((c) => (
          <div key={c} className="contents">
            <span className="flex items-center gap-2 py-0.5" style={{ color: CLASS_COLOR[c] }}>
              <ClassificationIcon c={c} size={16} />
              <span className="text-ink-2">{t(`classification.${c}`)}</span>
            </span>
            <span className={`tabular w-20 text-center font-mono font-semibold ${white[c] ? '' : 'text-ink-3/50'}`}>{white[c]}</span>
            <span className={`tabular w-20 text-center font-mono font-semibold ${black[c] ? '' : 'text-ink-3/50'}`}>{black[c]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

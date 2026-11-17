import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';
import { db } from '../../db';
import { drillSummaries, gameSummary, puzzleSummary } from '../../blindfold/stats';
import { useBlindfoldPrefs } from '../../blindfold/prefs';
import { formatSeconds } from '../../puzzles/format';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Everything the player has done blindfolded: puzzles, drills and games. Renders nothing until there is something. */
export default function Overview() {
  const { t } = useTranslation();
  const rating = useBlindfoldPrefs((s) => s.rating);
  const data = useLiveQuery(async () => {
    const [attempts, runs, games] = await Promise.all([
      db.puzzleAttempts.where('mode').equals('blindfold').toArray(),
      db.drillRuns.toArray(),
      db.games.filter((g) => !!g.blindfold).toArray(),
    ]);
    return { puzzles: puzzleSummary(attempts), drills: drillSummaries(runs), games: gameSummary(games) };
  }, []);
  if (!data) return null;
  const { puzzles, drills, games } = data;
  const played = games.win + games.draw + games.loss;
  if (!puzzles.total && !drills.length && !played) return null;

  return (
    <div className="panel space-y-4 p-6">
      <h2 className="text-lg font-semibold">{t('blindfold.overview.title')}</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="eyebrow">{t('blindfold.overview.puzzles')}</dt>
          <dd className="tabular text-xl font-bold">
            {puzzles.solved}/{puzzles.total}
          </dd>
          <dd className="text-ink-3">{t('blindfold.overview.level', { rating })}{puzzles.hardest ? ` · ${t('blindfold.overview.hardest', { rating: puzzles.hardest })}` : ''}</dd>
        </div>
        <div>
          <dt className="eyebrow">{t('blindfold.overview.games')}</dt>
          <dd className="tabular text-xl font-bold">
            {games.win}-{games.draw}-{games.loss}
          </dd>
          <dd className="text-ink-3">{t('blindfold.overview.clean', { count: games.clean })}</dd>
        </div>
        <div>
          <dt className="eyebrow">{t('blindfold.overview.drills')}</dt>
          <dd className="tabular text-xl font-bold">{drills.reduce((n, d) => n + d.rounds, 0)}</dd>
          <dd className="text-ink-3">{t('blindfold.overview.rounds')}</dd>
        </div>
      </dl>
      {!!drills.length && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-ink-3">
            <tr>
              <th className="py-1 font-medium">{t('blindfold.overview.drill')}</th>
              <th className="py-1 text-right font-medium">{t('blindfold.overview.best')}</th>
              <th className="py-1 text-right font-medium">{t('blindfold.overview.recent')}</th>
              <th className="py-1 text-right font-medium">{t('blindfold.overview.speed')}</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {drills.map((d) => (
              <tr key={d.kind} className="border-t border-line">
                <td className="py-1.5">{t(`blindfold.drills.${d.kind}.name`)}</td>
                <td className="py-1.5 text-right">{pct(d.best)}</td>
                <td className="py-1.5 text-right">{pct(d.recent)}</td>
                <td className="py-1.5 text-right">{formatSeconds(d.secondsPerQuestion * 1000)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

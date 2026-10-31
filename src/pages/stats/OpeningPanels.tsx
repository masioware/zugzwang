import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Block, Panel, Toggle } from './layout';
import { Empty, Figure, Loading, type StatsData } from './shared';
import WdlBar from '../../components/charts/WdlBar';
import MasteryChart from '../../components/charts/MasteryChart';
import { BookIcon, MedalIcon, TrophyIcon } from '../../components/icons';
import { bookMastery, openingPerformance } from '../../stats/insights';
import type { Color } from '../../types';

/** "1. e4 e5 2. Nf3" from SAN moves. */
function formatLine(moves: string[]): string {
  return moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${m}` : m)).join(' ');
}

function ColorToggle({ color, setColor }: { color: Color; setColor: (c: Color) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="font-semibold text-ink-3">{t('stats.playingAs')}</span>
      <Toggle value={color} onChange={setColor} options={[['white', t('common.white')], ['black', t('common.black')]]} />
    </div>
  );
}

export function PerformancePanel({ games, analyses, facts }: StatsData) {
  const { t } = useTranslation();
  const [color, setColor] = useState<Color>('white');
  const [family, setFamily] = useState(true);
  const [minGames, setMinGames] = useState(2);
  const rows = useMemo(
    () => (facts ? openingPerformance(games, analyses, facts, color, family).filter((r) => r.games >= minGames) : undefined),
    [games, analyses, facts, color, family, minGames],
  );

  return (
    <Panel id="performance" icon={TrophyIcon} actions={<ColorToggle color={color} setColor={setColor} />}>
      <Block
        title={t('stats.openingPerformance')}
        aside={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 text-ink-2">
              <input type="checkbox" checked={family} onChange={(e) => setFamily(e.target.checked)} />
              {t('stats.groupFamily')}
            </label>
            <label className="flex items-center gap-1.5 text-ink-2">
              {t('stats.minGames')}
              <input className="input w-16 py-0.5" type="number" min={1} value={minGames} onChange={(e) => setMinGames(Math.max(1, Number(e.target.value)))} />
            </label>
          </div>
        }
      >
        {!rows ? (
          <Loading />
        ) : !rows.length ? (
          <Empty>{t('stats.noGames')}</Empty>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-panel text-left text-xs text-ink-3">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-normal">{t('stats.opening')}</th>
                  <th className="py-2 pr-3 font-normal">{t('stats.moves')}</th>
                  <th className="py-2 pr-3 text-right font-normal">{t('common.games')}</th>
                  <th className="w-[34%] py-2 font-normal" />
                  <th className="py-2 pl-3 text-right font-normal">{t('common.accuracy')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b border-line/60 last:border-0">
                    <td className="max-w-48 py-2.5 pr-3 font-semibold">{r.name === 'Unknown' ? t('common.unknown') : r.name}</td>
                    <td className="max-w-44 py-2.5 pr-3 text-xs text-ink-2">{formatLine(r.line)}</td>
                    <td className="tabular py-2.5 pr-3 text-right text-ink-2">{r.games}</td>
                    <td className="py-2.5">
                      <div className="mb-1 flex justify-between text-[11px] font-semibold">
                        {(['win', 'draw', 'loss'] as const).map((k) => (
                          <span key={k} className="tabular flex items-center gap-1">
                            <span className={`h-2 w-2 rounded-sm ${k === 'win' ? 'bg-win' : k === 'draw' ? 'bg-draw' : 'bg-loss'}`} />
                            {((r[k] / r.games) * 100).toFixed(1)}%
                          </span>
                        ))}
                      </div>
                      <WdlBar wdl={r} showLabels={false} />
                    </td>
                    <td className="tabular py-2.5 pl-3 text-right text-ink-2">{r.accuracy?.toFixed(1) ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Block>
    </Panel>
  );
}

export function MasteryPanel({ games, analyses, facts }: StatsData) {
  const { t } = useTranslation();
  const [color, setColor] = useState<Color>('white');
  const d = useMemo(() => {
    if (!facts) return undefined;
    return { mastery: bookMastery(games, facts, color), rows: openingPerformance(games, analyses, facts, color, true).filter((r) => r.leftBook > 0) };
  }, [games, analyses, facts, color]);

  return (
    <Panel id="mastery" icon={MedalIcon} actions={<ColorToggle color={color} setColor={setColor} />}>
      <Block title={t('stats.masteryTitle')} subtitle={t('stats.masteryHint')}>
        {!d ? (
          <Loading />
        ) : !d.mastery.points.length ? (
          <Empty>{t('stats.noMastery')}</Empty>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <Figure icon={<BookIcon className="h-9 w-9 text-ink-3" />} value={d.mastery.average!.toFixed(1)} label={t('stats.avgLeaveMove')} />
              <span className="text-xs text-ink-3">{t('stats.basedOn', { count: d.mastery.points.length, total: d.mastery.considered })}</span>
            </div>
            <MasteryChart points={d.mastery.points} />
          </>
        )}
      </Block>
      {d && d.rows.length > 0 && (
        <Block title={t('stats.masteryByOpening')}>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-panel text-left text-xs text-ink-3">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-normal">{t('stats.opening')}</th>
                  <th className="py-2 pr-3 text-right font-normal">{t('common.games')}</th>
                  <th className="py-2 pr-3 text-right font-normal">{t('stats.youLeftFirst')}</th>
                  <th className="py-2 text-right font-normal">{t('stats.avgLeaveMoveShort')}</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => {
                  const pct = (r.userLeftFirst / r.leftBook) * 100;
                  return (
                    <tr key={r.name} className="border-b border-line/60 last:border-0">
                      <td className="py-2 pr-3 font-semibold">{r.name === 'Unknown' ? t('common.unknown') : r.name}</td>
                      <td className="tabular py-2 pr-3 text-right text-ink-2">{r.games}</td>
                      {/* Leaving the book first less often is better: low = blue, high = red, both with the number. */}
                      <td className={`tabular py-2 pr-3 text-right font-semibold ${pct <= 35 ? 'text-win' : pct >= 65 ? 'text-loss' : 'text-ink-2'}`}>
                        {pct.toFixed(1)}%
                      </td>
                      <td className="tabular py-2 text-right text-ink-2">{r.avgLeaveMove?.toFixed(1) ?? '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Block>
      )}
    </Panel>
  );
}

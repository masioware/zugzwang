import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Block, Panel } from './layout';
import { Empty, Loading, NeedsAnalysis, PieceImg, type StatsData } from './shared';
import { PhaseIcon } from './GamesPanels';
import ClassificationIcon, { CLASS_COLOR } from '../../components/ClassificationIcon';
import QualityOverTime from '../../components/charts/QualityOverTime';
import ValueBars from '../../components/charts/ValueBars';
import StackedResults from '../../components/charts/StackedResults';
import Donut from '../../components/charts/Donut';
import ErrorTable from '../../components/charts/ErrorTable';
import WdlBar from '../../components/charts/WdlBar';
import { CastleIcon, ClockIcon, MedalIcon, PieceIcon } from '../../components/icons';
import { analysed, errorsByClock, scorePct } from '../../stats/aggregate';
import { castlingStats, moveQuality, moveQualityOverTime, pieceStats } from '../../stats/insights';
import type { Phase } from '../../types';

export function QualityPanel({ games, analyses, analysedCount }: StatsData) {
  const { t, i18n } = useTranslation();
  const d = useMemo(
    () => ({ table: moveQuality(games, analyses), overTime: moveQualityOverTime(games, analyses), n: analysed(games, analyses).length }),
    [games, analyses],
  );
  const num = new Intl.NumberFormat(i18n.resolvedLanguage);

  return (
    <Panel id="quality" icon={MedalIcon}>
      <Block title={t('stats.moveQuality')} subtitle={t('stats.analyzedCount', { count: analysedCount, total: games.length })}>
        {!analysedCount ? (
          <NeedsAnalysis />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-3">
              <tr className="border-b border-line">
                <th className="py-2 text-left font-normal" />
                <th className="py-2 text-right font-normal">{t('stats.percentage')}</th>
                <th className="py-2 text-right font-normal">{t('stats.total')}</th>
                <th className="py-2 text-right font-normal">{t('stats.perGame')}</th>
              </tr>
            </thead>
            <tbody>
              {d.table.map((r) => (
                <tr key={r.classification} className="border-b border-line/60 last:border-0">
                  <td className="py-2">
                    <span className="flex items-center gap-2.5 font-semibold" style={{ color: CLASS_COLOR[r.classification] }}>
                      <ClassificationIcon c={r.classification} size={20} />
                      {t(`classification.${r.classification}`)}
                    </span>
                  </td>
                  <td className="tabular py-2 text-right">{r.share.toFixed(1)}%</td>
                  <td className="tabular py-2 text-right text-ink-2">{num.format(r.count)}</td>
                  <td className="tabular py-2 text-right text-ink-2">{(r.count / d.n).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Block>
      <Block title={t('stats.moveQualityOverTime')}>
        {!analysedCount ? <NeedsAnalysis /> : <QualityOverTime data={d.overTime.points} unit={d.overTime.unit} />}
      </Block>
    </Panel>
  );
}

export function PiecesPanel({ games, analyses, facts, analysedCount }: StatsData) {
  const { t } = useTranslation();
  const rows = useMemo(() => (facts ? pieceStats(games, analyses, facts) : undefined), [games, analyses, facts]);
  const tick = (k: string) => <PieceImg piece={k} className="h-6 w-6" />;
  const label = (k: string) => t(`pieces.${k}`);

  return (
    <Panel id="pieces" icon={PieceIcon}>
      <Block title={t('stats.movesByPiece')}>
        {!rows ? (
          <Loading />
        ) : (
          <ValueBars
            rows={rows.map((r) => ({ key: r.piece, value: r.share, note: t('stats.movesCount', { count: r.moves }) }))}
            label={label}
            tick={tick}
            format={(v) => `${v.toFixed(1)}%`}
            domain={[0, 'auto']}
            seriesLabel={t('stats.shareOfMoves')}
          />
        )}
      </Block>
      <Block title={t('stats.accuracyByPiece')}>
        {!analysedCount ? (
          <NeedsAnalysis />
        ) : !rows ? (
          <Loading />
        ) : (
          <ValueBars rows={rows.map((r) => ({ key: r.piece, value: r.accuracy }))} label={label} tick={tick} seriesLabel={t('common.accuracy')} highlightExtremes />
        )}
      </Block>
    </Panel>
  );
}

export function CastlingPanel({ games, analyses, facts }: StatsData) {
  const { t } = useTranslation();
  const d = useMemo(() => (facts ? castlingStats(games, analyses, facts) : undefined), [games, analyses, facts]);
  const phaseLabel = (k: string) => (k === 'none' ? t('stats.noCastle') : t(`phase.${k}`));
  const phaseTick = (k: string) => (k === 'none' ? <CastleIcon className="h-5 w-5 text-ink-3" /> : <PhaseIcon phase={k as Phase} className="h-5 w-5" />);

  return (
    <Panel id="castling" icon={CastleIcon}>
      {!d ? (
        <Block title={t('stats.castledIn')}>
          <Loading />
        </Block>
      ) : (
        <>
          <Block title={t('stats.castledIn')}>
            <Donut
              slices={d.byPhase.map((b) => ({ key: b.key, label: phaseLabel(b.key), value: b.games, icon: phaseTick(b.key) }))}
              unit={(n) => t('games.count', { count: n })}
            />
          </Block>
          <Block title={t('stats.resultsByCastle')}>
            <StackedResults rows={d.byPhase} label={phaseLabel} tick={phaseTick} />
          </Block>
          <Block title={t('stats.shortVsLong')}>
            {d.bySide.every((b) => !b.games) ? (
              <Empty>{t('stats.noCastling')}</Empty>
            ) : (
              <div className="space-y-2">
                {d.bySide.map((b) => (
                  <div key={b.key} className="grid grid-cols-[8rem_1fr_7rem] items-center gap-3 text-sm">
                    <span className="text-ink-2">
                      {t(`stats.castle.${b.key}`)} <span className="text-xs text-ink-3">{b.key === 'short' ? 'O-O' : 'O-O-O'}</span>
                    </span>
                    {b.games ? <WdlBar wdl={b} /> : <span className="text-ink-3">–</span>}
                    <span className="tabular text-right text-xs text-ink-3">
                      {t('games.count', { count: b.games })}
                      {b.games ? ` · ${scorePct(b).toFixed(0)}%` : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Block>
        </>
      )}
    </Panel>
  );
}

export function ClockPanel({ games, analyses, analysedCount }: StatsData) {
  const { t } = useTranslation();
  const buckets = useMemo(() => errorsByClock(games, analyses), [games, analyses]);
  return (
    <Panel id="clock" icon={ClockIcon}>
      <Block title={t('stats.errorsByClock')} subtitle={`${t('stats.per100Title')} · ${t('stats.errorsByClockHint')}`}>
        {!analysedCount ? <NeedsAnalysis /> : buckets.length ? <ErrorTable buckets={buckets} label={(k) => k} /> : <Empty>{t('stats.noClockData')}</Empty>}
      </Block>
    </Panel>
  );
}

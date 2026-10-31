import { useTranslation } from 'react-i18next';
import type { Game, GameAnalysis } from '../../types';
import type { GameFacts } from '../../stats/facts';
import type { WDL } from '../../stats/aggregate';
import { pieceUrl, useSettings } from '../../lib/settings';
import WdlBar from '../../components/charts/WdlBar';

export interface StatsData {
  games: Game[];
  analyses: Map<string, GameAnalysis>;
  /** Undefined while the replay-derived facts are being computed. */
  facts?: Map<string, GameFacts>;
  /** Number of the filtered games that have an engine analysis. */
  analysedCount: number;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-ink-3">{children}</p>;
}

/** Placeholder for blocks that need engine analysis when nothing is analysed yet. */
export function NeedsAnalysis() {
  const { t } = useTranslation();
  return <Empty>{t('stats.needsAnalysis')}</Empty>;
}

export function Loading() {
  const { t } = useTranslation();
  return <div className="h-32 animate-pulse rounded-xl bg-gradient-to-r from-white/[0.02] via-white/[0.05] to-white/[0.02]" aria-label={t('common.loading')} />;
}

/** White piece image from the user's current set, used as an axis/legend icon. */
export function PieceImg({ piece, className = 'h-7 w-7' }: { piece: string; className?: string }) {
  const set = useSettings((s) => s.pieceSet);
  return <img src={pieceUrl(set, `w${piece.toUpperCase()}`)} alt="" className={className} />;
}

/** Labelled W/D/L bars with game counts, one row per entry. */
export function WdlRows({ rows }: { rows: { label: string; wdl: WDL }[] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3 text-sm">
          <span className="text-ink-2">{r.label}</span>
          <WdlBar wdl={r.wdl} />
          <span className="tabular text-right text-xs text-ink-3">{t('games.count', { count: r.wdl.games })}</span>
        </div>
      ))}
    </div>
  );
}

/** "Big number + label" figure used in panel headers. */
export function Figure({ icon, value, label }: { icon?: React.ReactNode; value: string; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <div className="tabular font-display text-4xl leading-none font-bold tracking-tight whitespace-nowrap sm:text-5xl">{value}</div>
        {label && <div className="mt-1 text-xs text-ink-3">{label}</div>}
      </div>
    </div>
  );
}

/** W/D/L share as three signed figures, like "＋51.8%  ＝7.1%  －41.1%". */
export function WdlFigures({ wdl, values }: { wdl?: WDL; values?: Record<'win' | 'draw' | 'loss', string | undefined> }) {
  const { t } = useTranslation();
  const color = { win: 'bg-win/15 text-win ring-win/35', draw: 'bg-draw/20 text-ink-2 ring-draw/40', loss: 'bg-loss/15 text-loss ring-loss/35' };
  const glyph = { win: '+', draw: '=', loss: '−' };
  return (
    <div className="flex flex-wrap justify-end gap-x-6 gap-y-2">
      {(['win', 'draw', 'loss'] as const).map((k) => (
        <div key={k} className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md font-mono text-sm leading-none font-bold ring-1 ring-inset ${color[k]}`}>
              {glyph[k]}
            </span>
            <span className="tabular font-display text-3xl font-bold tracking-tight">
              {values ? (values[k] ?? '–') : wdl && wdl.games ? `${((wdl[k] / wdl.games) * 100).toFixed(1)}%` : '–'}
            </span>
          </div>
          <div className="text-[11px] text-ink-3">
            {values ? t(`stats.when.${k}`) : wdl ? t(`stats.wdlCount.${k}`, { count: wdl[k] }) : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

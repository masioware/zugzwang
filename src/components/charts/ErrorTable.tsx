import { useTranslation } from 'react-i18next';
import type { ErrorBucket } from '../../stats/aggregate';
import { SEVERITY } from './theme';

const KINDS = ['inaccuracy', 'mistake', 'blunder'] as const;

/**
 * Error rates per 100 moves for each bucket, one column per severity with an inline bar.
 * Misses are counted with mistakes to keep three severity levels.
 */
export default function ErrorTable({ buckets, label }: { buckets: ErrorBucket[]; label: (key: string) => string }) {
  const { t } = useTranslation();
  const rate = (b: ErrorBucket, k: (typeof KINDS)[number]) => ((k === 'mistake' ? b.mistake + b.miss : b[k]) / b.moves) * 100;
  const max = Math.max(1, ...buckets.flatMap((b) => KINDS.map((k) => rate(b, k))));

  return (
    <table className="w-full table-fixed text-sm">
      <thead className="text-left text-xs text-ink-3">
        <tr>
          <th className="w-[26%] pb-2 font-normal" />
          {KINDS.map((k) => (
            <th key={k} className="pb-2 pr-3 font-normal">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SEVERITY[k] }} />
                <span className="truncate">{t(`classification.${k}`)}</span>
              </span>
            </th>
          ))}
          <th className="w-[18%] pb-2 text-right font-normal">{t('common.accuracy')}</th>
        </tr>
      </thead>
      <tbody>
        {buckets.map((b) => (
          <tr key={b.key} className="border-t border-line/60">
            <td className="py-2.5 pr-2">
              <div className="text-ink-2">{label(b.key)}</div>
              <div className="text-[11px] text-ink-3">{t('stats.movesCount', { count: b.moves })}</div>
            </td>
            {KINDS.map((k) => {
              const v = rate(b, k);
              return (
                <td key={k} className="py-2.5 pr-3" title={`${t(`classification.${k}`)}: ${v.toFixed(1)} ${t('stats.per100')}`}>
                  <div className="tabular font-semibold">{v.toFixed(1)}</div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: SEVERITY[k] }} />
                  </div>
                </td>
              );
            })}
            <td className="tabular py-2.5 text-right text-base font-bold">{b.accuracy.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

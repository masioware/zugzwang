import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel, Block } from './layout';
import { Empty } from './shared';
import { UserIcon } from '../../components/icons';
import { aggregate, FEATURES, gameFeatures, type FeatureKey, type FeatureValues, type Profile } from '../../style/features';
import { matchStyle, MIN_GAMES, zscore, type Match, type StyleData } from '../../style/match';
import type { Game } from '../../types';

let dataPromise: Promise<StyleData> | null = null;
function loadStyleData(): Promise<StyleData> {
  dataPromise ??= fetch('/data/styles.json').then((r) => r.json() as Promise<StyleData>);
  dataPromise.catch(() => (dataPromise = null));
  return dataPromise;
}

/** Features per game, kept while the page is open: changing a filter only replays the games not seen yet. */
const cache = new Map<string, FeatureValues | null>();
const CHUNK_MS = 12;

/** Profile of the given games, computed in slices so the page stays responsive. */
function useProfile(games: Game[]): { profile: Profile | undefined; done: number } {
  const [state, setState] = useState<{ profile: Profile | undefined; done: number }>({ profile: undefined, done: 0 });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let start = performance.now();
      for (let i = 0; i < games.length; i++) {
        const g = games[i];
        if (!cache.has(g.id)) cache.set(g.id, gameFeatures(g.moves, g.userColor, g.outcome));
        if (performance.now() - start > CHUNK_MS) {
          setState({ profile: undefined, done: i + 1 });
          await new Promise((r) => setTimeout(r));
          if (cancelled) return;
          start = performance.now();
        }
      }
      const records = games.flatMap((g) => cache.get(g.id) ?? []);
      if (!cancelled) setState({ profile: aggregate(records), done: games.length });
    })();
    return () => {
      cancelled = true;
    };
  }, [games]);
  return state;
}

const PERCENT = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
function format(key: FeatureKey, v: number): string {
  return key === 'length' ? String(Math.round(Math.exp(v))) : PERCENT(v);
}

export default function StylePanel({ games }: { games: Game[] }) {
  const { t } = useTranslation();
  const [data, setData] = useState<StyleData | null | undefined>();
  useEffect(() => void loadStyleData().then(setData, () => setData(null)), []);

  const own = useMemo(() => games.filter((g) => g.source !== 'bot' && g.moves.length), [games]);
  const { profile, done } = useProfile(own);
  const matches = useMemo(() => (profile && data ? matchStyle(profile, data) : []), [profile, data]);
  const [picked, setPicked] = useState<string>();
  const shown = matches.find((m) => m.legend.id === picked) ?? matches[0];

  const feature = (k: FeatureKey) => t(`style.feature.${k}`);

  let body: React.ReactNode;
  if (data === null) body = <Empty>{t('style.loadError')}</Empty>;
  else if (!profile || !data) body = <p className="px-5 py-5 text-sm text-ink-3">{t('style.computing', { done, total: own.length })}</p>;
  else if (profile.games < MIN_GAMES || !shown)
    body = <Empty>{t('style.needGames', { count: MIN_GAMES, have: profile.games })}</Empty>;
  else
    body = (
      <>
        <Block title={t('style.closest')} subtitle={t('style.basedOn', { count: profile.games })}>
          <Hero match={shown} />
        </Block>
        <Block title={t('style.ranking')} subtitle={t('style.rankingHint')}>
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {matches.slice(0, 10).map((m, i) => (
              <li key={m.legend.id}>
                <button
                  onClick={() => setPicked(m.legend.id)}
                  aria-pressed={m.legend.id === shown.legend.id}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5 ${m.legend.id === shown.legend.id ? 'bg-accent/10 ring-1 ring-accent/30' : ''}`}
                >
                  <span className="tabular w-5 text-sm text-ink-3">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.legend.name}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${m.similarity}%` }} />
                    </span>
                  </span>
                  <span className="tabular text-sm font-semibold">{m.similarity}%</span>
                </button>
              </li>
            ))}
          </ol>
        </Block>
        <Block title={t('style.compare', { name: shown.legend.name })} subtitle={t('style.compareHint')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-3">
                <tr>
                  <th className="py-1 text-left font-medium" />
                  <th className="py-1 pr-4 text-right font-medium">{t('style.you')}</th>
                  <th className="py-1 pr-4 text-right font-medium">{shown.legend.name.split(' ').at(-1)}</th>
                  <th className="py-1 text-right font-medium">{t('style.legendsAvg')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {FEATURES.filter((k) => profile.values[k] !== undefined).map((k) => {
                  const close = shown.closest.includes(k);
                  const far = shown.furthest.includes(k);
                  return (
                    <tr key={k} className={close ? 'text-win' : far ? 'text-loss' : ''}>
                      <td className="py-1.5 pr-3">{feature(k)}</td>
                      <td className="tabular py-1.5 pr-4 text-right">{format(k, profile.values[k]!)}</td>
                      <td className="tabular py-1.5 pr-4 text-right">{format(k, shown.legend.values[k])}</td>
                      <td className="tabular py-1.5 text-right text-ink-3">{format(k, data.scale[k].mean)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Block>
        <p className="px-5 py-4 text-xs text-ink-3">{t('style.disclaimer')}</p>
      </>
    );

  return (
    <Panel id="style" icon={UserIcon}>
      {body}
    </Panel>
  );

  function Hero({ match }: { match: Match }) {
    const text = (keys: FeatureKey[]) => keys.map(feature).join(', ');
    // Which side of the average the user leans on, to say "more X than most legends".
    const lean = (k: FeatureKey) => (zscore(k, profile!.values[k]!, data!.scale) >= 0 ? 'more' : 'less');
    return (
      <div className="flex flex-wrap items-center gap-5">
        <div className="font-display text-5xl font-bold text-accent">{match.similarity}%</div>
        <div className="min-w-60 flex-1 space-y-1">
          <div className="text-xl font-bold">{match.legend.name}</div>
          <p className="text-sm text-ink-2">{t(`style.legend.${match.legend.id}`, { defaultValue: '' })}</p>
          <p className="text-sm text-ink-2">
            {t('style.alike')} <span className="text-win">{text(match.closest)}</span>
          </p>
          <p className="text-sm text-ink-2">
            {t('style.unlike')}{' '}
            <span className="text-loss">{match.furthest.map((k) => `${feature(k)} (${t(`style.${lean(k)}`)})`).join(', ')}</span>
          </p>
        </div>
      </div>
    );
  }
}

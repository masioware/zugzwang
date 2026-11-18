import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel, Block } from './layout';
import { Empty } from './shared';
import { UserIcon } from '../../components/icons';
import { loadOpeningBook, type OpeningBook } from '../../analysis/openings';
import { buildRepertoire, openingKey, type OpeningKey } from '../../style/repertoire';
import { matchStyle, MIN_GAMES, type Match, type StyleData, type YourStyle } from '../../style/match';
import type { Game } from '../../types';

let dataPromise: Promise<StyleData> | null = null;
function loadStyleData(): Promise<StyleData> {
  dataPromise ??= fetch('/data/styles.json').then((r) => r.json() as Promise<StyleData>);
  dataPromise.catch(() => (dataPromise = null));
  return dataPromise;
}

/** The opening of each game, kept while the page is open: a new filter only replays the new games. */
const openingCache = new Map<string, OpeningKey | null>();
const CHUNK_MS = 12;

/** The player's opening repertoire over the given games, computed in slices so the page stays responsive. */
function useYourStyle(games: Game[]): { style: YourStyle | undefined; done: number } {
  const [state, setState] = useState<{ style: YourStyle | undefined; done: number }>({ style: undefined, done: 0 });
  const [book, setBook] = useState<OpeningBook>();
  useEffect(() => void loadOpeningBook().then(setBook, () => setBook({})), []);

  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    (async () => {
      let start = performance.now();
      for (let i = 0; i < games.length; i++) {
        const g = games[i];
        if (!openingCache.has(g.id)) openingCache.set(g.id, openingKey(g.moves, book));
        if (performance.now() - start > CHUNK_MS) {
          setState({ style: undefined, done: i + 1 });
          await new Promise((r) => setTimeout(r));
          if (cancelled) return;
          start = performance.now();
        }
      }
      const style: YourStyle = { repertoire: buildRepertoire(games.map((g) => ({ color: g.userColor, key: openingCache.get(g.id) ?? null }))) };
      if (!cancelled) setState({ style, done: games.length });
    })();
    return () => {
      cancelled = true;
    };
  }, [games, book]);
  return state;
}

const lastName = (name: string) => name.split(' ').at(-1)!;

export default function StylePanel({ games }: { games: Game[] }) {
  const { t } = useTranslation();
  const [data, setData] = useState<StyleData | null | undefined>();
  useEffect(() => void loadStyleData().then(setData, () => setData(null)), []);

  const own = useMemo(() => games.filter((g) => g.source !== 'bot' && g.moves.length), [games]);
  const { style, done } = useYourStyle(own);
  const matches = useMemo(() => (style && data ? matchStyle(style, data) : []), [style, data]);
  const [picked, setPicked] = useState<string>();
  const shown = matches.find((m) => m.legend.id === picked) ?? matches[0];

  let body: React.ReactNode;
  if (data === null) body = <Empty>{t('style.loadError')}</Empty>;
  else if (!style || !data) body = <p className="px-5 py-5 text-sm text-ink-3">{t('style.computing', { done, total: own.length })}</p>;
  else if (own.length < MIN_GAMES || !shown) body = <Empty>{t('style.needGames', { count: MIN_GAMES, have: own.length })}</Empty>;
  else
    body = (
      <>
        <Block title={t('style.closest')} subtitle={t('style.basedOn', { count: own.length, legends: data.legends.length })}>
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
        <Block title={t('style.repertoire', { name: shown.legend.name })} subtitle={t('style.repertoireHint')}>
          <div className="grid gap-6 md:grid-cols-2">
            {(['white', 'black'] as const).map((color) => (
              <RepertoireTable key={color} color={color} match={shown} you={style} />
            ))}
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
    return (
      <div className="flex flex-wrap items-center gap-5">
        <div className="font-display text-5xl font-bold text-accent">{match.similarity}%</div>
        <div className="min-w-60 flex-1 space-y-1">
          <div className="text-xl font-bold">{match.legend.name}</div>
          <p className="text-xs text-ink-3">
            {(['white', 'black'] as const)
              .filter((c) => match[c] !== undefined)
              .map((c) => (
                <span key={c} className="mr-3">
                  {t(`style.${c}Repertoire`)} <span className="tabular font-semibold text-ink-2">{match[c]}%</span>
                </span>
              ))}
          </p>
          <p className="text-sm text-ink-2">{t(`style.legend.${match.legend.id}`, { defaultValue: '' })}</p>
          {match.shared.length > 0 && (
            <p className="text-sm text-ink-2">
              {t('style.bothPlay')}{' '}
              <span className="text-win">
                {match.shared
                  .map((s) => t('style.sharedItem', { family: s.family, color: t(`style.${s.color}`), you: Math.round(s.you * 100), legend: Math.round(s.legend * 100) }))
                  .join('; ')}
              </span>
            </p>
          )}
        </div>
      </div>
    );
  }
}

/** The openings one colour plays most, the player's share against the legend's. */
function RepertoireTable({ color, match, you }: { color: 'white' | 'black'; match: Match; you: YourStyle }) {
  const { t } = useTranslation();
  const mine = you.repertoire[color]?.family;
  const theirs = match.legend.repertoire[color]?.family;
  if (!mine || !theirs) return null;
  const rows = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])]
    .map((family) => ({ family, you: mine[family] ?? 0, legend: theirs[family] ?? 0 }))
    .sort((a, b) => Math.max(b.you, b.legend) - Math.max(a.you, a.legend))
    .slice(0, 7);
  const name = lastName(match.legend.name);
  return (
    <div>
      <h5 className="mb-2 flex items-baseline justify-between text-sm font-semibold">
        {t(`style.${color}Repertoire`)}
        {match[color] !== undefined && <span className="tabular text-xs font-normal text-ink-3">{match[color]}%</span>}
      </h5>
      <table className="w-full text-sm">
        <thead className="text-xs text-ink-3">
          <tr>
            <th className="py-1 text-left font-medium" />
            <th className="py-1 pr-3 text-right font-medium">{t('style.you')}</th>
            <th className="py-1 text-right font-medium">{name}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.family}>
              <td className="py-1.5 pr-3">{r.family}</td>
              <td className="tabular py-1.5 pr-3 text-right">{r.you ? `${Math.round(r.you * 100)}%` : '–'}</td>
              <td className="tabular py-1.5 text-right text-ink-3">{r.legend ? `${Math.round(r.legend * 100)}%` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

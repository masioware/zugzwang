import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Panel, Block } from './layout';
import { UserIcon } from '../../components/icons';
import RepertoireBars from '../../components/charts/RepertoireBars';
import SimilarityRing from '../../components/style/SimilarityRing';
import { loadOpeningBook, type OpeningBook } from '../../analysis/openings';
import { buildRepertoire, openingKey, type OpeningKey } from '../../style/repertoire';
import { matchStyle, MIN_GAMES, type Match, type StyleData, type YourStyle } from '../../style/match';
import { MIN_REPERTOIRE_GAMES } from '../../style/repertoire';
import type { Game } from '../../types';

let dataPromise: Promise<StyleData> | null = null;
function loadStyleData(): Promise<StyleData> {
  dataPromise ??= fetch('/data/styles.json').then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<StyleData>;
  });
  // A failed load must not stick: the next attempt fetches again.
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
const MOBILE = '(max-width: 767px)';

/** Placeholder shaped like the result while the games are read, with the progress. */
function Skeleton({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation();
  const bar = 'animate-pulse bg-gradient-to-r from-white/[0.02] via-white/[0.06] to-white/[0.02]';
  return (
    <div className="space-y-5 px-5 py-5" role="status" aria-live="polite">
      <div className="flex items-center gap-5">
        <div className={`${bar} h-28 w-28 shrink-0 rounded-full`} />
        <div className="flex-1 space-y-2">
          <div className={`${bar} h-6 w-48 rounded-lg`} />
          <div className={`${bar} h-4 w-full max-w-md rounded-lg`} />
          <div className={`${bar} h-4 w-2/3 rounded-lg`} />
        </div>
      </div>
      <div className={`${bar} h-40 rounded-xl`} />
      <div>
        <div className="mb-1 flex justify-between text-xs text-ink-3">
          <span>{t('style.computing')}</span>
          <span className="tabular">
            {done}/{total}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>
    </div>
  );
}

/** A message with the figure that explains it, for when there is nothing to show yet. */
function Notice({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent ring-1 ring-accent/20 ring-inset">
        <UserIcon className="h-5 w-5" />
      </span>
      <p className="max-w-md text-sm text-ink-2">{title}</p>
      {children}
    </div>
  );
}

export default function StylePanel({ games }: { games: Game[] }) {
  const { t } = useTranslation();
  const [data, setData] = useState<StyleData | null | undefined>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setData(undefined);
    void loadStyleData().then(setData, () => setData(null));
  }, [attempt]);

  const own = useMemo(() => games.filter((g) => g.source !== 'bot' && g.moves.length), [games]);
  const { style, done } = useYourStyle(own);
  const matches = useMemo(() => (style && data ? matchStyle(style, data) : []), [style, data]);
  const [picked, setPicked] = useState<string>();
  const shown = matches.find((m) => m.legend.id === picked) ?? matches[0];
  const detail = useRef<HTMLDivElement>(null);

  /** Choosing a legend changes what is below the list: on a phone, take the reader there. */
  const pick = (id: string) => {
    setPicked(id);
    if (window.matchMedia(MOBILE).matches) detail.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  let body: React.ReactNode;
  if (data === null)
    body = (
      <Notice title={t('style.loadError')}>
        <button className="btn-ghost" onClick={() => setAttempt((n) => n + 1)}>
          {t('style.retry')}
        </button>
      </Notice>
    );
  else if (!style || !data) body = <Skeleton done={done} total={own.length} />;
  else if (own.length < MIN_GAMES)
    body = (
      <Notice title={t('style.needGames', { count: MIN_GAMES, have: own.length })}>
        <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={MIN_GAMES} aria-valuenow={own.length}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${(own.length / MIN_GAMES) * 100}%` }} />
        </div>
      </Notice>
    );
  else if (!shown) body = <Notice title={t('style.noRepertoire', { count: MIN_REPERTOIRE_GAMES })} />;
  else
    body = (
      <>
        <Block title={t('style.closest')} subtitle={t('style.basedOn', { count: own.length, legends: data.legends.length })}>
          <Hero match={shown} />
        </Block>
        <Block title={t('style.ranking')} subtitle={t('style.rankingHint')}>
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {matches.slice(0, 10).map((m, i) => {
              const active = m.legend.id === shown.legend.id;
              return (
                <li key={m.legend.id}>
                  <button
                    onClick={() => pick(m.legend.id)}
                    aria-pressed={active}
                    aria-label={`${i + 1}. ${m.legend.name}, ${m.similarity}%`}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${active ? 'bg-accent/10 ring-1 ring-accent/30' : ''}`}
                  >
                    <span className={`tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${active ? 'bg-accent text-accent-ink' : 'bg-white/5 text-ink-3'}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{m.legend.name}</span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/10">
                        <span className={`block h-full rounded-full transition-[width] duration-500 ${active ? 'bg-accent' : 'bg-white/30 group-hover:bg-white/45'}`} style={{ width: `${m.similarity}%` }} />
                      </span>
                    </span>
                    <span className="tabular text-sm font-semibold">{m.similarity}%</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </Block>
        <div ref={detail} className="scroll-mt-32">
          <Block title={t('style.repertoire', { name: shown.legend.name })} subtitle={t('style.repertoireHint')}>
            <div className="grid gap-8 md:grid-cols-2">
              {(['white', 'black'] as const).map((color) => (
                <RepertoireColour key={color} color={color} match={shown} you={style} />
              ))}
            </div>
          </Block>
        </div>
        <p className="px-5 py-4 text-xs leading-relaxed text-ink-3">{t('style.disclaimer')}</p>
      </>
    );

  return (
    <Panel id="style" icon={UserIcon}>
      {body}
    </Panel>
  );

  function Hero({ match }: { match: Match }) {
    const blurb = t(`style.legend.${match.legend.id}`, { defaultValue: '' });
    return (
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <SimilarityRing value={match.similarity} label={t('style.similarity')} />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="font-display text-2xl leading-tight font-bold">{match.legend.name}</div>
            {blurb && <p className="mt-1 text-sm text-ink-2">{blurb}</p>}
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            {(['white', 'black'] as const)
              .filter((c) => match[c] !== undefined)
              .map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <dt className="text-xs text-ink-3">{t(`style.${c}Repertoire`)}</dt>
                  <dd className="flex items-center gap-2">
                    <span className="h-1 w-14 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${match[c]}%` }} />
                    </span>
                    <span className="tabular text-xs font-semibold text-ink-2">{match[c]}%</span>
                  </dd>
                </div>
              ))}
          </dl>
          {match.shared.length > 0 && (
            <div>
              <div className="eyebrow mb-1.5">{t('style.bothPlay')}</div>
              <ul className="flex flex-wrap gap-1.5">
                {match.shared.map((s) => (
                  <li key={`${s.color}-${s.family}`} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-xs ring-1 ring-line-2 ring-inset" title={t('style.sharedItem', { family: s.family, color: t(`style.${s.color}`), you: Math.round(s.you * 100), legend: Math.round(s.legend * 100) })}>
                    <span className="font-semibold text-ink">{s.family}</span>
                    <span className="text-ink-3"> · {t(`style.${s.color}`)} · </span>
                    <span className="tabular text-ink-2">
                      {Math.round(s.you * 100)}% / {Math.round(s.legend * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }
}

/** One colour's repertoire: the openings either plays most, as bars. */
function RepertoireColour({ color, match, you }: { color: 'white' | 'black'; match: Match; you: YourStyle }) {
  const { t } = useTranslation();
  const mine = you.repertoire[color]?.family;
  const theirs = match.legend.repertoire[color]?.family;
  if (!mine || !theirs) return null;
  const rows = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])]
    .map((family) => ({ family, you: mine[family] ?? 0, legend: theirs[family] ?? 0 }))
    .sort((a, b) => Math.max(b.you, b.legend) - Math.max(a.you, a.legend))
    .slice(0, 7);
  return (
    <div>
      <h5 className="mb-3 flex items-baseline justify-between text-sm font-semibold">
        {t(`style.${color}Repertoire`)}
        {match[color] !== undefined && <span className="tabular text-xs font-normal text-ink-3">{t('style.overlap', { value: match[color] })}</span>}
      </h5>
      <RepertoireBars rows={rows} youLabel={t('style.you')} legendLabel={lastName(match.legend.name)} label={t('style.barsLabel', { name: match.legend.name, color: t(`style.${color}`) })} />
    </div>
  );
}

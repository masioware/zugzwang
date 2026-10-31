import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import PuzzleTabs from '../components/puzzle/PuzzleTabs';
import Section, { Progress } from '../components/puzzle/Section';
import { ThemeSelect, originLabel } from '../components/puzzle/Bits';
import { localThemes } from '../puzzles/source';
import { INITIAL_RATING } from '../puzzles/rating';
import { SET_SIZES, createFromFailed, createFromFilter, startCycle } from '../puzzles/woodpecker';
import { formatSeconds } from '../puzzles/format';
import type { WoodpeckerCycle, WoodpeckerSet } from '../types';

export default function Woodpecker() {
  const { t } = useTranslation();
  const sets = useLiveQuery(() => db.woodpeckerSets.orderBy('createdAt').reverse().toArray(), []);
  const cycles = useLiveQuery(() => db.woodpeckerCycles.toArray(), []);
  const bySet = useMemo(() => {
    const map = new Map<string, WoodpeckerCycle[]>();
    for (const c of cycles ?? []) map.set(c.setId, [...(map.get(c.setId) ?? []), c]);
    for (const list of map.values()) list.sort((a, b) => a.index - b.index);
    return map;
  }, [cycles]);

  return (
    <>
      <PuzzleTabs />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div className="panel space-y-2 p-5 text-sm text-ink-2">
            <h1 className="text-xl font-bold text-ink">{t('woodpecker.title')}</h1>
            <p>{t('woodpecker.intro')}</p>
          </div>
          {sets?.length === 0 && <p className="panel p-6 text-center text-ink-3">{t('woodpecker.noSets')}</p>}
          {sets?.map((s) => <SetCard key={s.id} set={s} cycles={bySet.get(s.id) ?? []} />)}
        </div>
        <CreateSet />
      </div>
    </>
  );
}

function SetCard({ set, cycles }: { set: WoodpeckerSet; cycles: WoodpeckerCycle[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const last = cycles[cycles.length - 1];
  const open = last && !last.finishedAt ? last : undefined;
  const finished = cycles.filter((c) => c.finishedAt);
  const lastDone = finished[finished.length - 1];

  async function play() {
    if (!open) await startCycle(set);
    navigate(`/puzzles/woodpecker/${set.id}/play`);
  }

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <Link to={`/puzzles/woodpecker/${set.id}`} className="font-semibold hover:text-accent">{set.name}</Link>
          <div className="text-xs text-ink-3">
            {originLabel(set, t)} · {t('woodpecker.puzzleCount', { count: set.puzzleIds.length })}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Link className="btn-ghost" to={`/puzzles/woodpecker/${set.id}`}>{t('woodpecker.details')}</Link>
          <button className="btn-primary" onClick={() => void play()}>
            {open ? t('woodpecker.continue', { index: open.index }) : t('woodpecker.startCycle', { index: (last?.index ?? 0) + 1 })}
          </button>
        </div>
      </div>
      {open && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-ink-3">
            <span>{t('woodpecker.cycleN', { index: open.index })}</span>
            <span className="tabular">{open.position}/{open.order.length}</span>
          </div>
          <Progress value={open.position} total={open.order.length} />
        </div>
      )}
      {lastDone && (
        <div className="text-xs text-ink-3">
          {t('woodpecker.lastCycle', {
            index: lastDone.index,
            rate: Math.round((lastDone.solved / lastDone.order.length) * 100),
            time: formatSeconds(lastDone.activeMs),
          })}
        </div>
      )}
    </div>
  );
}

function CreateSet() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lastRated = useLiveQuery(() => db.puzzleAttempts.where('mode').equals('rated').last(), []);
  const rating = lastRated?.ratingAfter ?? INITIAL_RATING.rating;
  const failedCount = useLiveQuery(
    async () => new Set((await db.puzzleAttempts.filter((a) => !a.solved && a.mode !== 'woodpecker').toArray()).map((a) => a.puzzleId)).size,
    [],
  );
  const [themes, setThemes] = useState<string[]>([]);
  useEffect(() => void localThemes().then(setThemes), []);

  const [kind, setKind] = useState<'filter' | 'failed'>('filter');
  const [name, setName] = useState('');
  const [theme, setTheme] = useState('');
  // The method works best with puzzles somewhat below one's level: speed is the point.
  const round = (v: number) => Math.round(v / 50) * 50;
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const [size, setSize] = useState(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lo = min ?? round(rating - 400);
  const hi = max ?? round(rating - 100);

  const defaultName =
    kind === 'failed'
      ? t('woodpecker.fromFailed')
      : `${theme ? t(`puzzleTheme.${theme}`, { defaultValue: theme }) : t('puzzles.anyTheme')} ${lo}–${hi}`;

  async function create() {
    setBusy(true);
    setError('');
    try {
      const label = name.trim() || defaultName;
      const set =
        kind === 'failed'
          ? await createFromFailed(label, size)
          : await createFromFilter(label, { theme: theme || undefined, min: Math.min(lo, hi), max: Math.max(lo, hi) }, size);
      if (!set) return setError(t('woodpecker.noMatch'));
      navigate(`/puzzles/woodpecker/${set.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={t('woodpecker.newSet')}>
      <div className="space-y-4 p-5">
        <div className="flex gap-4 text-sm" role="radiogroup">
          {(['filter', 'failed'] as const).map((k) => (
            <label key={k} className="flex items-center gap-2 text-ink-2">
              <input type="radio" className="accent-accent" checked={kind === k} onChange={() => setKind(k)} />
              {t(k === 'filter' ? 'woodpecker.byFilter' : 'woodpecker.byFailed')}
            </label>
          ))}
        </div>

        {kind === 'filter' ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-ink-3">
              {t('puzzles.theme')}
              <ThemeSelect themes={themes} value={theme} onChange={setTheme} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-ink-3">
                {t('woodpecker.minRating')}
                <input className="input tabular" type="number" step={50} value={lo} onChange={(e) => setMin(Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-3">
                {t('woodpecker.maxRating')}
                <input className="input tabular" type="number" step={50} value={hi} onChange={(e) => setMax(Number(e.target.value))} />
              </label>
            </div>
            <p className="text-xs text-ink-3">{t('woodpecker.ratingHint', { rating })}</p>
          </>
        ) : (
          <p className="text-sm text-ink-2">{t('woodpecker.failedAvailable', { count: failedCount ?? 0 })}</p>
        )}

        <label className="flex flex-col gap-1 text-xs text-ink-3">
          {t('woodpecker.size')}
          <select className="input" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {SET_SIZES.map((n) => (
              <option key={n} value={n}>{t('woodpecker.puzzleCount', { count: n })}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-3">
          {t('woodpecker.name')}
          <input className="input" value={name} placeholder={defaultName} onChange={(e) => setName(e.target.value)} />
        </label>

        {error && <p className="text-sm text-loss">{error}</p>}
        <button className="btn-primary h-10 w-full" onClick={() => void create()} disabled={busy || (kind === 'failed' && !failedCount)}>
          {busy ? t('common.loading') : t('woodpecker.create')}
        </button>
      </div>
    </Section>
  );
}

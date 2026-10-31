import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Chess } from 'chess.js';
import { db } from '../db';
import { replay, type Ply } from '../lib/chess';
import { useAnalysisQueue } from '../engine/queue';
import { useLiveEngine } from '../engine/useLiveEngine';
import { useSettings } from '../lib/settings';
import AppearancePanel from '../components/AppearancePanel';
import ShortcutsDialog from '../components/ShortcutsDialog';
import { ANALYSIS_VERSION, positionScore } from '../analysis/classify';
import Board, { type BoardArrow } from '../components/Board';
import EvalBar from '../components/EvalBar';
import EvalGraph from '../components/EvalGraph';
import EngineLines from '../components/EngineLines';
import MoveList from '../components/MoveList';
import PlayerCard from '../components/PlayerCard';
import ReviewSummary from '../components/ReviewSummary';
import ClassificationIcon, { CLASS_COLOR } from '../components/ClassificationIcon';
import PlatformIcon from '../components/PlatformIcon';
import { ExternalIcon, FirstIcon, FlipIcon, LastIcon, NextIcon, PrevIcon, TimeClassIcon } from '../components/icons';
import { formatScore } from '../analysis/winprob';
import ResultBadge from '../components/ResultBadge';
import type { Classification } from '../types';

interface Variation {
  /** Main-line ply the variation branches from. */
  base: number;
  plies: Ply[];
  /** Plies of the variation on the board (1..plies.length); the rest can be replayed with →. */
  index: number;
}

const BAD: Classification[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];

export default function GameReview() {
  const { t, i18n } = useTranslation();
  const id = decodeURIComponent(useParams().id ?? '');
  const game = useLiveQuery(() => db.games.get(id), [id], null);
  const analysis = useLiveQuery(() => db.analyses.get(id), [id]);
  const analysisLines = useLiveQuery(() => db.analysisLines.get(id), [id]);
  const { active, queue, enqueue } = useAnalysisQueue();
  const depth = useSettings((s) => s.depth);
  const setDepth = useSettings((s) => s.setDepth);

  const plies = useMemo(() => (game ? replay(game.moves) : []), [game]);
  // The main-line ply lives in the URL (?ply=N), so reloading or coming back keeps the position.
  const [params, setParams] = useSearchParams();
  const urlPly = Number(params.get('ply')) || 0;
  // Local state answers at once; the router applies URL changes in a transition, so reading the ply back
  // from the URL would make quick key presses act on a stale position (two → in a row moving only one ply).
  const [rawPly, setRawPly] = useState(urlPly);
  /** Plies written to the URL that it hasn't shown yet; the URL may pass through older ones on the way. */
  const pending = useRef<number[]>([]);
  useEffect(() => {
    const i = pending.current.indexOf(urlPly);
    if (i >= 0) pending.current = pending.current.slice(i + 1);
    // Anything else came from outside (Back, a pasted link) and moves the board.
    else setRawPly(urlPly);
  }, [urlPly]);
  const ply = Math.max(0, Math.min(plies.length, rawPly));
  const setPly = useCallback(
    (p: number) => {
      setRawPly(p);
      pending.current.push(p);
      setParams(p ? { ply: String(p) } : {}, { replace: true });
    },
    [setParams],
  );
  const [variation, setVariation] = useState<Variation | null>(null);
  const [flipped, setFlipped] = useState<boolean | null>(null);
  const [tab, setTab] = useState<'moves' | 'summary'>(() => (urlPly > 0 ? 'moves' : 'summary'));
  const [help, setHelp] = useState(false);
  const [copied, setCopied] = useState<'fen' | 'pgn' | null>(null);
  const isFlipped = flipped ?? game?.userColor === 'black';

  const startFen = plies[0]?.fenBefore ?? new Chess().fen();
  const varPly = variation?.plies[variation.index - 1];
  const lastPly = variation ? (varPly ?? plies[variation.base - 1]) : plies[ply - 1];
  const fen = lastPly?.fenAfter ?? startFen;

  const lines = useLiveEngine(fen, !!game);
  const moveAnalysis = !variation && ply > 0 ? analysis?.moves[ply - 1] : undefined;

  const goTo = useCallback(
    (p: number) => {
      setTab('moves');
      setVariation(null);
      setPly(Math.max(0, Math.min(plies.length, p)));
    },
    [plies.length, setPly],
  );

  const step = useCallback(
    (delta: number) => {
      if (variation) {
        const index = variation.index + delta;
        if (index < 1) goTo(variation.base);
        else if (index <= variation.plies.length) setVariation({ ...variation, index });
        return;
      }
      goTo(ply + delta);
    },
    [variation, ply, goTo],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '?') setHelp((h) => !h);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowUp' || e.key === 'Home') goTo(0);
      else if (e.key === 'ArrowDown' || e.key === 'End') goTo(plies.length);
      else if (e.key === 'f' || e.key === 'F') setFlipped(!isFlipped);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, goTo, plies.length, isFlipped]);

  const playMove = useCallback(
    (from: string, to: string, promotion = 'q'): boolean => {
      const chess = new Chess(fen);
      let m;
      try {
        m = chess.move({ from, to, promotion });
      } catch {
        return false;
      }
      const uci = m.from + m.to + (m.promotion ?? '');
      // Playing the game's own next move just advances along the main line.
      if (!variation && plies[ply]?.uci === uci) {
        setPly(ply + 1);
        return true;
      }
      const newPly: Ply = {
        san: m.san,
        uci,
        fenBefore: fen,
        fenAfter: chess.fen(),
        color: m.color === 'w' ? 'white' : 'black',
        from: m.from,
        to: m.to,
        captured: m.captured,
        piece: m.piece,
      };
      setTab('moves');
      if (!variation) setVariation({ base: ply, plies: [newPly], index: 1 });
      // Replaying the variation's own next move just advances along it; another move replaces what came after.
      else if (variation.plies[variation.index]?.uci === uci) setVariation({ ...variation, index: variation.index + 1 });
      else setVariation({ ...variation, plies: [...variation.plies.slice(0, variation.index), newPly], index: variation.index + 1 });
      return true;
    },
    [fen, variation, plies, ply, setPly],
  );

  if (game === null) return <p className="text-ink-3">{t('common.loading')}</p>;
  if (!game) return <p className="panel p-6 text-center text-ink-2">{t('review.notFound')}</p>;

  const progress = active[game.id];
  const analysing = !!progress;
  const queued = queue.includes(game.id);
  const upToDate = analysis && analysis.version === ANALYSIS_VERSION;

  // Eval for the bar: the live engine once it has something, else the stored analysis.
  const stored = !variation ? analysisLines?.positions[ply] : undefined;
  const barScore = lines[0] ?? (stored ? positionScore(stored, fen) : undefined);

  const arrows: BoardArrow[] = [];
  const bestUci = lines[0]?.pv[0] ?? stored?.[0]?.pv[0];
  // One light-blue arrow: the engine's best move in the position on the board.
  if (bestUci) arrows.push({ from: bestUci.slice(0, 2), to: bestUci.slice(2, 4), color: '#5fb0e0' });

  const nextMistake = analysis?.moves.find(
    (m) => m.ply >= ply && m.color === game.userColor && BAD.includes(m.classification),
  );

  // Clock shown for each player: their remaining time after their last move up to this point.
  const clockFor = (color: 'white' | 'black') => {
    if (!game.clocks) return undefined;
    const p = variation ? variation.base : ply;
    const offset = color === 'white' ? 0 : 1;
    let last = -1;
    for (let i = offset; i < p; i += 2) last = i;
    return last >= 0 ? game.clocks[last] : game.initialTime;
  };
  const toMove = fen.split(' ')[1] === 'w' ? 'white' : 'black';
  const top = isFlipped ? 'white' : 'black';
  const bottom = isFlipped ? 'black' : 'white';

  const summaryTab = tab === 'summary' && analysis && upToDate;
  const copy = (what: 'fen' | 'pgn') => {
    void navigator.clipboard.writeText(what === 'fen' ? fen : game.pgn).then(() => {
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1500);
    });
  };
  const lichessAnalysis = `https://lichess.org/analysis/standard/${fen.replace(/ /g, '_')}?color=${isFlipped ? 'black' : 'white'}`;

  const header = (
    <div className="panel space-y-2 p-4">
      <div className="flex items-center gap-2 text-sm text-ink-2">
        <PlatformIcon source={game.source} />
        {/* Training games against the bot have no time control and no page elsewhere. */}
        {game.source === 'bot' ? (
          <span>{t('play.trainingGame')}</span>
        ) : (
          <>
            <TimeClassIcon timeClass={game.timeClass} />
            <span>{t(`timeClass.${game.timeClass}`)}</span>
          </>
        )}
        <span className="text-ink-3">·</span>
        <span>{new Date(game.endTime).toLocaleDateString(i18n.resolvedLanguage)}</span>
        {game.url && <a
          className="ml-auto inline-flex items-center gap-1 text-xs text-ink-3 hover:text-accent"
          href={game.url}
          target="_blank"
          rel="noreferrer"
          title={t('review.openOn', { platform: t(`platform.${game.source}`) })}
        >
          {t(`platform.${game.source}`)} <ExternalIcon className="h-3.5 w-3.5" />
        </a>}
      </div>
      <div className="flex items-center gap-2">
        <ResultBadge outcome={game.outcome} />
        <span className="font-semibold">{t(`common.${game.outcome}`)}</span>
        <span className="text-sm text-ink-3">· {t(`termination.${game.termination}`)}</span>
      </div>
      <div className="truncate text-sm text-ink-2" title={game.opening.name}>
        {game.opening.eco && <span className="mr-1.5 text-ink-3">{game.opening.eco}</span>}
        {game.opening.name ?? t('common.unknown')}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-line pt-2 text-xs">
        {(['fen', 'pgn'] as const).map((w) => (
          <button key={w} className="btn-ghost px-2 py-1 text-xs" onClick={() => copy(w)}>
            {copied === w ? t('review.copied') : t(w === 'fen' ? 'review.copyFen' : 'review.copyPgn')}
          </button>
        ))}
        <a
          className="btn-ghost ml-auto inline-flex items-center gap-1 px-2 py-1 text-xs"
          href={lichessAnalysis}
          target="_blank"
          rel="noreferrer"
          title={t('review.lichessAnalysisHint')}
        >
          {t('review.lichessAnalysis')} <ExternalIcon className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );

  const banner = variation ? (
    <div className="flex items-center justify-between gap-2">
      <span className="min-w-0 text-sm text-ink-2">
        {t('review.variation')}
        <span className="mt-0.5 block truncate font-semibold text-ink">
          {variation.plies.map((p, i) => (
            <span key={i} className={i < variation.index ? undefined : 'text-ink-3'}>{i ? ' ' : ''}{p.san}</span>
          ))}
        </span>
      </span>
      <button className="btn-ghost shrink-0" onClick={() => goTo(variation.base)}>{t('review.backToGame')}</button>
    </div>
  ) : moveAnalysis ? (
    <div className="flex items-center gap-3">
      <ClassificationIcon c={moveAnalysis.classification} size={30} />
      <div className="min-w-0">
        <div className="font-semibold" style={{ color: CLASS_COLOR[moveAnalysis.classification] }}>
          {t(`classSentence.${moveAnalysis.classification}`, { move: moveAnalysis.san })}
        </div>
        {moveAnalysis.bestSan && moveAnalysis.bestUci !== moveAnalysis.uci && moveAnalysis.classification !== 'book' && (
          <div className="text-sm text-ink-2">{t('review.bestWas', { move: moveAnalysis.bestSan })}</div>
        )}
      </div>
      {barScore && <span className="tabular ml-auto rounded-lg bg-white/[0.06] px-2 py-0.5 font-mono text-sm font-bold">{formatScore(barScore)}</span>}
    </div>
  ) : (
    <div className="text-sm text-ink-3">{ply === 0 ? t('review.startPosition') : plies[ply - 1].san}</div>
  );

  const navButtons: [React.ReactNode, string, () => void][] = [
    [<FirstIcon />, t('review.start'), () => goTo(0)],
    [<PrevIcon />, t('review.prev'), () => step(-1)],
    [<NextIcon />, t('review.next'), () => step(1)],
    [<LastIcon />, t('review.end'), () => goTo(plies.length)],
  ];

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      {/* Board column: sized so board + player rows + controls fit in the viewport. */}
      <section className="mx-auto w-full" style={{ maxWidth: 'max(340px, calc(100vh - 200px))' }}>
        <PlayerCard player={game[top]} color={top} clock={clockFor(top)} active={toMove === top} />
        <div className="flex gap-2">
          <EvalBar score={barScore} flipped={isFlipped} />
          <div className="min-w-0 flex-1 rounded-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.06]">
            <Board
              fen={fen}
              flipped={isFlipped}
              lastMove={lastPly ? { from: lastPly.from, to: lastPly.to } : undefined}
              marker={moveAnalysis ? { square: plies[ply - 1].to, classification: moveAnalysis.classification } : undefined}
              arrows={arrows}
              onMove={(from, to) => playMove(from, to)}
            />
          </div>
        </div>
        <PlayerCard player={game[bottom]} color={bottom} clock={clockFor(bottom)} active={toMove === bottom} />
      </section>

      <aside className="space-y-3 lg:sticky lg:top-[72px]">
        {header}

        {analysis && upToDate ? (
          <div className="panel p-3">
            <div className="mb-2 flex items-center gap-3 text-sm">
              <AccuracyChip label={game.white.name} value={analysis.accuracy.white} color="white" />
              <AccuracyChip label={game.black.name} value={analysis.accuracy.black} color="black" />
              {nextMistake && (
                <button className="btn-ghost ml-auto px-2 text-xs whitespace-nowrap" onClick={() => { setTab('moves'); goTo(nextMistake.ply + 1); }}>
                  <ClassificationIcon c={nextMistake.classification} size={14} /> {t('review.nextMistake')}
                </button>
              )}
            </div>
            <EvalGraph analysis={analysis} current={variation ? variation.base : ply} onSelect={(p) => { setTab('moves'); goTo(p); }} />
          </div>
        ) : (
          <div className="panel space-y-3 p-4">
            <p className="text-sm text-ink-2">{t('review.intro')}</p>
            {analysing ? (
              <div>
                <div className="flex justify-between text-sm">
                  <span>{t('review.analyzing', { done: progress.done, total: progress.total })}</span>
                  <span className="tabular text-ink-3">{Math.round((progress.done / progress.total) * 100)}%</span>
                </div>
                <div className="meter mt-2 h-2">
                  <div style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <button className="btn-primary h-[34px] flex-1" onClick={() => enqueue([game.id], true)} disabled={queued}>
                  {queued ? t('review.queued') : t('review.analyzeGame')}
                </button>
                <DepthSelect depth={depth} setDepth={setDepth} />
              </div>
            )}
          </div>
        )}

        <div className="panel overflow-hidden">
          {analysis && upToDate && (
            <div className="border-b border-line p-2"><div className="segmented flex w-full" role="tablist">
              {(['moves', 'summary'] as const).map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className="segmented-item"
                >
                  {t(k === 'moves' ? 'review.tabMoves' : 'review.tabSummary')}
                </button>
              ))}
            </div></div>
          )}

          {summaryTab ? (
            <div className="p-4">
              <ReviewSummary game={game} analysis={analysis} />
              {analysis.depth < depth && !analysing && (
                <button className="btn-ghost mt-3 w-full text-xs" onClick={() => enqueue([game.id], true)}>
                  {t('review.reanalyze', { depth })}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-line p-3">{banner}</div>
              <div className="border-b border-line p-3">
                <EngineLines fen={fen} lines={lines} onPlay={(uci) => playMove(uci.slice(0, 2), uci.slice(2, 4), uci[4])} />
              </div>
              <MoveList plies={plies} analysis={upToDate ? analysis?.moves : undefined} current={variation ? variation.base : ply} onSelect={goTo} />
            </>
          )}

          {/* Phones: pinned above the tab bar so stepping through moves never needs scrolling. */}
          <div className="flex items-center gap-1.5 border-t border-line bg-panel-2/60 p-2 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:z-20 max-md:bg-bg/90 max-md:backdrop-blur-xl">
            {navButtons.map(([icon, label, fn]) => (
              <button key={label} className="btn-ghost h-10 flex-1 px-0" title={label} aria-label={label} onClick={fn}>
                {icon}
              </button>
            ))}
            <button className="btn-ghost h-10 w-12" title={t('review.flip')} aria-label={t('review.flip')} onClick={() => setFlipped(!isFlipped)}>
              <FlipIcon />
            </button>
            <AppearancePanel />
          </div>
        </div>
        <div className="h-14 md:hidden" aria-hidden />
        <button className="mx-auto hidden text-xs text-ink-3 hover:text-ink-2 md:block" onClick={() => setHelp(true)}>
          {t('review.keyboardHint')}
        </button>
        <ShortcutsDialog
          open={help}
          onClose={() => setHelp(false)}
          shortcuts={[
            ['←', t('review.prev')],
            ['→', t('review.next')],
            ['↑ / Home', t('review.start')],
            ['↓ / End', t('review.end')],
            ['F', t('review.flip')],
            ['?', t('shortcuts.title')],
          ]}
        />
      </aside>
    </div>
  );
}

function AccuracyChip({ label, value, color }: { label: string; value: number; color: 'white' | 'black' }) {
  return (
    <span className="flex min-w-0 items-center gap-2" title={label}>
      <span
        className={`tabular rounded-lg px-2.5 py-0.5 font-display text-lg font-bold ${
          color === 'white' ? 'bg-[#f2f1ec] text-bg' : 'bg-panel-3 text-ink ring-1 ring-line-2'
        }`}
      >
        {value.toFixed(1)}
      </span>
    </span>
  );
}

function DepthSelect({ depth, setDepth }: { depth: number; setDepth: (d: number) => void }) {
  const { t } = useTranslation();
  return (
    <label className="flex flex-col gap-1 text-xs text-ink-3">
      {t('settings.depth')}
      <select className="input" value={depth} onChange={(e) => setDepth(Number(e.target.value))}>
        {[12, 14, 16, 18, 20].map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
    </label>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Chess } from 'chess.js';
import { db } from '../db';
import { replay, uciToSan } from '../lib/chess';
import { useGameFacts, useScopeGames } from '../lib/hooks';
import { pieceUrl, useSettings } from '../lib/settings';
import { identifyOpening, loadOpeningBook, type OpeningBook } from '../analysis/openings';
import Board from '../components/Board';
import MoveList from '../components/MoveList';
import PlayerCard from '../components/PlayerCard';
import { FlipIcon } from '../components/icons';
import { BotEngine, DEFAULT_ELO_RANGE } from '../play/botEngine';
import { usePlayPrefs, type ColorChoice } from '../play/prefs';
import { getRepertoire } from '../play/repertoireStore';
import {
  bookMove,
  movesAt,
  REPERTOIRE_PLIES,
  sourceColor,
  variations,
  type BookMove,
  type Imitate,
  type MoveCount,
  type Repertoire,
  type Variation,
} from '../play/repertoire';
import type { Color, Game } from '../types';
import { loadTheory, theoryMove, theoryMoves } from '../play/theory';
import { gameOver, type Result } from '../play/result';

interface Session {
  userColor: Color;
  imitate: Imitate;
  elo: number;
  /** A specific opening to steer into; undefined picks from the repertoire by frequency. */
  variation?: Variation;
  /** Opening moves from theory (of `variation`, or any line) before the user's games. */
  theory: boolean;
  startedAt: number;
}

/** What the bot's last move was based on, for the side panel. */
type BotSource = BookMove | { source: 'theory' | 'engine' };

const START_FEN = new Chess().fen();

/** Thinking time grows with strength; book moves still wait a little so the bot doesn't feel instant. */
const thinkMs = (elo: number) => Math.round(300 + ((elo - DEFAULT_ELO_RANGE.min) / (DEFAULT_ELO_RANGE.max - DEFAULT_ELO_RANGE.min)) * 700);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Play() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefs = usePlayPrefs();
  const pieceSet = useSettings((s) => s.pieceSet);

  // The user's own games (friends' are theirs) feed the repertoire.
  const games = useScopeGames(undefined);
  const { facts } = useGameFacts(games);
  const ownName = useLiveQuery(async () => (await db.accounts.filter((a) => !a.friend).first())?.username, []);
  const [book, setBook] = useState<OpeningBook | null>(null);
  useEffect(() => void loadOpeningBook().then(setBook), []);

  const [session, setSession] = useState<Session | null>(null);
  const [moves, setMoves] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [botSource, setBotSource] = useState<BotSource | null>(null);
  const [deviation, setDeviation] = useState<{ san: string; usual: MoveCount[]; theory: boolean } | null>(null);
  const [theory, setTheory] = useState<Awaited<ReturnType<typeof loadTheory>> | null>(null);
  useEffect(() => {
    if (session?.theory) void loadTheory().then(setTheory);
  }, [session?.theory]);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const engine = useRef<BotEngine | null>(null);
  useEffect(() => () => engine.current?.terminate(), []);

  // Setup (before a game) or the running game's settings.
  const setupColor: Color = prefs.color === 'black' ? 'black' : 'white';
  const userColor = session?.userColor ?? setupColor;
  const imitate = session?.imitate ?? prefs.imitate;
  const fromColor = sourceColor(userColor, imitate);
  const sourceGames = useMemo(() => games?.filter((g) => g.userColor === fromColor) ?? [], [games, fromColor]);
  // Built only once a game starts, in a worker: the setup doesn't need it, and replaying hundreds of games on
  // the main thread froze the page on every colour switch.
  const [repertoire, setRepertoire] = useState<Repertoire | null>(null);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void getRepertoire(sourceGames).then((r) => !cancelled && setRepertoire(r));
    return () => {
      cancelled = true;
    };
  }, [session, sourceGames]);
  const variationList = useMemo(() => (facts ? variations(sourceGames, facts) : []), [sourceGames, facts]);
  // The bot plays the opponents' moves from the user's games, or the user's own.
  const botSide = imitate === 'opponents' ? 'theirs' : 'mine';

  const plies = useMemo(() => replay(moves), [moves]);
  const fen = plies[plies.length - 1]?.fenAfter ?? START_FEN;
  const turn: Color = fen.split(' ')[1] === 'w' ? 'white' : 'black';
  const userTurn = !!session && !result && turn === session.userColor;
  const opening = useMemo(() => (book ? identifyOpening(plies.map((p) => p.fenAfter), book) : undefined), [book, plies]);

  function apply(san: string) {
    const next = [...moves, san];
    setMoves(next);
    if (session) setResult(gameOver(next, session.userColor));
  }

  // The bot's turn: a move from the user's games when there is one, else the engine at the chosen strength.
  useEffect(() => {
    if (!session || result || turn === session.userColor) return;
    let cancelled = false;
    const started = Date.now();
    void (async () => {
      let san: string | undefined;
      let source: BotSource;
      // Theory first when asked for (it replaces the line from the user's games), then the repertoire.
      const fromTheory = session.theory ? theoryMove(await loadTheory(), fen, session.variation?.name) : undefined;
      const fromBook = fromTheory
        ? undefined
        : bookMove(moves, fen, await getRepertoire(sourceGames), botSide, session.theory ? undefined : session.variation?.line);
      if (fromTheory) {
        san = fromTheory;
        source = { source: 'theory' };
      } else if (fromBook) {
        san = fromBook.san;
        source = fromBook;
      } else {
        engine.current ??= new BotEngine();
        const uci = await engine.current.move(fen, session.elo, thinkMs(session.elo));
        san = uci && uciToSan(fen, uci);
        source = { source: 'engine' };
      }
      await sleep(Math.max(0, 450 + Math.random() * 400 - (Date.now() - started)));
      if (cancelled || !san) return;
      setBotSource(source);
      apply(san);
    })();
    return () => {
      cancelled = true;
    };
    // `apply` and the derived values only change together with `moves`.
  }, [session, moves, result]);

  function onMove(from: string, to: string, piece: string): boolean {
    if (!userTurn || !session) return false;
    // A pawn reaching the last rank asks which piece to become.
    if (piece[1] === 'P' && (to[1] === '8' || to[1] === '1')) {
      const legal = new Chess(fen).moves({ verbose: true }).some((m) => m.from === from && m.to === to);
      if (legal) setPromotion({ from, to });
      return false;
    }
    return play(from, to);
  }

  function play(from: string, to: string, promo?: string): boolean {
    if (!session) return false;
    let san: string;
    try {
      san = new Chess(fen).move({ from, to, promotion: promo }).san;
    } catch {
      return false;
    }
    // Say so when a move leaves theory (when following it), or the lines the user usually plays here.
    const known = session.theory
      ? theory
        ? theoryMoves(theory, fen, session.variation?.name)
        : []
      : session.imitate === 'opponents' && moves.length < REPERTOIRE_PLIES
        ? repertoire
          ? movesAt(repertoire, fen, 'mine')
          : []
        : [];
    setDeviation(known.length && !known.some((m) => m.san === san) ? { san, usual: known, theory: session.theory } : null);
    apply(san);
    return true;
  }

  function start() {
    const color: Color = prefs.color === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : prefs.color;
    setSession({
      userColor: color,
      imitate: prefs.imitate,
      elo: prefs.elo,
      // The list was built for the setup colour; a random colour may not match it, so it plays by frequency.
      variation: prefs.color === 'random' ? undefined : variationList.find((v) => v.name === prefs.variation),
      theory: prefs.theory,
      startedAt: Date.now(),
    });
    setMoves([]);
    setRepertoire(null);
    setResult(null);
    setBotSource(null);
    setDeviation(null);
    setPromotion(null);
    setFlipped(false);
  }

  /** Stores the game (out of the user's lists and stats: no account owns it) and opens it in the review. */
  async function analyse() {
    if (!session || !result) return;
    setSaving(true);
    const id = `bot:${session.startedAt}`;
    const botName = `Bot ${session.elo >= DEFAULT_ELO_RANGE.max ? t('play.max') : session.elo}`;
    const me = ownName ?? t('play.you');
    const chess = new Chess();
    for (const m of moves) chess.move(m);
    const white = session.userColor === 'white' ? me : botName;
    const black = session.userColor === 'white' ? botName : me;
    chess.setHeader('White', white);
    chess.setHeader('Black', black);
    chess.setHeader('Result', result.outcome === 'draw' ? '1/2-1/2' : (result.outcome === 'win') === (session.userColor === 'white') ? '1-0' : '0-1');
    const game: Game = {
      id,
      source: 'bot',
      accountId: 'bot',
      url: '',
      pgn: chess.pgn(),
      moves,
      white: { name: white },
      black: { name: black },
      userColor: session.userColor,
      outcome: result.outcome,
      termination: result.termination,
      timeClass: 'classical',
      timeControl: '-',
      endTime: Date.now(),
      rated: false,
      opening: { eco: opening?.eco, name: opening?.name },
    };
    await db.games.put(game);
    navigate(`/game/${encodeURIComponent(id)}`);
  }

  const isFlipped = flipped !== (userColor === 'black');
  const top: Color = isFlipped ? 'white' : 'black';
  const bottom: Color = isFlipped ? 'black' : 'white';
  const player = (c: Color) =>
    c === userColor
      ? { name: ownName ?? t('play.you') }
      : { name: `Bot ${(session?.elo ?? prefs.elo) >= DEFAULT_ELO_RANGE.max ? t('play.max') : (session?.elo ?? prefs.elo)}` };
  const lastPly = plies[plies.length - 1];
  // The line from the user's games is only followed without theory.
  const line = session?.theory ? undefined : session?.variation?.line;
  const onLine = !!line && moves.every((m, i) => i >= line.length || m === line[i]);

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className="relative mx-auto w-full" style={{ maxWidth: 'max(340px, calc(100vh - 200px))' }}>
        <PlayerCard player={player(top)} color={top} active={!!session && !result && turn === top} />
        <div className="rounded-xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.06]">
          <Board
            fen={fen}
            flipped={isFlipped}
            lastMove={lastPly ? { from: lastPly.from, to: lastPly.to } : undefined}
            arrows={[]}
            onMove={onMove}
            movable={userTurn && !promotion}
          />
        </div>
        <PlayerCard player={player(bottom)} color={bottom} active={!!session && !result && turn === bottom} />

        {promotion && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-bg/70 backdrop-blur-sm">
            <div className="panel space-y-3 p-4 text-center">
              <div className="font-semibold">{t('play.promoteTo')}</div>
              <div className="flex gap-2">
                {(['q', 'r', 'b', 'n'] as const).map((p) => (
                  <button
                    key={p}
                    className="btn-ghost h-16 w-16 p-1"
                    onClick={() => {
                      const { from, to } = promotion;
                      setPromotion(null);
                      play(from, to, p);
                    }}
                  >
                    <img src={pieceUrl(pieceSet, `${userColor === 'white' ? 'w' : 'b'}${p.toUpperCase()}`)} alt={t(`pieces.${p}`)} className="h-full w-full" />
                  </button>
                ))}
              </div>
              <button className="text-xs text-ink-3 hover:text-ink" onClick={() => setPromotion(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        )}
      </section>

      <aside className="space-y-3 lg:sticky lg:top-[72px]">
        {!session ? (
          <Setup variationList={variationList} sourceCount={sourceGames.length} factsReady={!!facts} onStart={start} />
        ) : (
          <>
            <div className="panel space-y-3 p-4">
              <div className="flex items-center gap-3">
                {result ? (
                  <div>
                    <div className="font-display text-2xl font-bold">{t(`play.result.${result.outcome}`)}</div>
                    <div className="text-sm text-ink-3">{t(`termination.${result.termination}`)}</div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${userTurn ? 'bg-accent shadow-[0_0_10px_var(--color-accent)]' : 'animate-pulse bg-ink-3'}`} />
                    <span className="font-semibold">{userTurn ? t('play.yourTurn') : t('play.botThinking')}</span>
                  </div>
                )}
                <button className="btn-ghost ml-auto h-9 w-10 px-0" title={t('review.flip')} aria-label={t('review.flip')} onClick={() => setFlipped(!flipped)}>
                  <FlipIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1 text-sm">
                <div className="text-ink-2">
                  {opening?.name ? (
                    <>
                      {opening.eco && <span className="mr-1.5 font-mono text-xs text-ink-3">{opening.eco}</span>}
                      {opening.name}
                    </>
                  ) : (
                    <span className="text-ink-3">{t('play.noOpeningYet')}</span>
                  )}
                </div>
                {session.theory && (
                  <div className="text-xs text-ink-3">
                    {t('play.theoryOf', { name: session.variation?.name ?? t('play.anyLine') })}
                  </div>
                )}
                {line && (
                  <div className="text-xs">
                    <span className="text-ink-3">{t('play.chosenLine')}: </span>
                    {line.map((m, i) => (
                      <span key={i} className={i < moves.length ? (moves[i] === m ? 'text-good' : 'text-loss line-through') : 'text-ink-3'}>
                        {i % 2 === 0 ? `${i / 2 + 1}.` : ''}
                        {m}{' '}
                      </span>
                    ))}
                    {!onLine && <span className="text-ink-3">· {t('play.leftLine')}</span>}
                  </div>
                )}
                {botSource && (
                  <div className="chip">
                    {botSource.source === 'theory'
                      ? t('play.source.theory')
                      : botSource.source === 'line'
                      ? t('play.source.line')
                      : botSource.source === 'repertoire'
                        ? t(session.imitate === 'opponents' ? 'play.source.opponents' : 'play.source.me', { n: botSource.n, total: botSource.total })
                        : t('play.source.engine', { elo: session.elo >= DEFAULT_ELO_RANGE.max ? t('play.max') : session.elo })}
                  </div>
                )}
              </div>

              {deviation && (
                <div className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-ink-2 ring-1 ring-accent/25 ring-inset">
                  {t(deviation.theory ? 'play.offTheory' : 'play.deviation', {
                    move: deviation.san,
                    usual: deviation.usual
                      .slice(0, 3)
                      .map((m) => (deviation.theory ? m.san : `${m.san} (${m.n}×)`))
                      .join(', '),
                  })}
                </div>
              )}
            </div>

            <div className="panel overflow-hidden">
              <MoveList plies={plies} current={plies.length} onSelect={() => {}} />
              <div className="flex gap-2 border-t border-line p-2">
                {result ? (
                  <>
                    <button className="btn-primary flex-1" disabled={saving} onClick={() => void analyse()}>{t('play.analyse')}</button>
                    <button className="btn-ghost flex-1" onClick={start}>{t('play.again')}</button>
                    <button className="btn-ghost" onClick={() => setSession(null)}>{t('play.newSetup')}</button>
                  </>
                ) : (
                  <button
                    className="btn-ghost flex-1"
                    onClick={() => {
                      if (confirm(t('play.resignConfirm'))) setResult({ outcome: 'loss', termination: 'resignation' });
                    }}
                  >
                    {t('play.resign')}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/** Colour, who the bot imitates, opening and strength. */
function Setup({ variationList, sourceCount, factsReady, onStart }: { variationList: Variation[]; sourceCount: number; factsReady: boolean; onStart: () => void }) {
  const { t } = useTranslation();
  const prefs = usePlayPrefs();
  const colors: [ColorChoice, string][] = [
    ['white', t('common.white')],
    ['black', t('common.black')],
    ['random', t('play.randomColor')],
  ];
  const max = DEFAULT_ELO_RANGE.max;
  // A remembered opening that this colour/imitation has no games of falls back to "random".
  const variation = variationList.some((v) => v.name === prefs.variation) ? prefs.variation : '';
  const sourceColorLabel = t(
    `common.${prefs.color === 'random' ? 'white' : sourceColor(prefs.color === 'black' ? 'black' : 'white', prefs.imitate)}`,
  ).toLowerCase();

  return (
    <div className="panel space-y-5 p-5">
      <div>
        <h1 className="text-2xl font-bold">{t('play.title')}</h1>
        <p className="text-sm text-ink-3">{t('play.subtitle')}</p>
      </div>

      <div className="space-y-1.5">
        <div className="eyebrow">{t('play.yourColor')}</div>
        <div className="segmented flex w-full" role="radiogroup">
          {colors.map(([v, label]) => (
            <button key={v} role="radio" aria-checked={prefs.color === v} className="segmented-item" onClick={() => prefs.set({ color: v })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="eyebrow">{t('play.imitate')}</div>
        <div className="segmented flex w-full" role="radiogroup">
          {(['opponents', 'me'] as const).map((v) => (
            <button key={v} role="radio" aria-checked={prefs.imitate === v} className="segmented-item" onClick={() => prefs.set({ imitate: v })}>
              {t(`play.imitateOptions.${v}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3">
          {/* With theory on, this choice picks where the openings come from and whose side the bot takes after theory. */}
          {t(`play.${prefs.color === 'random' ? 'imitateHintRandom' : prefs.theory ? 'imitateHintTheory' : 'imitateHint'}.${prefs.imitate}`, {
            count: sourceCount,
            color: sourceColorLabel,
          })}
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="eyebrow">{t('play.variation')}</span>
        <select className="input w-full" value={variation} onChange={(e) => prefs.set({ variation: e.target.value })} disabled={prefs.color === 'random'}>
          <option value="">{t('play.randomVariation')}</option>
          {variationList.map((v) => (
            <option key={v.name} value={v.name}>{v.name} ({v.n})</option>
          ))}
        </select>
        <span className="block text-xs text-ink-3">
          {prefs.color === 'random' ? t('play.variationNeedsColor') : !factsReady ? t('common.loading') : !variationList.length ? t('play.noGames') : t('play.variationHint')}
        </span>
      </label>

      <div className="space-y-1.5">
        <div className="eyebrow">{t('play.openingMoves')}</div>
        <div className="segmented flex w-full" role="radiogroup">
          {([false, true] as const).map((v) => (
            <button key={String(v)} role="radio" aria-checked={prefs.theory === v} className="segmented-item" onClick={() => prefs.set({ theory: v })}>
              {t(v ? 'play.fromTheory' : 'play.fromGames')}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3">
          {t(prefs.theory ? (variation ? 'play.theoryHint' : 'play.theoryHintAny') : variation ? 'play.gamesHint' : 'play.gamesHintAny', { name: variation })}
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="flex items-baseline justify-between">
          <span className="eyebrow">{t('play.elo')}</span>
          <span className="tabular font-display text-2xl font-bold">{prefs.elo >= max ? t('play.max') : prefs.elo}</span>
        </span>
        <input
          type="range"
          className="w-full accent-accent"
          min={DEFAULT_ELO_RANGE.min}
          max={max}
          step={10}
          value={prefs.elo}
          onChange={(e) => prefs.set({ elo: Number(e.target.value) })}
        />
        <span className="flex justify-between text-[11px] text-ink-3">
          <span>{DEFAULT_ELO_RANGE.min}</span>
          <span>{t('play.max')}</span>
        </span>
      </label>

      <button className="btn-primary h-11 w-full text-base" onClick={onStart}>{t('play.start')}</button>
    </div>
  );
}

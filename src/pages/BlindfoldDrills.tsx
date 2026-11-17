import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PuzzleTabs from '../components/puzzle/PuzzleTabs';
import Overview from '../components/blindfold/Overview';
import { db } from '../db';
import { DRILL_KINDS, ROUND_SIZE, makeQuestion, nextLevel, type Question, type RoundAnswer } from '../blindfold/drills';
import { useBlindfoldPrefs } from '../blindfold/prefs';
import { canSpeak, langOf, speak, stopSpeaking } from '../blindfold/speech';
import { formatSeconds } from '../puzzles/format';
import type { DrillKind } from '../types';

interface Round {
  kind: DrillKind;
  startedAt: number;
  questions: Question[];
  answers: RoundAnswer[];
  /** Key of the option picked for the current question, shown until the next one. */
  picked?: string;
  shownAt: number;
}

/** The pause after an answer, long enough to see the right one. */
const FEEDBACK_MS = 700;

export default function BlindfoldDrills() {
  const { t } = useTranslation();
  const { boardLevel, setBoardLevel } = useBlindfoldPrefs();
  const [round, setRound] = useState<Round | null>(null);
  const [last, setLast] = useState<{ kind: DrillKind; correct: number; ms: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  function start(kind: DrillKind) {
    clearTimeout(timer.current);
    stopSpeaking();
    setLast(null);
    const questions = Array.from({ length: ROUND_SIZE }, () => makeQuestion(kind, Math.random, boardLevel));
    setRound({ kind, startedAt: Date.now(), questions, answers: [], shownAt: Date.now() });
  }

  function answer(key: string) {
    if (!round || round.picked) return;
    const q = round.questions[round.answers.length];
    const answers = [...round.answers, { correct: key === q.answer, ms: Date.now() - round.shownAt }];
    setRound({ ...round, answers, picked: key });
    timer.current = window.setTimeout(() => {
      if (answers.length < round.questions.length) return setRound({ ...round, answers, picked: undefined, shownAt: Date.now() });
      const correct = answers.filter((a) => a.correct).length;
      const ms = Date.now() - round.startedAt;
      void db.drillRuns.add({ kind: round.kind, startedAt: round.startedAt, durationMs: ms, correct, total: answers.length });
      if (round.kind === 'board') setBoardLevel(nextLevel(boardLevel, correct, answers.length));
      setLast({ kind: round.kind, correct, ms });
      setRound(null);
    }, FEEDBACK_MS);
  }

  if (!round)
    return (
      <>
        <PuzzleTabs />
        <div className="mx-auto max-w-2xl space-y-3">
          <div className="panel space-y-4 p-6">
            <div>
              <h1 className="text-xl font-bold">{t('blindfold.drills.title')}</h1>
              <p className="mt-1 text-sm text-ink-2">{t('blindfold.drills.intro', { count: ROUND_SIZE })}</p>
            </div>
            {last && (
              <p className="rounded-lg bg-panel-2/60 p-3 text-sm">
                <span className="tabular font-bold">{last.correct}/{ROUND_SIZE}</span> · {t(`blindfold.drills.${last.kind}.name`)} · {formatSeconds(last.ms)}
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DRILL_KINDS.map((k) => (
                <button key={k} className="btn-ghost flex h-auto flex-col items-start gap-1 p-4 text-left" onClick={() => start(k)}>
                  <span className="font-semibold text-ink">{t(`blindfold.drills.${k}.name`)}</span>
                  <span className="text-xs text-ink-3">{t(`blindfold.drills.${k}.hint`)}</span>
                  {k === 'board' && <span className="tabular text-xs text-ink-3">{t('blindfold.drills.level', { level: boardLevel + 1 })}</span>}
                </button>
              ))}
            </div>
          </div>
          <Overview />
        </div>
      </>
    );

  const index = round.answers.length - (round.picked ? 1 : 0);
  const q = round.questions[index];
  return (
    <>
      <PuzzleTabs />
      <div className="mx-auto max-w-xl space-y-3">
        <div className="panel space-y-5 p-6">
          <div className="flex items-center justify-between text-sm text-ink-3">
            <span>{t(`blindfold.drills.${round.kind}.name`)}</span>
            <span className="tabular">{index + 1}/{round.questions.length} · {round.answers.filter((a) => a.correct).length} ✓</span>
          </div>
          <QuestionView q={q} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {q.options.map((o) => {
              const state = !round.picked ? '' : o === q.answer ? 'bg-good/20 text-good' : o === round.picked ? 'bg-loss/20 text-loss' : 'opacity-50';
              return (
                <button key={o} className={`btn-ghost h-12 ${state}`} disabled={!!round.picked} onClick={() => answer(o)}>
                  {optionLabel(o, t)}
                </button>
              );
            })}
          </div>
          <button className="text-sm text-ink-3 hover:text-ink" onClick={() => setRound(null)}>{t('blindfold.drills.quit')}</button>
        </div>
      </div>
    </>
  );
}

function optionLabel(key: string, t: (k: string) => string): string {
  if (key === 'light' || key === 'dark' || key === 'yes' || key === 'no') return t(`blindfold.drills.options.${key}`);
  if (key === 'empty') return t('blindfold.drills.options.empty');
  return `${t(`common.${key[0] === 'w' ? 'white' : 'black'}`)} ${t(`pieces.${key[1].toLowerCase()}`).toLowerCase()}`;
}

function QuestionView({ q }: { q: Question }) {
  const { t, i18n } = useTranslation();
  const lang = langOf(i18n.language);
  const [a, b] = q.squares;
  const text = t(`blindfold.drills.${q.kind}.question`, { a, b });
  return (
    <div className="space-y-2 text-center">
      {q.moves && (
        <p className="font-mono text-base leading-relaxed">
          {q.moves.map((m, i) => (
            <span key={i} className="mr-1.5 inline-block">
              {i % 2 === 0 && <span className="text-ink-3">{i / 2 + 1}.</span>}
              {m}
            </span>
          ))}
        </p>
      )}
      <p className="text-xl font-bold">{text}</p>
      {canSpeak() && q.moves && (
        <button className="text-xs text-ink-3 hover:text-ink" onClick={() => speak(q.moves!.join(', '), lang)}>
          {t('blindfold.drills.readAloud')}
        </button>
      )}
    </div>
  );
}

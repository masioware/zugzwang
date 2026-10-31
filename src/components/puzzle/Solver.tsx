import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Board from '../Board';
import AppearancePanel from '../AppearancePanel';
import ClassificationIcon from '../ClassificationIcon';
import { FirstIcon, FlipIcon, LastIcon, NextIcon, PrevIcon } from '../icons';
import { pieceUrl, useSettings } from '../../lib/settings';
import type { Solver } from '../../puzzles/useSolver';

/** The board column of a puzzle page. */
export function SolverBoard({ solver }: { solver: Solver }) {
  return (
    <section className="mx-auto w-full" style={{ maxWidth: 'max(340px, calc(100vh - 190px))' }}>
      <div className="shadow-[0_4px_16px_rgba(0,0,0,0.35)]">
        <Board
          fen={solver.board.fen}
          flipped={solver.flipped}
          lastMove={solver.board.lastMove}
          marker={solver.board.marker}
          arrows={[]}
          highlights={solver.board.highlights}
          onMove={solver.onMove}
        />
      </div>
    </section>
  );
}

/** One status row: icon, headline and a second line; fixed height so the panel doesn't jump between states. */
export function StatusLine({ icon, title, sub, aside }: { icon?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3">
      {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center">{icon}</span>}
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        {sub && <div className="text-sm text-ink-2">{sub}</div>}
      </div>
      {aside && <div className="ml-auto shrink-0">{aside}</div>}
    </div>
  );
}

/** Status while solving; `done` replaces the finished state (each page shows its own result). */
export function SolverStatus({ solver, done, aside }: { solver: Solver; done: React.ReactNode; aside?: React.ReactNode }) {
  const { t } = useTranslation();
  const pieceSet = useSettings((s) => s.pieceSet);
  const king = <img src={pieceUrl(pieceSet, solver.color === 'white' ? 'wK' : 'bK')} alt="" className="h-10 w-10" />;
  if (solver.done) return <>{done}</>;
  if (solver.phase === 'solution')
    return <StatusLine icon={king} title={t('puzzles.solution')} sub={t('puzzles.solutionSub')} aside={aside} />;
  if (solver.feedback === 'wrong')
    return (
      <StatusLine
        icon={<ClassificationIcon c="mistake" size={36} />}
        title={<span className="text-loss">{t('puzzles.wrong')}</span>}
        sub={t('puzzles.tryAgain')}
        aside={aside}
      />
    );
  if (solver.feedback === 'correct')
    return (
      <StatusLine
        icon={<ClassificationIcon c="best" size={36} />}
        title={<span className="text-accent">{t('puzzles.correct')}</span>}
        sub={t('puzzles.keepGoing')}
        aside={aside}
      />
    );
  // Before the setup move nothing can be played yet, so don't say it's the player's turn.
  if (solver.phase !== 'play')
    return <StatusLine icon={king} title={<span className="text-ink-2">{t('puzzles.opponentMove')}</span>} sub={t('puzzles.getReady')} aside={aside} />;
  return (
    <StatusLine icon={king} title={t('puzzles.yourTurn')} sub={t('puzzles.findBest', { color: t(`common.${solver.color}`) })} aside={aside} />
  );
}

/** Review navigation (enabled once the puzzle is over), flip and appearance, with keyboard shortcuts. */
export function SolverNav({ solver }: { solver: Solver }) {
  const { t } = useTranslation();
  const { goTo, shownPly, end, done, flip } = solver;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'ArrowLeft') goTo(shownPly - 1);
      else if (e.key === 'ArrowRight') goTo(shownPly + 1);
      else if (e.key === 'ArrowUp' || e.key === 'Home') goTo(0);
      else if (e.key === 'ArrowDown' || e.key === 'End') goTo(end);
      else if (e.key === 'f') flip();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, shownPly, end, flip]);

  const buttons: [React.ReactNode, string, () => void][] = [
    [<FirstIcon />, t('review.start'), () => goTo(0)],
    [<PrevIcon />, t('review.prev'), () => goTo(shownPly - 1)],
    [<NextIcon />, t('review.next'), () => goTo(shownPly + 1)],
    [<LastIcon />, t('review.end'), () => goTo(end)],
  ];
  return (
    <div className="flex items-center gap-1 rounded-b-lg border-t border-line bg-panel-2/60 p-2">
      {buttons.map(([icon, label, fn]) => (
        <button key={label} className="btn-ghost h-10 flex-1" title={label} aria-label={label} onClick={fn} disabled={!done}>
          {icon}
        </button>
      ))}
      <button className="btn-ghost h-10 w-12" title={t('review.flip')} aria-label={t('review.flip')} onClick={flip}>
        <FlipIcon />
      </button>
      <AppearancePanel placement="down" />
    </div>
  );
}

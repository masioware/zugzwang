import { lazy, Suspense } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Home from './pages/Home';
import Games from './pages/Games';

const GameReview = lazy(() => import('./pages/GameReview'));
const Stats = lazy(() => import('./pages/Stats'));
const Puzzles = lazy(() => import('./pages/Puzzles'));
const PuzzleStats = lazy(() => import('./pages/PuzzleStats'));
const Woodpecker = lazy(() => import('./pages/Woodpecker'));
const WoodpeckerSet = lazy(() => import('./pages/WoodpeckerSet'));
const WoodpeckerPlay = lazy(() => import('./pages/WoodpeckerPlay'));
import QueueIndicator from './components/QueueIndicator';
import LanguageSelect from './components/LanguageSelect';
import EngineSettings from './components/EngineSettings';

export default function App() {
  const { t } = useTranslation();
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-2 py-1.5 text-sm font-semibold whitespace-nowrap sm:px-3 ${isActive ? 'bg-white/10 text-ink' : 'text-ink-2 hover:text-ink'}`;

  return (
    <BrowserRouter>
      <div className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-panel-2/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:gap-x-4 sm:px-4">
            <NavLink to="/" className="flex items-center gap-2 text-lg font-bold">
              <img src="/favicon.svg" alt="" className="h-7 w-7" />
              <span>Zugzwang</span>
            </NavLink>
            {/* Narrow screens: the links get a row of their own below the logo and controls. */}
            <nav className="order-last -mx-1 flex w-full min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] md:order-none md:mx-0 md:w-auto">
              <NavLink to="/games" className={link}>{t('nav.games')}</NavLink>
              <NavLink to="/stats" className={link}>{t('nav.stats')}</NavLink>
              <NavLink to="/puzzles" className={link}>{t('nav.puzzles')}</NavLink>
              <NavLink to="/" end className={link}>{t('nav.accounts')}</NavLink>
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <QueueIndicator />
              <EngineSettings />
              <LanguageSelect />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6">
          <Suspense fallback={<p className="text-ink-3">{t('common.loading')}</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/games" element={<Games />} />
            <Route path="/game/:id" element={<GameReview />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/puzzles" element={<Puzzles />} />
            <Route path="/puzzles/p/:id" element={<Puzzles />} />
            <Route path="/puzzles/stats" element={<PuzzleStats />} />
            <Route path="/puzzles/woodpecker" element={<Woodpecker />} />
            <Route path="/puzzles/woodpecker/:id" element={<WoodpeckerSet />} />
            <Route path="/puzzles/woodpecker/:id/play" element={<WoodpeckerPlay />} />
          </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}

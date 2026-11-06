import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import Logo from './components/Logo';
import { BoardIcon, ChartIcon, PlayIcon, PuzzleIcon, UserIcon, UsersIcon } from './components/icons';
import { useTranslation } from 'react-i18next';
import Home from './pages/Home';
import Games from './pages/Games';

const GameReview = lazy(() => import('./pages/GameReview'));
const Stats = lazy(() => import('./pages/Stats'));
const Friends = lazy(() => import('./pages/Friends'));
const Friend = lazy(() => import('./pages/Friend'));
const HeadToHeadView = lazy(() => import('./pages/Friend').then((m) => ({ default: m.HeadToHeadView })));
const Puzzles = lazy(() => import('./pages/Puzzles'));
const PuzzleStats = lazy(() => import('./pages/PuzzleStats'));
const Play = lazy(() => import('./pages/Play'));
const Sprint = lazy(() => import('./pages/Sprint'));
const Woodpecker = lazy(() => import('./pages/Woodpecker'));
const WoodpeckerSet = lazy(() => import('./pages/WoodpeckerSet'));
const WoodpeckerPlay = lazy(() => import('./pages/WoodpeckerPlay'));
import QueueIndicator from './components/QueueIndicator';
import SyncIndicator from './components/SyncIndicator';
import { InstallButton, PwaToast } from './components/Pwa';
import { autoSync } from './api/sync';
import LanguageSelect from './components/LanguageSelect';
import EngineSettings from './components/EngineSettings';

const NAV = [
  { to: '/games', key: 'games', icon: BoardIcon },
  { to: '/stats', key: 'stats', icon: ChartIcon },
  { to: '/puzzles', key: 'puzzles', icon: PuzzleIcon },
  { to: '/play', key: 'play', icon: PlayIcon },
  { to: '/friends', key: 'friends', icon: UsersIcon },
] as const;

/** "/" sends returning users straight to their games; first-time visitors get the import screen. */
function Landing() {
  const own = useLiveQuery(() => db.accounts.filter((a) => !a.friend).count(), []);
  if (own === undefined) return null;
  return own ? <Navigate to="/games" replace /> : <Home />;
}

export default function App() {
  const { t } = useTranslation();
  useEffect(() => void autoSync(), []);

  return (
    <BrowserRouter>
      <div className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 h-[var(--header-h)] border-b border-line bg-bg/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
          <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-3 sm:px-4">
            <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="font-display text-lg font-bold tracking-tight">Zugzwang</span>
            </NavLink>
            <nav className="ml-4 hidden items-center gap-1 md:flex">
              {NAV.map(({ to, key, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                      isActive ? 'text-ink after:absolute after:inset-x-3 after:-bottom-[11px] after:h-0.5 after:rounded-full after:bg-accent after:shadow-[0_0_10px_var(--color-accent)]' : 'text-ink-3 hover:text-ink'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {t(`nav.${key}`)}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <InstallButton />
              <SyncIndicator />
              <QueueIndicator />
              <EngineSettings />
              <LanguageSelect />
              <NavLink
                to="/accounts"
                title={t('nav.accounts')}
                aria-label={t('nav.accounts')}
                className={({ isActive }) => `btn-ghost hidden h-9 px-2.5 md:inline-flex ${isActive ? 'text-accent' : ''}`}
              >
                <UserIcon className="h-4 w-4" />
                <span className="hidden lg:inline">{t('nav.accounts')}</span>
              </NavLink>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-3 pt-4 pb-28 sm:px-4 sm:pt-6 md:pb-10">
          <Suspense fallback={<p className="text-ink-3">{t('common.loading')}</p>}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/accounts" element={<Home />} />
            <Route path="/games" element={<Games />} />
            <Route path="/game/:id" element={<GameReview />} />
            <Route path="/stats/:section?" element={<Stats />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/friends/:friend" element={<Friend />}>
              <Route index element={<HeadToHeadView />} />
              <Route path="games" element={<Games />} />
              <Route path="stats/:section?" element={<Stats />} />
            </Route>
            <Route path="/play" element={<Play />} />
            <Route path="/puzzles" element={<Puzzles />} />
            <Route path="/puzzles/p/:id" element={<Puzzles />} />
            <Route path="/puzzles/stats" element={<PuzzleStats />} />
            <Route path="/puzzles/sprint" element={<Sprint />} />
            <Route path="/puzzles/woodpecker" element={<Woodpecker />} />
            <Route path="/puzzles/woodpecker/:id" element={<WoodpeckerSet />} />
            <Route path="/puzzles/woodpecker/:id/play" element={<WoodpeckerPlay />} />
          </Routes>
          </Suspense>
        </main>

        <PwaToast />

        {/* Phones: the sections live in a bottom tab bar, within thumb reach. */}
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
          <div className="grid grid-cols-6">
            {[...NAV, { to: '/accounts', key: 'accounts', icon: UserIcon } as const].map(({ to, key, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${isActive ? 'text-accent' : 'text-ink-3'}`
                }
              >
                <Icon className="h-5 w-5" />
                {t(`nav.${key}`)}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </BrowserRouter>
  );
}

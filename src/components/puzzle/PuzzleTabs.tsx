import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Sub-navigation shared by the puzzle pages. */
export default function PuzzleTabs() {
  const { t } = useTranslation();
  const tabs: [string, string, boolean][] = [
    ['/puzzles', t('puzzles.tabs.train'), true],
    ['/puzzles/woodpecker', t('puzzles.tabs.woodpecker'), false],
    ['/puzzles/stats', t('puzzles.tabs.stats'), false],
  ];
  return (
    <nav className="mb-4 flex gap-5 border-b border-line text-sm font-semibold">
      {tabs.map(([to, label, end]) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `-mb-px border-b-2 pb-2 transition-colors ${isActive ? 'border-accent text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

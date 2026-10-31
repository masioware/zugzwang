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
    <nav className="segmented mb-5 flex sm:inline-flex">
      {tabs.map(([to, label, end]) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className="segmented-item"
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

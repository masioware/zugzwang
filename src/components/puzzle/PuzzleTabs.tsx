import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Sub-navigation shared by the puzzle pages. */
export default function PuzzleTabs() {
  const { t } = useTranslation();
  const tabs: [string, string, boolean][] = [
    ['/puzzles', t('puzzles.tabs.train'), true],
    ['/puzzles/mistakes', t('puzzles.tabs.mistakes'), false],
    ['/puzzles/sprint', t('puzzles.tabs.sprint'), false],
    ['/puzzles/woodpecker', t('puzzles.tabs.woodpecker'), false],
    ['/puzzles/blindfold', t('puzzles.tabs.blindfold'), false],
    ['/puzzles/vision', t('puzzles.tabs.vision'), false],
    ['/puzzles/stats', t('puzzles.tabs.stats'), false],
  ];
  return (
    <nav className="segmented mb-5 flex max-w-full overflow-x-auto sm:inline-flex">
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

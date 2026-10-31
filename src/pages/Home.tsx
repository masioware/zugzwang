import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { AccountList, ImportForm, SyncAllButton } from '../components/AccountManager';
import BackupPanel from '../components/BackupPanel';
import { ChartIcon, CpuIcon, PuzzleIcon } from '../components/icons';

/** Accounts page; with no account yet it doubles as the welcome screen. */
export default function Home() {
  const { t } = useTranslation();
  // Friends' accounts are managed on the friends page.
  const accounts = useLiveQuery(() => db.accounts.filter((a) => !a.friend).toArray(), []);
  if (!accounts) return null;
  const first = !accounts.length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {first ? (
        <section className="space-y-5 pt-6 text-center sm:pt-12">
          <span className="chip mx-auto bg-accent/10 text-accent ring-1 ring-accent/25">Stockfish 19 · {t('home.local')}</span>
          <h1 className="font-display text-4xl leading-[1.05] font-bold sm:text-6xl">
            {t('home.title')}
            <span className="text-accent">.</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-ink-2">{t('home.subtitle')}</p>
          <ul className="flex flex-wrap justify-center gap-2 pt-1">
            {([[CpuIcon, 'engine'], [ChartIcon, 'stats'], [PuzzleIcon, 'puzzles']] as const).map(([Icon, k]) => (
              <li key={k} className="chip px-3 py-1.5 text-sm">
                <Icon className="h-4 w-4 text-accent" />
                {t(`home.features.${k}`)}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold">{t('nav.accounts')}</h1>
            <p className="text-sm text-ink-3">{t('home.accountsHint')}</p>
          </div>
          <Link to="/games" className="btn-primary">{t('nav.games')} →</Link>
        </section>
      )}

      <ImportForm />

      {!first && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t('home.accounts')}</h2>
            <SyncAllButton accounts={accounts} />
          </div>
          <AccountList accounts={accounts} />
        </section>
      )}

      <BackupPanel />
    </div>
  );
}

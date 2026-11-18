import { useTranslation } from 'react-i18next';
import { ImportForm } from '../components/AccountManager';
import BackupPanel from '../components/BackupPanel';
import { InstallPanel } from '../components/Pwa';
import { ChartIcon, CpuIcon, PuzzleIcon } from '../components/icons';

/** Welcome screen for a first visit: import an account (or restore a backup) to get started. */
export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
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

      {/* Near the top: on a phone it's how the app gets to the home screen. Hidden once installed. */}
      <InstallPanel />

      <ImportForm />

      <BackupPanel />
    </div>
  );
}

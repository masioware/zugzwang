import { useCallback, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { AccountList, ImportForm, SyncAllButton } from '../components/AccountManager';
import BackupPanel from '../components/BackupPanel';
import { InstallPanel } from '../components/Pwa';
import { AppearancePicker } from '../components/AppearancePanel';
import { EngineControls, LanguageControl } from '../components/SettingsControls';
import { Loading } from '../components/State';
import { groupFriends } from '../stats/headToHead';
import { friendPath } from './Friends';

const SECTIONS = ['accounts', 'friends', 'preferences', 'data'] as const;

/** Everything that is set up once: the accounts to import (yours and your friends'), engine, language, looks and data. */
export default function Settings() {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const mine = useMemo(() => accounts?.filter((a) => !a.friend), [accounts]);
  const friends = useMemo(() => (accounts ? groupFriends(accounts) : undefined), [accounts]);

  // Arriving at /settings#friends scrolls to that section once the page has content to scroll.
  const ready = !!accounts;
  useEffect(() => {
    if (ready && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [ready, hash]);

  const jump = useCallback((id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), []);

  if (!accounts || !mine || !friends) return <Loading />;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="page-title">{t('settings.title')}</h1>
        <p className="text-sm text-ink-3">{t('settings.subtitle')}</p>
      </header>

      <nav className="sticky top-[var(--header-h)] z-10 -mx-3 overflow-x-auto bg-bg/85 px-3 py-2 backdrop-blur-xl [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div className="segmented w-max min-w-full sm:min-w-0">
          {SECTIONS.map((id) => (
            <button key={id} className="segmented-item" onClick={() => jump(id)}>{t(`settings.sections.${id}`)}</button>
          ))}
        </div>
      </nav>

      <Section id="accounts" title={t('settings.sections.accounts')} hint={t('home.accountsHint')} action={<SyncAllButton accounts={mine} />}>
        <ImportForm />
        {mine.length > 0 && <AccountList accounts={mine} />}
      </Section>

      <Section id="friends" title={t('settings.sections.friends')} hint={t('settings.friendsHint')} action={<SyncAllButton accounts={accounts.filter((a) => a.friend)} />}>
        <ImportForm friends={[...friends.keys()]} />
        {[...friends.entries()].map(([name, accs]) => (
          <div key={name} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display font-semibold">{name}</h3>
              <Link to={friendPath(name)} className="text-sm text-accent">{t('settings.viewStats')} →</Link>
            </div>
            <AccountList accounts={accs} />
          </div>
        ))}
      </Section>

      <Section id="preferences" title={t('settings.sections.preferences')}>
        <Group title={t('nav.language')}><LanguageControl /></Group>
        <Group title={t('engine.title')}><EngineControls /></Group>
        <Group title={t('appearance.title')} hint={t('settings.appearanceHint')}><AppearancePicker /></Group>
      </Section>

      <Section id="data" title={t('settings.sections.data')}>
        <BackupPanel />
        <InstallPanel />
      </Section>
    </div>
  );
}

function Section({ id, title, hint, action, children }: { id: string; title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          {hint && <p className="text-sm text-ink-3">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="panel space-y-3 p-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {hint && <p className="text-xs text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

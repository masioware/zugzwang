import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { AccountList, ImportForm, SyncProvider } from '../components/AccountManager';

export default function Home() {
  const { t } = useTranslation();
  // Friends' accounts are managed on the friends page.
  const accounts = useLiveQuery(() => db.accounts.filter((a) => !a.friend).toArray(), []);

  return (
    <SyncProvider>
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">{t('home.title')}</h1>
          <p className="text-ink-2">{t('home.subtitle')}</p>
        </section>

        <ImportForm />

        {!!accounts?.length && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t('home.accounts')}</h2>
            <AccountList accounts={accounts} />
            <Link to="/games" className="btn-primary">{t('nav.games')} →</Link>
          </section>
        )}
      </div>
    </SyncProvider>
  );
}

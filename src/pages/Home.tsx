import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { removeAccount, syncAccount } from '../api/importer';
import PlatformIcon from '../components/PlatformIcon';
import type { Account, Source } from '../types';

const PERIODS = [1, 3, 6, 12, 0];

export default function Home() {
  const { t, i18n } = useTranslation();
  const [source, setSource] = useState<Source>('chesscom');
  const [username, setUsername] = useState('');
  const [months, setMonths] = useState(3);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const counts = useLiveQuery(async () => {
    const map = new Map<string, number>();
    for (const a of await db.accounts.toArray()) map.set(a.id, await db.games.where('accountId').equals(a.id).count());
    return map;
  }, [accounts]);

  async function run(src: Source, name: string, period: number) {
    const id = `${src}:${name.toLowerCase()}`;
    setBusy(id);
    setProgress(0);
    setMessage(null);
    try {
      const n = await syncAccount(src, name.trim(), period, (p) => setProgress(p.imported));
      setMessage({ kind: 'ok', text: t('home.imported', { count: n }) });
      setUsername('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const platform = t(`platform.${src}`);
      setMessage({
        kind: 'error',
        text:
          msg === 'userNotFound' || msg === 'rateLimited'
            ? t(`home.errors.${msg}`, { platform })
            : t('home.errors.generic', { message: msg }),
      });
    } finally {
      setBusy(null);
    }
  }

  async function remove(a: Account) {
    if (confirm(t('home.removeConfirm', { name: a.username }))) await removeAccount(a.id);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{t('home.title')}</h1>
        <p className="text-ink-2">{t('home.subtitle')}</p>
      </section>

      <form
        className="panel space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (username.trim()) void run(source, username.trim(), months);
        }}
      >
        <div className="flex gap-2" role="radiogroup" aria-label={t('home.platform')}>
          {(['chesscom', 'lichess'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={source === s}
              onClick={() => setSource(s)}
              className={`btn flex-1 border ${source === s ? 'border-accent bg-accent/15 text-ink' : 'border-line text-ink-2 hover:text-ink'}`}
            >
              <PlatformIcon source={s} />
              {t(`platform.${s}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink-3">
            {t('home.username')}
            <input
              className="input text-base"
              placeholder={t('home.usernamePlaceholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-3">
            {t('home.period')}
            <select className="input text-base" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {PERIODS.map((m) => (
                <option key={m} value={m}>{m ? t('home.months', { count: m }) : t('home.allTime')}</option>
              ))}
            </select>
          </label>
          <button className="btn-primary h-[38px] px-5" disabled={!username.trim() || !!busy}>
            {busy && busy === `${source}:${username.trim().toLowerCase()}`
              ? t('home.importing', { count: progress })
              : t('home.import')}
          </button>
        </div>
        {message && (
          <p className={`text-sm ${message.kind === 'ok' ? 'text-accent' : 'text-loss'}`} role="status">
            {message.text}
          </p>
        )}
        <p className="text-xs text-ink-3">{t('home.privacy')}</p>
      </form>

      {!!accounts?.length && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('home.accounts')}</h2>
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id} className="panel flex items-center gap-3 px-4 py-3">
                <PlatformIcon source={a.source} />
                <div className="flex-1">
                  <div className="font-semibold">{a.username}</div>
                  <div className="text-xs text-ink-3">
                    {t('home.gamesCount', { count: counts?.get(a.id) ?? 0 })}
                    {a.lastSync &&
                      ` · ${t('home.lastSync', { date: new Date(a.lastSync).toLocaleString(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' }) })}`}
                  </div>
                </div>
                <button className="btn-ghost" disabled={!!busy} onClick={() => void run(a.source, a.username, 0)}>
                  {busy === a.id ? t('home.importing', { count: progress }) : t('home.sync')}
                </button>
                <button className="btn-ghost" disabled={!!busy} onClick={() => void remove(a)}>
                  {t('home.remove')}
                </button>
              </li>
            ))}
          </ul>
          <Link to="/games" className="btn-primary">{t('nav.games')} →</Link>
        </section>
      )}
    </div>
  );
}

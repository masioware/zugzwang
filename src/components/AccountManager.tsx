import { createContext, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { removeAccount, syncAccount } from '../api/importer';
import PlatformIcon from './PlatformIcon';
import type { Account, Source } from '../types';

const PERIODS = [1, 3, 6, 12, 0];

interface SyncState {
  /** Id of the account being imported. */
  busy: string | null;
  progress: number;
  message: { kind: 'ok' | 'error'; text: string } | null;
  run: (source: Source, username: string, months: number, friend?: string) => Promise<boolean>;
}

const SyncContext = createContext<SyncState | null>(null);

/** Shares one import at a time between the form and the account rows below it. */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<SyncState['message']>(null);

  async function run(src: Source, name: string, period: number, friend?: string) {
    setBusy(`${src}:${name.toLowerCase()}`);
    setProgress(0);
    setMessage(null);
    try {
      const n = await syncAccount(src, name.trim(), period, friend, (p) => setProgress(p.imported));
      setMessage({ kind: 'ok', text: t('home.imported', { count: n }) });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const platform = t(`platform.${src}`);
      setMessage({
        kind: 'error',
        text: ['userNotFound', 'rateLimited', 'accountTaken'].includes(msg)
          ? t(`home.errors.${msg}`, { platform })
          : t('home.errors.generic', { message: msg }),
      });
      return false;
    } finally {
      setBusy(null);
    }
  }

  return <SyncContext value={{ busy, progress, message, run }}>{children}</SyncContext>;
}

function useSync(): SyncState {
  return useContext(SyncContext)!;
}

/**
 * Platform, username and period form. With `friends`, it also asks whose account it is:
 * an existing friend's name adds a further account to that friend.
 */
export function ImportForm({ friends }: { friends?: string[] }) {
  const { t } = useTranslation();
  const { busy, progress, message, run } = useSync();
  const [source, setSource] = useState<Source>('chesscom');
  const [username, setUsername] = useState('');
  const [friend, setFriend] = useState('');
  const [months, setMonths] = useState(3);

  return (
    <form
      className="panel space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const name = username.trim();
        if (!name) return;
        const owner = friends ? friend.trim() || name : undefined;
        if (await run(source, name, months, owner)) {
          setUsername('');
          setFriend('');
        }
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
        {friends && (
          <label className="flex flex-1 flex-col gap-1 text-xs text-ink-3">
            {t('friends.name')}
            <input
              className="input text-base"
              placeholder={username.trim() || t('friends.namePlaceholder')}
              value={friend}
              onChange={(e) => setFriend(e.target.value)}
              list="friend-names"
              autoComplete="off"
            />
            <datalist id="friend-names">
              {friends.map((f) => <option key={f} value={f} />)}
            </datalist>
          </label>
        )}
        <label className="flex flex-1 flex-col gap-1 text-xs text-ink-3">
          {t('home.username')}
          <input
            className="input text-base"
            placeholder={friends ? t('friends.usernamePlaceholder') : t('home.usernamePlaceholder')}
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
            : friends
              ? t('friends.add')
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
  );
}

/** Account rows with game count, last sync, and sync / remove buttons. */
export function AccountList({ accounts }: { accounts: Account[] }) {
  const { t, i18n } = useTranslation();
  const { busy, progress, run } = useSync();
  const counts = useLiveQuery(async () => {
    const map = new Map<string, number>();
    for (const a of accounts) map.set(a.id, await db.games.where('accountId').equals(a.id).count());
    return map;
  }, [accounts]);

  async function remove(a: Account) {
    if (confirm(t('home.removeConfirm', { name: a.username }))) await removeAccount(a.id);
  }

  return (
    <ul className="space-y-2">
      {accounts.map((a) => (
        <li key={a.id} className="panel flex items-center gap-3 px-4 py-3">
          <PlatformIcon source={a.source} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{a.username}</div>
            <div className="text-xs text-ink-3">
              {t('home.gamesCount', { count: counts?.get(a.id) ?? 0 })}
              {a.lastSync &&
                ` · ${t('home.lastSync', { date: new Date(a.lastSync).toLocaleString(i18n.resolvedLanguage, { dateStyle: 'medium', timeStyle: 'short' }) })}`}
            </div>
          </div>
          <button className="btn-ghost" disabled={!!busy} onClick={() => void run(a.source, a.username, 0, a.friend)}>
            {busy === a.id ? t('home.importing', { count: progress }) : t('home.sync')}
          </button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => void remove(a)}>
            {t('home.remove')}
          </button>
        </li>
      ))}
    </ul>
  );
}

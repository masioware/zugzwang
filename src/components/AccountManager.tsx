import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { removeAccount } from '../api/importer';
import { useSync } from '../api/sync';
import PlatformIcon from './PlatformIcon';
import type { Account, Source } from '../types';

const PERIODS = [1, 3, 6, 12, 0];

/**
 * Platform, username and period form. With `friends`, it also asks whose account it is:
 * an existing friend's name adds a further account to that friend.
 */
export function ImportForm({ friends }: { friends?: string[] }) {
  const { t } = useTranslation();
  const { busy, progress, message, run, cancel, clearMessage } = useSync();
  // The sync state is app-wide; don't carry a result over to the next page that shows the form.
  useEffect(() => clearMessage, [clearMessage]);
  const [source, setSource] = useState<Source>('chesscom');
  const [username, setUsername] = useState('');
  const [friend, setFriend] = useState('');
  const [months, setMonths] = useState(3);

  return (
    <form
      className="panel space-y-4 p-5 sm:p-6"
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
      <div className="segmented flex w-full" role="radiogroup" aria-label={t('home.platform')}>
        {(['chesscom', 'lichess'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={source === s}
            onClick={() => setSource(s)}
            className="segmented-item py-2"
          >
            <PlatformIcon source={s} />
            {t(`platform.${s}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {friends && (
          <label className="flex min-w-48 flex-1 flex-col gap-1.5">
            <span className="eyebrow">{t('friends.name')}</span>
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
        <label className="flex min-w-48 flex-1 flex-col gap-1.5">
          <span className="eyebrow">{t('home.username')}</span>
          <input
            className="input text-base"
            placeholder={friends ? t('friends.usernamePlaceholder') : t('home.usernamePlaceholder')}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">{t('home.period')}</span>
          <select className="input text-base" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {PERIODS.map((m) => (
              <option key={m} value={m}>{m ? t('home.months', { count: m }) : t('home.allTime')}</option>
            ))}
          </select>
        </label>
        <button className="btn-primary h-[38px] px-5 max-sm:w-full" disabled={!username.trim() || !!busy}>
          {busy && busy === `${source}:${username.trim().toLowerCase()}`
            ? t('home.importing', { count: progress })
            : friends
              ? t('friends.add')
              : t('home.import')}
        </button>
        {busy && busy === `${source}:${username.trim().toLowerCase()}` && (
          <button type="button" className="btn-ghost h-[38px]" onClick={cancel}>{t('common.cancel')}</button>
        )}
      </div>
      {message && (
        <p className={`text-sm ${message.kind === 'ok' ? 'text-good' : 'text-loss'}`} role="status">
          {message.text}
        </p>
      )}
      <p className="text-xs text-ink-3">{t('home.privacy')}</p>
    </form>
  );
}

/** Syncs every given account in turn. */
export function SyncAllButton({ accounts }: { accounts: Account[] }) {
  const { t } = useTranslation();
  const { busy, syncAll } = useSync();
  return (
    <button className="btn-ghost text-xs" disabled={!!busy || !accounts.length} onClick={() => void syncAll(accounts)}>
      {t('home.syncAll')}
    </button>
  );
}

/** Account rows with game count, last sync, and sync / remove buttons. */
export function AccountList({ accounts }: { accounts: Account[] }) {
  const { t, i18n } = useTranslation();
  const { busy, progress, run, cancel } = useSync();
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
        <li key={a.id} className="panel flex flex-wrap items-center gap-3 px-4 py-3">
          <PlatformIcon source={a.source} />
          {/* Wide enough for the name; in a narrow column the buttons wrap below. */}
          <div className="min-w-40 flex-1">
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
          {busy === a.id ? (
            <button className="btn-ghost" onClick={cancel}>{t('common.cancel')}</button>
          ) : (
            <button className="btn-ghost" disabled={!!busy} onClick={() => void remove(a)}>
              {t('home.remove')}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

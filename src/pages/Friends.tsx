import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useAnalyses, useScopeGames } from '../lib/hooks';
import { ImportForm, SyncProvider } from '../components/AccountManager';
import PlatformIcon from '../components/PlatformIcon';
import WdlBar from '../components/charts/WdlBar';
import { scorePct } from '../stats/aggregate';
import { gamesAgainst, groupFriends, headToHead } from '../stats/headToHead';

export function friendPath(name: string) {
  return `/friends/${encodeURIComponent(name)}`;
}

export default function Friends() {
  const { t, i18n } = useTranslation();
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const myGames = useScopeGames(undefined);
  const analyses = useAnalyses();
  const friends = useMemo(() => (accounts ? groupFriends(accounts) : undefined), [accounts]);

  const rows = useMemo(() => {
    if (!friends || !myGames || !analyses) return undefined;
    return [...friends.entries()].map(([name, accs]) => ({ name, accounts: accs, h2h: headToHead(gamesAgainst(myGames, accs), analyses) }));
  }, [friends, myGames, analyses]);
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: 'medium' });

  return (
    <SyncProvider>
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">{t('friends.title')}</h1>
          <p className="text-ink-2">{t('friends.subtitle')}</p>
        </section>

        <ImportForm friends={friends ? [...friends.keys()] : []} />

        {!rows ? (
          <p className="text-ink-3">{t('common.loading')}</p>
        ) : (
          !!rows.length && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{t('friends.yourFriends')}</h2>
              <ul className="space-y-2">
                {rows.map(({ name, accounts: accs, h2h }) => (
                  <li key={name}>
                    <Link to={friendPath(name)} className="panel flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-white/[0.04]">
                      <div className="min-w-40 flex-1">
                        <div className="font-semibold">{name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                          {accs.map((a) => (
                            <span key={a.id} className="inline-flex items-center gap-1">
                              <PlatformIcon source={a.source} className="h-4 w-4 text-[8px]" />
                              {a.username}
                            </span>
                          ))}
                        </div>
                      </div>
                      {h2h.wdl.games ? (
                        <div className="w-full space-y-1 sm:w-64">
                          <div className="flex justify-between text-xs text-ink-3">
                            <span>
                              {t('friends.versus', { count: h2h.wdl.games })} · <span className="tabular font-semibold text-ink">{scorePct(h2h.wdl).toFixed(0)}%</span>
                            </span>
                            {h2h.lastPlayed && <span>{date.format(h2h.lastPlayed)}</span>}
                          </div>
                          <WdlBar wdl={h2h.wdl} />
                        </div>
                      ) : (
                        <span className="text-xs text-ink-3">{t('friends.noGamesTogether')}</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        )}
      </div>
    </SyncProvider>
  );
}

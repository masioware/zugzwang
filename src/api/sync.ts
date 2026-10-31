import { create } from 'zustand';
import i18n from '../i18n';
import { db } from '../db';
import { syncAccount } from './importer';
import type { Account, Source } from '../types';

/** On startup, accounts whose last sync is older than this are synced in the background. */
const AUTO_SYNC_AFTER = 60 * 60 * 1000;

interface SyncState {
  /** Id of the account being imported, and its display name. */
  busy: string | null;
  busyName: string | null;
  progress: number;
  message: { kind: 'ok' | 'error'; text: string } | null;
  /** Imports one account; false when it failed, was cancelled or another import is running. */
  run: (source: Source, username: string, months: number, friend?: string) => Promise<boolean>;
  /** Syncs the accounts one after another; `silent` leaves no message behind. */
  syncAll: (accounts: Account[], silent?: boolean) => Promise<void>;
  /** Stops the running import (and the rest of a sync-all); nothing the import fetched is kept. */
  cancel: () => void;
  clearMessage: () => void;
}

let controller: AbortController | null = null;

/** One import at a time, shared by the forms, the account rows and the header. */
export const useSync = create<SyncState>((set, get) => {
  /** Imports one account; returns the number of new games, or throws. */
  async function importOne(source: Source, username: string, months: number, friend: string | undefined, signal: AbortSignal) {
    set({ busy: `${source}:${username.toLowerCase()}`, busyName: username, progress: 0 });
    return syncAccount(source, username, months, friend, (p) => set({ progress: p.imported }), signal);
  }

  function start(): AbortSignal | null {
    if (get().busy) return null;
    controller = new AbortController();
    set({ message: null });
    return controller.signal;
  }

  function finish() {
    controller = null;
    set({ busy: null, busyName: null });
  }

  return {
    busy: null,
    busyName: null,
    progress: 0,
    message: null,

    run: async (source, username, months, friend) => {
      const signal = start();
      if (!signal) return false;
      try {
        const n = await importOne(source, username.trim(), months, friend, signal);
        set({ message: { kind: 'ok', text: i18n.t('home.imported', { count: n }) } });
        return true;
      } catch (e) {
        set({ message: signal.aborted ? { kind: 'ok', text: i18n.t('home.cancelled') } : { kind: 'error', text: errorText(e, source) } });
        return false;
      } finally {
        finish();
      }
    },

    syncAll: async (accounts, silent = false) => {
      const signal = start();
      if (!signal) return;
      let total = 0;
      const failed: string[] = [];
      try {
        for (const a of accounts) {
          try {
            total += await importOne(a.source, a.username, 0, a.friend, signal);
          } catch {
            if (signal.aborted) {
              if (!silent) set({ message: { kind: 'ok', text: i18n.t('home.cancelled') } });
              return;
            }
            failed.push(a.username);
          }
        }
        if (failed.length) set({ message: { kind: 'error', text: i18n.t('home.syncFailed', { names: failed.join(', ') }) } });
        else if (!silent) set({ message: { kind: 'ok', text: i18n.t('home.imported', { count: total }) } });
      } finally {
        finish();
      }
    },

    cancel: () => controller?.abort(),
    clearMessage: () => set({ message: null }),
  };
});

function errorText(e: unknown, source: Source): string {
  const msg = e instanceof Error ? e.message : String(e);
  const platform = i18n.t(`platform.${source}`);
  return ['userNotFound', 'rateLimited', 'accountTaken'].includes(msg)
    ? i18n.t(`home.errors.${msg}`, { platform })
    : i18n.t('home.errors.generic', { message: msg });
}

let autoSynced = false;

/** Syncs, once per session, every account (own and friends') not synced in the last hour. */
export async function autoSync(): Promise<void> {
  if (autoSynced) return;
  autoSynced = true;
  // Opening the installed app offline: nothing to fetch, and no failure message about it.
  if (!navigator.onLine) return;
  const now = Date.now();
  const stale = (await db.accounts.toArray()).filter((a) => !a.lastSync || now - a.lastSync > AUTO_SYNC_AFTER);
  // Own accounts first: they matter most and feed the head-to-head stats.
  stale.sort((a, b) => Number(!!a.friend) - Number(!!b.friend));
  if (stale.length) await useSync.getState().syncAll(stale, true);
}

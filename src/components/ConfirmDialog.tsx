import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';

interface Request {
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<{ request: Request | null }>(() => ({ request: null }));

/** Styled replacement for window.confirm: resolves true on confirm, false on cancel, Esc or backdrop click. */
export function confirmDialog(message: string, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    // A second request while one is open cancels the first.
    useConfirmStore.getState().request?.resolve(false);
    useConfirmStore.setState({ request: { message, ...opts, resolve } });
  });
}

/** Mount once (in App); renders whatever confirmDialog() asked for. */
export default function ConfirmHost() {
  const { t } = useTranslation();
  const request = useConfirmStore((s) => s.request);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (request && !d.open) d.showModal();
    else if (!request && d.open) d.close();
  }, [request]);

  const answer = (ok: boolean) => {
    request?.resolve(ok);
    useConfirmStore.setState({ request: null });
  };

  return (
    <dialog
      ref={ref}
      // Esc closes the native dialog: that counts as cancel.
      onClose={() => request && answer(false)}
      onClick={(e) => e.target === e.currentTarget && answer(false)}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-panel-2 p-0 text-ink shadow-2xl ring-1 ring-line-2 backdrop:bg-black/60"
    >
      {request && (
        <div className="space-y-5 p-5">
          <p className="text-sm text-ink-2">{request.message}</p>
          <div className="flex gap-2">
            <button className="btn-ghost h-10 flex-1" onClick={() => answer(false)}>{t('common.cancel')}</button>
            <button
              autoFocus
              className={`${request.danger ? 'btn bg-loss text-white hover:brightness-110' : 'btn-primary'} h-10 flex-1`}
              onClick={() => answer(true)}
            >
              {request.confirmLabel ?? t('common.confirm')}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/** Modal listing keyboard shortcuts: `[keys, description]` pairs, keys split on spaces into separate caps. */
export default function ShortcutsDialog({ open, onClose, shortcuts }: { open: boolean; onClose: () => void; shortcuts: [string, string][] }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-80 rounded-lg bg-panel-2 p-0 text-ink shadow-2xl ring-1 ring-line backdrop:bg-black/60"
    >
      <div className="space-y-3 p-5">
        <h2 className="text-lg font-semibold">{t('shortcuts.title')}</h2>
        <table className="w-full text-sm">
          <tbody>
            {shortcuts.map(([keys, label]) => (
              <tr key={keys}>
                <td className="py-1 pr-4 whitespace-nowrap">
                  {keys.split(' ').map((k) =>
                    k === '/' ? (
                      <span key={k} className="mx-1 text-ink-3">/</span>
                    ) : (
                      <kbd key={k} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs ring-1 ring-line">{k}</kbd>
                    ),
                  )}
                </td>
                <td className="py-1 text-ink-2">{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn-ghost w-full" onClick={onClose}>{t('shortcuts.close')}</button>
      </div>
    </dialog>
  );
}

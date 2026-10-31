import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BOARD_THEMES,
  PIECE_SETS,
  boardImageUrl,
  loadLocalAssets,
  pieceUrl,
  useSettings,
  type LocalAssets,
} from '../lib/settings';

/** Human label for a set/theme id: "local:icy_sea" -> "icy sea". */
function label(id: string) {
  return id.replace(/^local:/, '').replace(/\.\w+$/, '').replace(/[_-]+/g, ' ');
}

/** Gear button with a popover for board colours and piece set. */
/** `placement` says which way the popover opens from the button (down where there's no room above). */
export default function AppearancePanel({ placement = 'up' }: { placement?: 'up' | 'down' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<LocalAssets>({ pieces: [], boards: [] });
  const ref = useRef<HTMLDivElement>(null);
  const { boardTheme, setBoardTheme, pieceSet, setPieceSet } = useSettings();

  useEffect(() => {
    void loadLocalAssets().then(setLocal);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const boards = [...Object.keys(BOARD_THEMES), ...local.boards.map((b) => `local:${b}`)];
  const sets = [...PIECE_SETS, ...local.pieces.map((p) => `local:${p}`)];
  const previewBg = BOARD_THEMES[boardTheme]?.light ?? BOARD_THEMES.graphite.light;

  return (
    <div ref={ref} className="relative">
      <button
        className="btn-ghost h-10 w-12"
        title={t('appearance.title')}
        aria-label={t('appearance.title')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute right-0 ${placement === 'up' ? 'bottom-12' : 'top-12'} z-30 max-h-[70vh] w-80 space-y-4 overflow-y-auto rounded-2xl border border-line bg-panel-2 p-4 shadow-2xl`}
          // On small screens it can open past the fold; bring it into view.
          ref={(el) => el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
        >
          <div>
            <div className="eyebrow mb-2">{t('appearance.board')}</div>
            <div className="grid grid-cols-6 gap-2">
              {boards.map((k) => {
                const img = boardImageUrl(k);
                const name = BOARD_THEMES[k] ? t(`appearance.themes.${k}`) : label(k);
                return (
                  <button
                    key={k}
                    onClick={() => setBoardTheme(k)}
                    aria-pressed={boardTheme === k}
                    title={name}
                    aria-label={name}
                    className={`grid aspect-square grid-cols-2 overflow-hidden rounded-md bg-cover ring-2 ${boardTheme === k ? 'ring-accent' : 'ring-transparent hover:ring-line'}`}
                    style={img ? { backgroundImage: `url("${img}")`, backgroundSize: '400%' } : undefined}
                  >
                    {!img &&
                      [0, 1, 2, 3].map((i) => (
                        <span key={i} style={{ background: i === 0 || i === 3 ? BOARD_THEMES[k].light : BOARD_THEMES[k].dark }} />
                      ))}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="eyebrow mb-2">{t('appearance.pieces')}</div>
            <div className="grid grid-cols-5 gap-2">
              {sets.map((set) => (
                <button
                  key={set}
                  onClick={() => setPieceSet(set)}
                  aria-pressed={pieceSet === set}
                  title={label(set)}
                  aria-label={label(set)}
                  className={`flex aspect-square items-center justify-center rounded-md p-1 ring-2 ${
                    pieceSet === set ? 'ring-accent' : 'ring-transparent hover:ring-line'
                  }`}
                  style={{ background: previewBg }}
                >
                  <img src={pieceUrl(set, 'wN')} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

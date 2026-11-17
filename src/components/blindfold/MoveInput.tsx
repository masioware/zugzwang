import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseMove } from '../../blindfold/parseMove';
import { canListen, listen, type Lang } from '../../blindfold/speech';

interface Props {
  /** The position the move is played in. */
  fen: string;
  lang: Lang;
  disabled?: boolean;
  /** Same contract as the board's `onMove`: true when the move was taken (right or wrong), false when refused. */
  onMove: (from: string, to: string, piece: string, promotion?: string) => boolean;
}

/** Type (or say) a move: SAN, coordinates, or words like "cavalo f3". */
export default function MoveInput({ fen, lang, disabled, onMove }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [error, setError] = useState(false);
  const [listening, setListening] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const stop = useRef<(() => void) | null>(null);

  // Ready to type as soon as it's the player's turn.
  useEffect(() => {
    if (!disabled) input.current?.focus();
  }, [disabled, fen]);
  useEffect(() => () => stop.current?.(), []);

  /** Tries each reading in turn (a recogniser offers alternatives); the first legal one is played. */
  function submit(readings: string[]) {
    if (disabled) return;
    for (const r of readings) {
      const m = parseMove(r, fen);
      if (m.ok && onMove(m.from, m.to, m.piece, m.promotion)) {
        setText('');
        setError(false);
        return;
      }
    }
    setError(true);
  }

  function toggleListen() {
    if (listening) return stop.current?.();
    setListening(true);
    setError(false);
    stop.current = listen(
      lang,
      (alts) => {
        setText(alts[0] ?? '');
        submit(alts);
      },
      () => setListening(false),
    );
  }

  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit([text]);
      }}
    >
      <div className="flex gap-2">
        <input
          ref={input}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            setError(false);
          }}
          placeholder={t('blindfold.inputPlaceholder')}
          aria-label={t('blindfold.inputLabel')}
          aria-invalid={error}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-panel-2/60 px-3 font-mono text-base outline-none focus:border-accent disabled:opacity-50"
        />
        {canListen() && (
          <button
            type="button"
            className={`btn-ghost h-11 w-11 ${listening ? 'text-accent' : ''}`}
            disabled={disabled}
            title={t('blindfold.speak')}
            aria-label={t('blindfold.speak')}
            aria-pressed={listening}
            onClick={toggleListen}
          >
            🎤
          </button>
        )}
        <button type="submit" className="btn-primary h-11 px-4" disabled={disabled || !text.trim()}>
          {t('blindfold.play')}
        </button>
      </div>
      <p className={`min-h-5 text-sm ${error ? 'text-loss' : 'text-ink-3'}`} role="status">
        {error ? t('blindfold.illegal') : listening ? t('blindfold.listening') : t('blindfold.inputHint')}
      </p>
    </form>
  );
}

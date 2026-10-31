import { useTranslation } from 'react-i18next';
import type { WoodpeckerSet } from '../../types';

/** Signed rating change, green when up. */
export function Delta({ value }: { value: number }) {
  return (
    <span className={`tabular font-semibold ${value >= 0 ? 'text-accent' : 'text-loss'}`}>
      {value >= 0 ? '+' : '−'}
      {Math.abs(value)}
    </span>
  );
}

/** The puzzle's themes as small translated chips. */
export function ThemeChips({ themes }: { themes: string[] }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1">
      {themes.map((k) => (
        <span key={k} className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-ink-2">
          {t(`puzzleTheme.${k}`, { defaultValue: k })}
        </span>
      ))}
    </div>
  );
}

/** Theme picker sorted by translated name; '' means any theme. */
export function ThemeSelect({ themes, value, onChange }: { themes: string[]; value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('puzzles.anyTheme')}</option>
      {themes
        .map((k) => [k, t(`puzzleTheme.${k}`, { defaultValue: k })] as const)
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
    </select>
  );
}

/** "Fork · 1100–1400" or "Failed puzzles": where a Woodpecker set's puzzles came from. */
export function originLabel(set: WoodpeckerSet, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (set.origin.kind === 'failed') return t('woodpecker.fromFailed');
  const theme = set.origin.theme ? t(`puzzleTheme.${set.origin.theme}`, { defaultValue: set.origin.theme }) : t('puzzles.anyTheme');
  return `${theme} · ${set.origin.min}–${set.origin.max}`;
}

import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n';

/** Two languages: a single button that switches to the other one. */
export default function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage?.startsWith('pt') ? 'pt-BR' : 'en';
  const other = LANGUAGES.find((l) => l.code !== current)!;
  return (
    <button
      className="btn-ghost h-9 px-2.5 font-mono text-xs tracking-wider"
      aria-label={`${t('nav.language')}: ${other.label}`}
      title={other.label}
      onClick={() => void i18n.changeLanguage(other.code)}
    >
      {current === 'en' ? 'EN' : 'PT'}
    </button>
  );
}

import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n';

export default function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage?.startsWith('pt') ? 'pt-BR' : 'en';
  return (
    <select
      aria-label={t('nav.language')}
      className="input w-[4.5rem] py-1 sm:w-auto"
      value={current}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.code === 'en' ? 'EN' : 'PT'} · {l.label}</option>
      ))}
    </select>
  );
}

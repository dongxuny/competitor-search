import type { AppLanguage } from '../i18n';

interface LanguageToggleProps {
  lang: AppLanguage;
  onToggle: (next: AppLanguage) => void;
}

export function LanguageToggle({ lang, onToggle }: LanguageToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(lang === 'en' ? 'zh' : 'en')}
      className="rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-medium text-black/55"
    >
      {lang === 'en' ? '中文' : 'EN'}
    </button>
  );
}

import { useEffect, useMemo, useState } from 'react';
import type { AppLanguage } from '../i18n';

const STORAGE_KEY = 'app-language';

export function useLanguage(initial?: string | null) {
  const normalizedInitial = initial === 'zh' ? 'zh' : initial === 'en' ? 'en' : null;
  const [lang, setLang] = useState<AppLanguage>(() => {
    if (normalizedInitial) return normalizedInitial;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'zh' ? 'zh' : 'en';
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const opposite = useMemo<AppLanguage>(() => (lang === 'en' ? 'zh' : 'en'), [lang]);

  return { lang, setLang, opposite };
}

import { t } from '../../i18n';
import type { AppLanguage } from '../../i18n';

interface ActionsSectionProps {
  lang: AppLanguage;
  onNewAnalysis: () => void;
  onRetry: () => void;
}

export function ActionsSection({ lang, onNewAnalysis, onRetry }: ActionsSectionProps) {
  return (
    <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'actions')}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onNewAnalysis}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white"
        >
          {t(lang, 'newAnalysis')}
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-black"
        >
          {t(lang, 'rerunAnalysis')}
        </button>
      </div>
    </section>
  );
}

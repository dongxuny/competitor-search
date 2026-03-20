import { t } from '../../i18n';
import type { AppLanguage } from '../../i18n';
import type { AnalysisResult } from '../../types';

interface AISummarySectionProps {
  lang: AppLanguage;
  result: AnalysisResult;
}

export function AISummarySection({ lang, result }: AISummarySectionProps) {
  return (
    <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'aiSummary')}</p>
      <div className="mt-3 rounded-[1rem] border border-black/8 bg-[#fcfcfc] px-4 py-4">
        <p className="font-mono text-[13px] leading-7 text-black/74">
          {result.summary}
          <span className="ml-1 inline-block h-4 w-[1px] animate-pulse bg-black/40 align-[-2px]" />
        </p>
      </div>
    </section>
  );
}

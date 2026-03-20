import type { AppLanguage } from '../../i18n';
import type { AnalysisResult } from '../../types';

interface SearchEvidenceSectionProps {
  lang: AppLanguage;
  result: AnalysisResult;
}

export function SearchEvidenceSection({ lang, result }: SearchEvidenceSectionProps) {
  const items = Array.isArray(result.searchEvidence) ? result.searchEvidence : [];

  return (
    <details className="rounded-[1.25rem] border border-black/8 bg-white p-5">
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
              {lang === 'zh' ? '调试信息' : 'Debug'}
            </p>
            <p className="mt-1 text-sm text-black/55">
              {lang === 'zh'
                ? `抓取证据，当前 ${items.length} 条`
                : `Crawl evidence, ${items.length} item${items.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <span className="text-xs font-medium text-black/45">
            {lang === 'zh' ? '展开' : 'Expand'}
          </span>
        </div>
      </summary>

      <div className="mt-4 border-t border-black/6 pt-4">
        {!items.length ? (
          <p className="text-sm text-black/45">
            {lang === 'zh' ? '当前没有抓取证据。' : 'No crawl evidence was collected.'}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <article key={`${item.url}-${index}`} className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">
                  {lang === 'zh' ? '抓取来源' : 'Source'}
                </p>
                <p className="mt-1 break-words text-sm text-black/70">{item.query}</p>

                <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">
                  {lang === 'zh' ? '标题' : 'Title'}
                </p>
                <p className="mt-1 break-words text-sm font-medium text-black">{item.title || (lang === 'zh' ? '无标题' : 'Untitled')}</p>

                {item.metaDescription ? (
                  <>
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">
                      {lang === 'zh' ? 'Meta 描述' : 'Meta description'}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-black/68">{item.metaDescription}</p>
                  </>
                ) : null}

                {item.h1?.length ? (
                  <>
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">H1</p>
                    <p className="mt-1 text-sm leading-6 text-black/68">{item.h1.join(' | ')}</p>
                  </>
                ) : null}

                {item.h2?.length ? (
                  <>
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">H2</p>
                    <p className="mt-1 text-sm leading-6 text-black/68">{item.h2.join(' | ')}</p>
                  </>
                ) : null}

                {item.h3?.length ? (
                  <>
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">H3</p>
                    <p className="mt-1 text-sm leading-6 text-black/68">{item.h3.join(' | ')}</p>
                  </>
                ) : null}

                <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">
                  URL
                </p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block break-all text-sm text-black/60 underline decoration-black/20 underline-offset-4"
                >
                  {item.url}
                </a>

                <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.12em] text-black/40">
                  {lang === 'zh' ? '摘要' : 'Snippet'}
                </p>
                <p className="mt-1 text-sm leading-6 text-black/68">{item.snippet || item.content || (lang === 'zh' ? '无摘要' : 'No snippet')}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

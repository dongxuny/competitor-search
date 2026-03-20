import { Link, createSearchParams } from 'react-router-dom';
import { t } from '../../i18n';
import type { AppLanguage } from '../../i18n';
import type { AnalysisResult } from '../../types';
import { SiteLogo } from '../SiteLogo';

interface CompetitorOverviewSectionProps {
  lang: AppLanguage;
  result: AnalysisResult;
}

function getCountryFlag(country: string) {
  const normalized = country.trim().toLowerCase();

  const flags: Record<string, string> = {
    'united states': 'US',
    usa: 'US',
    us: 'US',
    canada: 'CA',
    singapore: 'SG',
    germany: 'DE',
    ireland: 'IE',
    australia: 'AU',
    netherlands: 'NL',
    'united kingdom': 'GB',
    uk: 'GB',
    britain: 'GB',
    estonia: 'EE',
    china: 'CN',
    japan: 'JP',
    france: 'FR',
    india: 'IN',
  };

  const code = flags[normalized];

  if (!code) return '';

  return code
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join('');
}

export function CompetitorOverviewSection({ lang, result }: CompetitorOverviewSectionProps) {
  const proCardTitle = lang === 'zh' ? '敬请期待专业版' : 'Coming in Pro';
  const proCardDescription = lang === 'zh'
    ? '解锁更多竞品、深度对比、公司信号与可导出的分析视图。'
    : 'Unlock more competitors, deeper comparisons, company signals, and export-ready views.';

  return (
    <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'competitorOverview')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {result.competitors.map((competitor) => {
          const detailUrl = `/competitor?${createSearchParams({
            lang,
            target: result.target.name,
            q: result.target.inputQuery,
            name: competitor.name,
            website: competitor.website,
            price: competitor.startingPrice,
            bestFor: competitor.bestFor,
            positioning: competitor.positioning,
            country: competitor.country,
          }).toString()}`;

          return (
          <article
            key={competitor.name}
            className="block min-w-0 rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4 transition-colors hover:border-black/14"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <SiteLogo
                    name={competitor.name}
                    website={competitor.website}
                    logo={competitor.logo}
                    containerClassName="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/8 bg-white"
                    imgClassName="h-5 w-5 object-contain"
                  />
                  <h3 className="text-base font-medium text-black break-words">{competitor.name}</h3>
                </div>
                <a
                  href={competitor.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block break-all text-sm text-black/55 underline decoration-black/20 underline-offset-4"
                >
                  {competitor.website}
                </a>
              </div>
              <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-black/8 bg-white px-2.5 text-xs text-black/60 whitespace-nowrap">
                {getCountryFlag(competitor.country) ? <span aria-hidden="true">{getCountryFlag(competitor.country)}</span> : null}
                <span>{competitor.country}</span>
              </span>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'overview')}</p>
                <p className="mt-1 leading-6 text-black/68">{competitor.positioning}</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                to={detailUrl}
                className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black"
              >
                {lang === 'zh' ? '查看详情' : 'View details'}
              </Link>
            </div>
          </article>
        )})}
        <article className="min-w-0 rounded-[1rem] border border-dashed border-black/12 bg-[linear-gradient(180deg,rgba(247,245,239,0.85),rgba(255,255,255,0.96))] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white text-lg text-black/55">
              <span aria-hidden="true">+</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-medium text-black">{proCardTitle}</h3>
              <p className="mt-1 text-sm text-black/48">
                {lang === 'zh' ? '更多结果位' : 'More result slots'}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'overview')}</p>
              <p className="mt-1 leading-6 text-black/68">{proCardDescription}</p>
            </div>
          </div>
          <div className="mt-4">
            <span className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black/60">
              {lang === 'zh' ? '即将推出' : 'Coming soon'}
            </span>
          </div>
        </article>
      </div>
    </section>
  );
}

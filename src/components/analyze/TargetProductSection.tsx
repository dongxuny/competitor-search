import { t } from '../../i18n';
import type { AppLanguage } from '../../i18n';
import type { AnalysisResult } from '../../types';
import { SiteLogo } from '../SiteLogo';

interface TargetProductSectionProps {
  lang: AppLanguage;
  result: AnalysisResult;
}

function getTargetWebsite(result: AnalysisResult) {
  const metadataWebsite = result.target.metadata?.website?.trim() || '';
  if (/^https?:\/\//i.test(metadataWebsite)) {
    return metadataWebsite;
  }

  const rawUrl = result.target.inputQuery?.trim() || '';
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  const domain = result.target.metadata?.domain?.trim();
  if (domain) {
    return `https://${domain}`;
  }

  const evidenceUrl = result.searchEvidence?.find((item) => /^https?:\/\//i.test(item.url || ''))?.url?.trim();
  if (evidenceUrl) {
    return evidenceUrl;
  }

  return '';
}

export function TargetProductSection({ lang, result }: TargetProductSectionProps) {
  const features = Array.isArray(result.target.features) ? result.target.features : [];
  const website = getTargetWebsite(result);
  const logo = result.target.metadata?.logo || '';

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-black/8 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'targetProduct')}</p>
      <div className="mt-3 min-w-0">
        <div className="flex items-start gap-3">
          {website ? (
            <SiteLogo
              name={result.target.name}
              website={website}
              logo={logo}
              containerClassName="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/8 bg-white"
              imgClassName="h-6 w-6 object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <h2 className="break-words text-2xl font-medium tracking-[-0.03em] text-black">{result.target.name}</h2>
          </div>
        </div>
        {website ? (
          <div className="mt-3 min-w-0">
            <a
              href={website}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm text-black/55 underline decoration-black/20 underline-offset-4"
              title={website}
            >
              {website}
            </a>
          </div>
        ) : null}
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'positioning')}</p>
          <p className="mt-2 text-[15px] leading-7 text-black/70">{result.target.positioning}</p>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'keyFeatures')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {features.map((feature) => (
              <span
                key={feature}
                className="max-w-full break-words rounded-full border border-black/8 bg-[#fcfcfc] px-3 py-1.5 text-xs leading-5 text-black/68"
              >
                {feature}
              </span>
            ))}
            {!features.length ? (
              <span className="text-sm text-black/45">{t(lang, 'noKeyFeatures')}</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

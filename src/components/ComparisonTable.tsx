import { Link, createSearchParams } from 'react-router-dom';
import { t } from '../i18n';
import type { AppLanguage } from '../i18n';
import type { AnalysisResult } from '../types';

interface ComparisonTableProps {
  lang: AppLanguage;
  result: AnalysisResult;
}

export function ComparisonTable({ lang, result }: ComparisonTableProps) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-black/8 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-medium text-black">{t(lang, 'comparisonTable')}</h3>
          <p className="text-sm text-black/55">{t(lang, 'comparisonDescription')}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2.5 text-left text-sm">
          <thead>
            <tr className="text-black/45">
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-[0.12em]">{t(lang, 'product')}</th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-[0.12em]">{t(lang, 'price')}</th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-[0.12em]">{t(lang, 'bestFor')}</th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-[0.12em]">{t(lang, 'positioning')}</th>
              <th className="px-3 py-2 text-xs font-medium uppercase tracking-[0.12em]">{t(lang, 'country')}</th>
            </tr>
          </thead>
          <tbody>
            {result.competitors.map((competitor) => (
              <tr key={competitor.name} className="bg-neutral-50">
                <td className="rounded-l-2xl px-3 py-3.5 font-medium text-black">
                  <Link
                    to={`/competitor?${createSearchParams({
                      lang,
                      target: result.target.name,
                      q: result.target.inputQuery,
                      name: competitor.name,
                      website: competitor.website,
                      price: competitor.startingPrice,
                      bestFor: competitor.bestFor,
                      positioning: competitor.positioning,
                      country: competitor.country,
                    }).toString()}`}
                    className="underline decoration-black/12 underline-offset-4"
                  >
                    {competitor.name}
                  </Link>
                </td>
                <td className="px-3 py-3.5 text-black/68">{competitor.startingPrice}</td>
                <td className="px-3 py-3.5 text-black/68">{competitor.bestFor}</td>
                <td className="px-3 py-3.5 text-black/68">{competitor.positioning}</td>
                <td className="rounded-r-2xl px-3 py-3.5 text-black/68">{competitor.country}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

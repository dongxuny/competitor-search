import type { FormEvent } from 'react';
import type { KeyboardEvent } from 'react';
import { t } from '../i18n';
import type { AppLanguage } from '../i18n';
import type { ProductInput } from '../types';

interface InputFormProps {
  lang: AppLanguage;
  value: ProductInput;
  error: string | null;
  isSubmitting: boolean;
  onChange: (next: ProductInput) => void;
  onSubmit: () => void;
}

const popularCategories = {
  en: [
    'AI coding assistants',
    'Observability platforms',
    'FinOps tools',
    'Influencer marketing platforms',
    'Customer support software',
    'CRM for SMB teams',
  ],
  zh: [
    'AI 编程助手',
    '可观测性平台',
    'FinOps 工具',
    '网红营销平台',
    '客服支持软件',
    '中小团队 CRM',
  ],
} as const;

function detectInputType(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return 'empty';
  return /^https?:\/\//i.test(trimmed) ? 'url' : 'description';
}

export function InputForm({ lang, value, error, isSubmitting, onChange, onSubmit }: InputFormProps) {
  const inputType = detectInputType(value.query);
  const hasValue = value.query.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <section
        className={`rounded-[1.75rem] border bg-white p-3 ${
          error ? 'border-red-200' : 'border-black/8'
        }`}
      >
        <div className="mb-2.5 flex items-center justify-between gap-4 px-2 pt-1">
          <p className={`text-sm ${error ? 'text-red-600/80' : 'text-black/45'}`}>
            {t(lang, 'inputHint')}
          </p>
          {hasValue ? (
            <span className="rounded-full border border-black/8 bg-[#fcfcfc] px-2.5 py-1 text-[11px] font-medium text-black/42">
              {inputType === 'url' ? t(lang, 'urlDetected') : t(lang, 'descriptionDetected')}
            </span>
          ) : null}
        </div>

        <div className="mb-3 rounded-[1rem] border border-[#d8e8de] bg-[#f3f8f4] px-4 py-3 text-sm leading-6 text-[#244233]">
          {t(lang, 'officialSiteTip')}
        </div>

        <label className="block">
          <textarea
            rows={4}
            placeholder={t(lang, 'inputPlaceholder')}
            value={value.query}
            onChange={(event) => onChange({ query: event.target.value })}
            onKeyDown={handleKeyDown}
            className={`min-h-[108px] w-full resize-none rounded-[1.25rem] border bg-[#fcfcfc] px-5 py-4 text-[15px] leading-7 text-black outline-none transition placeholder:text-black/22 focus:bg-white disabled:cursor-not-allowed disabled:opacity-70 ${
              error ? 'border-red-200 focus:border-red-300' : 'border-black/8 focus:border-black/12'
            }`}
            disabled={isSubmitting}
          />
        </label>

        <div className={`flex items-center justify-between gap-3 px-2 pt-3 text-xs ${error ? 'text-red-600/75' : 'text-black/42'}`}>
          <span>{error ? error : t(lang, 'shortcutHint')}</span>
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-black/42">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-black/70" />
              <span>{t(lang, 'analyzing')}</span>
            </span>
          ) : null}
        </div>
      </section>

      <div className="flex justify-center">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-10 min-w-[118px] items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:bg-black/80"
        >
          {isSubmitting ? t(lang, 'analyzing') : t(lang, 'analyze')}
        </button>
      </div>
      <section className="rounded-[1.25rem] border border-black/8 bg-white px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
            {lang === 'zh' ? '常见类别' : 'Popular categories'}
          </p>
          {popularCategories[lang].map((category) => (
            <button
              key={category}
              type="button"
              disabled={isSubmitting}
              onClick={() => onChange({ query: category })}
              className="rounded-full border border-black/8 bg-[#fcfcfc] px-3 py-1.5 text-xs text-black/60 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {category}
            </button>
          ))}
        </div>
      </section>

    </form>
  );
}

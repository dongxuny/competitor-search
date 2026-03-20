import { useEffect, useState } from 'react';
import type { AppLanguage } from '../../i18n';
import type { AnalysisStep } from '../../types';

interface ProgressStepsProps {
  lang: AppLanguage;
  steps: AnalysisStep[];
  onStepClick?: (stepId: AnalysisStep['id']) => void;
  clickableStepIds?: AnalysisStep['id'][];
}

function getStepIndicatorClass(status: AnalysisStep['status']) {
  if (status === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-600';
  if (status === 'running') return 'border-black/10 bg-black/[0.04] text-black/70';
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-600';
  return 'border-black/8 bg-white text-black/24';
}

function getStepText(lang: AppLanguage, status: AnalysisStep['status']) {
  if (status === 'completed') return lang === 'zh' ? '已完成' : 'Done';
  if (status === 'running') return lang === 'zh' ? '进行中' : 'Running';
  if (status === 'failed') return lang === 'zh' ? '失败' : 'Failed';
  return lang === 'zh' ? '等待中' : 'Waiting';
}

function formatElapsed(ms: number, lang: AppLanguage) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return lang === 'zh'
      ? `${minutes}分 ${seconds}秒`
      : `${minutes}m ${seconds}s`;
  }

  return lang === 'zh' ? `${seconds}秒` : `${seconds}s`;
}

function StepIcon({ status }: { status: AnalysisStep['status'] }) {
  if (status === 'completed') {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M3.5 8.5 6.5 11.5 12.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === 'running') {
    return <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-current" />;
  }

  if (status === 'failed') {
    return (
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
        <path
          d="M5 5 11 11M11 5 5 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return <span className="h-2.5 w-2.5 rounded-full bg-current" />;
}

export function ProgressSteps({ lang, steps, onStepClick, clickableStepIds = [] }: ProgressStepsProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="rounded-[1rem] bg-transparent">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-black/38">
        {lang === 'zh' ? '分析进度' : 'Analysis Progress'}
      </p>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {steps.map((step, index) => (
          (() => {
            const end = step.completedAt || (step.status === 'running' ? now : 0);
            const elapsedMs = step.startedAt && end ? Math.max(0, end - step.startedAt) : 0;
            const elapsedText = elapsedMs > 0 ? formatElapsed(elapsedMs, lang) : '';

            return (
          <button
            key={step.id}
            type="button"
            onClick={() => {
              if (clickableStepIds.includes(step.id) && onStepClick) {
                onStepClick(step.id);
              }
            }}
            className={`relative w-full rounded-[0.9rem] border border-black/6 bg-white/80 px-3.5 py-2.5 text-left ${
              clickableStepIds.includes(step.id) ? 'cursor-pointer transition hover:border-black/12 hover:bg-white' : 'cursor-default'
            }`}
          >
            {index < steps.length - 1 ? (
              <span className="pointer-events-none absolute left-[calc(100%+0.375rem)] top-1/2 hidden h-px w-3 -translate-y-1/2 bg-black/10 md:block" />
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${getStepIndicatorClass(step.status)}`}>
                  <StepIcon status={step.status} />
                </span>
                <span className="text-[13px] font-medium text-black/76">{step.label}</span>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] text-black/46">{getStepText(lang, step.status)}</div>
                {elapsedText ? (
                  <div className="mt-0.5 text-[11px] tabular-nums text-black/36">{elapsedText}</div>
                ) : null}
              </div>
            </div>
          </button>
            );
          })()
        ))}
      </div>
    </section>
  );
}

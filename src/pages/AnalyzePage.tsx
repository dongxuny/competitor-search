import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LanguageToggle } from '../components/LanguageToggle';
import { AISummarySection } from '../components/analyze/AISummarySection';
import { CompetitorOverviewSection } from '../components/analyze/CompetitorOverviewSection';
import { ProgressSteps } from '../components/analyze/ProgressSteps';
import { SearchEvidenceSection } from '../components/analyze/SearchEvidenceSection';
import { TargetProductSection } from '../components/analyze/TargetProductSection';
import { ComparisonTable } from '../components/ComparisonTable';
import { getAnalyzeJob, startAnalyzeQuery, submitFeedback } from '../lib/api';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';
import type { AnalysisResult, AnalysisStep } from '../types';

type AnalyzeViewState = 'empty' | 'loading' | 'error' | 'success';
type DebugStep = 'understand' | 'analyze' | 'logs' | null;

function getAnalysisCacheKey(query: string, lang: 'en' | 'zh') {
  return `analysis-cache::${lang}::${query.trim().toLowerCase()}`;
}

export function AnalyzePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lang, setLang } = useLanguage(searchParams.get('lang'));
  const [viewState, setViewState] = useState<AnalyzeViewState>('empty');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [partialResult, setPartialResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<AnalysisStep[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [debugStep, setDebugStep] = useState<DebugStep>(null);
  const [feedbackRating, setFeedbackRating] = useState<'helpful' | 'neutral' | 'unhelpful' | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackState, setFeedbackState] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const query = searchParams.get('q')?.trim() ?? '';

  function buildAnalyzeUrl(nextQuery: string) {
    const params = new URLSearchParams({
      q: nextQuery,
      lang,
      t: String(Date.now()),
    });
    return `/analyze?${params.toString()}`;
  }

  function handleLanguageChange(nextLang: 'en' | 'zh') {
    setLang(nextLang);
    if (query) {
      navigate(`/analyze?q=${encodeURIComponent(query)}&lang=${nextLang}`);
      return;
    }
    navigate(`/analyze?lang=${nextLang}`);
  }

  function renderDebugModal(
    langValue: 'en' | 'zh',
    step: DebugStep,
    data: unknown,
    onClose: () => void,
  ) {
    if (!step || !data) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-[760px] rounded-[1.25rem] border border-black/8 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
                {langValue === 'zh' ? '调试信息' : 'Debug'}
              </p>
              <h2 className="mt-2 text-lg font-medium tracking-[-0.02em] text-black">
                {step === 'logs'
                  ? (langValue === 'zh' ? '运行日志' : 'Live logs')
                  : step === 'understand'
                  ? (langValue === 'zh' ? '分析需求返回内容' : 'Understanding step output')
                  : (langValue === 'zh' ? '竞品分析返回内容' : 'Analysis step output')}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm text-black/70"
            >
              {langValue === 'zh' ? '关闭' : 'Close'}
            </button>
          </div>
          <pre className="mt-4 max-h-[65vh] overflow-auto rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4 text-[12px] leading-6 text-black/75">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  useEffect(() => {
    let isActive = true;

    if (!query) {
      setViewState('empty');
      setResult(null);
      setPartialResult(null);
      setError(null);
      setSteps([]);
      setLogs([]);
      setDebugStep(null);
      setFeedbackRating(null);
      setFeedbackComment('');
      setFeedbackState('idle');
      setShowFeedbackModal(false);
      setShowContactModal(false);
      return () => {
        isActive = false;
      };
    }

    const cacheKey = getAnalysisCacheKey(query, lang);
    try {
      const raw = window.sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as AnalysisResult;
        setResult(cached);
        setPartialResult(cached);
        setSteps([
          { id: 'understand', label: lang === 'zh' ? '分析需求' : 'Understand input', status: 'completed' },
          { id: 'search', label: lang === 'zh' ? '搜索外部证据' : 'Search evidence', status: 'completed' },
          { id: 'analyze', label: lang === 'zh' ? '生成竞品分析' : 'Generate analysis', status: 'completed' },
        ]);
        setLogs(cached.logs || []);
        setViewState('success');
        setError(null);
        setDebugStep(null);
        setFeedbackRating(null);
        setFeedbackComment('');
        setFeedbackState('idle');
        setShowFeedbackModal(false);
        setShowContactModal(false);
        return () => {
          isActive = false;
        };
      }
    } catch {
      // Ignore invalid cache and continue with live analysis.
    }

    setViewState('loading');
    setResult(null);
    setPartialResult(null);
    setError(null);
    setSteps([]);
    setLogs([]);
    setDebugStep(null);
    setFeedbackRating(null);
    setFeedbackComment('');
    setFeedbackState('idle');
    setShowFeedbackModal(false);
    setShowContactModal(false);

    let pollTimeout: number | undefined;

    startAnalyzeQuery(query, lang)
      .then(async (jobId) => {
        async function poll() {
          const job = await getAnalyzeJob(jobId);
          if (!isActive) return;

          setSteps(job.steps);
          setLogs(job.logs || []);
          setPartialResult(job.partialResult);

          if (job.status === 'completed' && job.result) {
            setResult(job.result);
            try {
              window.sessionStorage.setItem(cacheKey, JSON.stringify(job.result));
            } catch {
              // Ignore session storage failures.
            }
            setViewState('success');
            setLogs(job.result.logs || job.logs || []);
            return;
          }

          if (job.status === 'failed') {
            setError(job.error || 'The analysis could not be generated for this input.');
            setViewState('error');
            return;
          }

          pollTimeout = window.setTimeout(() => {
            void poll();
          }, 900);
        }

        await poll();
      })
      .catch((analysisError) => {
        if (!isActive) return;
        const message =
          analysisError instanceof Error
            ? analysisError.message
            : 'The analysis could not be generated for this input.';
        setError(message);
        setViewState('error');
      });

    return () => {
      isActive = false;
      if (pollTimeout) {
        window.clearTimeout(pollTimeout);
      }
    };
  }, [query, lang]);

  if (viewState === 'empty') {
    return (
      <main className="min-h-screen bg-[#fafafa] px-4 py-5 text-black md:px-8">
        <div className="mx-auto max-w-[860px] pt-16">
          <section className="rounded-[1.75rem] border border-black/8 bg-white p-6 text-center">
            <p className="text-sm text-black/45">Analyze</p>
            <h1 className="mt-2 text-2xl font-medium text-black">{t(lang, 'emptyTitle')}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-black/55">
              {t(lang, 'emptyDescription')}
              {' '}
              <span className="font-medium text-black"> /analyze</span>.
            </p>
            <Link
              to={`/?lang=${lang}`}
              className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white"
            >
              {t(lang, 'backToHomepage')}
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (viewState === 'loading') {
    const debugBrief = partialResult?.brief || result?.brief || null;
    const debugRouting = partialResult?.routing || result?.routing || null;
    const debugSiteDiscovery = partialResult?.officialSiteDiscovery || result?.officialSiteDiscovery || null;
    const debugAnalysis = partialResult?.analysisDebug || result?.analysisDebug || null;

    return (
      <main className="min-h-screen bg-[#fafafa] px-4 py-5 text-black md:px-8">
        <div className="mx-auto max-w-[1100px]">
          <header className="mb-8 pt-6">
            <div className="mb-3 flex items-center justify-end">
              <LanguageToggle lang={lang} onToggle={handleLanguageChange} />
            </div>
            <p className="text-sm font-medium text-black/42">{t(lang, 'targetLabel')}</p>
            <h1 className="mt-2 text-2xl font-medium tracking-[-0.03em] text-black md:text-4xl">{t(lang, 'generating')}</h1>
            <p className="mt-2 text-sm leading-6 text-black/52">
              {t(lang, 'generatingDescription')}
            </p>
          </header>

          <div className="space-y-6">
            <ProgressSteps
              lang={lang}
              steps={steps}
              clickableStepIds={[
                ...(debugBrief ? ['understand' as const] : []),
                ...(debugAnalysis ? ['analyze' as const] : []),
              ]}
              onStepClick={(stepId) => {
                if (stepId === 'understand' && debugBrief) {
                  setDebugStep('understand');
                }
                if (stepId === 'analyze' && debugAnalysis) {
                  setDebugStep('analyze');
                }
              }}
            />
            {logs.length ? (
              <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
                <div className="mb-3">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
                    {lang === 'zh' ? '运行日志' : 'Live logs'}
                  </p>
                </div>
                <div className="max-h-[220px] overflow-auto rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4 font-mono text-[12px] leading-6 text-black/72">
                  {logs.map((line, index) => (
                    <div key={`${index}-${line}`}>{line}</div>
                  ))}
                </div>
              </section>
            ) : null}
            <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
              <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'targetProduct')}</p>
                <div className="mt-4 space-y-3">
                  <div className="h-7 w-40 animate-pulse rounded bg-neutral-100" />
                  <div className="h-4 w-24 animate-pulse rounded bg-neutral-100" />
                  <div className="h-4 w-full animate-pulse rounded bg-neutral-100" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-neutral-100" />
                </div>
              </section>

              <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'aiSummary')}</p>
                <div className="mt-3 rounded-[1rem] border border-black/8 bg-[#fcfcfc] px-4 py-4">
                  <div className="space-y-3">
                    <div className="h-4 w-full animate-pulse rounded bg-neutral-100" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-100" />
                    <div className="h-4 w-4/6 animate-pulse rounded bg-neutral-100" />
                  </div>
                </div>
              </section>
            </section>

            <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
              <div className="mb-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{t(lang, 'competitorOverview')}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                    <div className="h-5 w-32 animate-pulse rounded bg-neutral-100" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded bg-neutral-100" />
                    <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-neutral-100" />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-black/8 bg-white p-5">
              <div className="mb-3">
                <h3 className="text-xl font-medium text-black">{t(lang, 'comparisonTable')}</h3>
                <p className="text-sm text-black/55">{t(lang, 'comparisonDescription')}</p>
              </div>
              <div className="space-y-2.5">
                {[0, 1, 2, 3].map((item) => (
                  <div key={item} className="h-14 animate-pulse rounded-2xl bg-neutral-50" />
                ))}
              </div>
            </section>

            {partialResult?.searchEvidence?.length ? <SearchEvidenceSection lang={lang} result={partialResult} /> : null}
          </div>
        </div>
        {renderDebugModal(
          lang,
          debugStep,
          debugStep === 'understand'
            ? {
                routing: debugRouting,
                officialSiteDiscovery: debugSiteDiscovery,
                brief: debugBrief,
              }
            : debugAnalysis,
          () => setDebugStep(null),
        )}
      </main>
    );
  }

  if (viewState === 'error') {
    const debugBrief = partialResult?.brief || result?.brief || null;
    const debugRouting = partialResult?.routing || result?.routing || null;
    const debugSiteDiscovery = partialResult?.officialSiteDiscovery || result?.officialSiteDiscovery || null;
    const debugAnalysis = partialResult?.analysisDebug || result?.analysisDebug || null;

    return (
      <main className="min-h-screen bg-[#fafafa] px-4 py-5 text-black md:px-8">
        <div className="mx-auto max-w-[860px] pt-16">
          <section className="rounded-[1.75rem] border border-red-200 bg-white p-6 text-center">
            <p className="text-sm text-red-600/75">Analyze</p>
            <h1 className="mt-2 text-2xl font-medium text-black">{t(lang, 'failedTitle')}</h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-black/55">{error}</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              {debugRouting || debugBrief || debugSiteDiscovery ? (
                <button
                  type="button"
                  onClick={() => setDebugStep('understand')}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-black"
                >
                  {lang === 'zh' ? '查看调试信息' : 'View debug'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => navigate(buildAnalyzeUrl(query))}
                className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white"
              >
                {t(lang, 'tryAgain')}
              </button>
              <Link
                to={`/?lang=${lang}`}
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-black"
              >
                {t(lang, 'backToHomepage')}
              </Link>
            </div>
          </section>
        </div>
        {renderDebugModal(
          lang,
          debugStep,
          debugStep === 'understand'
            ? {
                routing: debugRouting,
                officialSiteDiscovery: debugSiteDiscovery,
                brief: debugBrief,
              }
            : debugAnalysis,
          () => setDebugStep(null),
        )}
      </main>
    );
  }

  if (!result) {
    return null;
  }

  const debugBrief = result.brief || null;
  const debugRouting = result.routing || null;
  const debugSiteDiscovery = result.officialSiteDiscovery || null;
  const debugAnalysis = result.analysisDebug || null;
  const persistedLogs = result.logs || logs;

  async function handleSubmitFeedback() {
    if (!feedbackRating || feedbackState === 'submitting' || feedbackState === 'submitted') {
      return;
    }

    setFeedbackState('submitting');

    try {
      await submitFeedback({
        query,
        rating: feedbackRating,
        comment: feedbackComment,
      });
      setFeedbackState('submitted');
    } catch {
      setFeedbackState('error');
    }
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-5 text-black md:px-8">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-8 pt-6">
          <div className="mb-3 flex items-center justify-end">
            <LanguageToggle lang={lang} onToggle={handleLanguageChange} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-black/42">{t(lang, 'targetLabel')}</p>
              <h1 className="mt-2 text-2xl font-medium tracking-[-0.03em] text-black md:text-4xl">
                {t(lang, 'analyzePageTitle')}
              </h1>
              <p className="mt-2 text-sm leading-6 text-black/52">
                {t(lang, 'analyzePageDescription')}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {persistedLogs.length ? (
                <button
                  type="button"
                  onClick={() => setDebugStep('logs')}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-black"
                >
                  {lang === 'zh' ? '查看运行日志' : 'View logs'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowContactModal(true)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-black"
              >
                {lang === 'zh' ? '联系作者' : 'Contact author'}
              </button>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(true)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-medium text-black"
              >
                {lang === 'zh' ? '反馈结果' : 'Give feedback'}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/?lang=${lang}`)}
                className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white"
              >
                {t(lang, 'newAnalysis')}
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <ProgressSteps
            lang={lang}
            steps={steps}
            clickableStepIds={[
              ...(debugBrief ? ['understand' as const] : []),
              ...(debugAnalysis ? ['analyze' as const] : []),
            ]}
            onStepClick={(stepId) => {
              if (stepId === 'understand' && debugBrief) {
                setDebugStep('understand');
              }
              if (stepId === 'analyze' && debugAnalysis) {
                setDebugStep('analyze');
              }
            }}
          />
          <section className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <TargetProductSection lang={lang} result={result} />
            <AISummarySection lang={lang} result={result} />
          </section>
          <CompetitorOverviewSection lang={lang} result={result} />
          <ComparisonTable lang={lang} result={result} />
          <SearchEvidenceSection lang={lang} result={result} />
        </div>
      </div>
      {showContactModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowContactModal(false)}
        >
          <div
            className="w-full max-w-[560px] rounded-[1.25rem] border border-black/8 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
                  {lang === 'zh' ? '联系作者' : 'Contact author'}
                </p>
                <h2 className="mt-2 text-lg font-medium tracking-[-0.02em] text-black">
                  {lang === 'zh' ? '欢迎直接联系我' : 'Reach out directly'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-black/55">
                  {lang === 'zh'
                    ? '如果你有建议、合作想法，或者想聊聊产品，可以直接发邮件或加微信。'
                    : 'If you have ideas, partnership questions, or want to talk about the product, feel free to email me or add me on WeChat.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-black/10 px-4 text-sm text-black/70"
              >
                {lang === 'zh' ? '关闭' : 'Close'}
              </button>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-[1fr,220px] md:items-start">
              <div className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
                  {lang === 'zh' ? '邮箱' : 'Email'}
                </p>
                <a href="mailto:dongxuny@gmail.com" className="mt-2 inline-block break-all text-base font-medium text-black underline decoration-black/15 underline-offset-4">
                  dongxuny@gmail.com
                </a>
              </div>
              <div className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
                  {lang === 'zh' ? '微信' : 'WeChat'}
                </p>
                <img src="/wechat-qr.png" alt={lang === 'zh' ? '微信二维码' : 'WeChat QR code'} className="mt-3 w-full rounded-[0.85rem] border border-black/8 bg-white object-contain" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showFeedbackModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[640px] rounded-[1.25rem] border border-black/8 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
                  {lang === 'zh' ? '反馈' : 'Feedback'}
                </p>
                <h2 className="mt-2 text-lg font-medium tracking-[-0.02em] text-black">
                  {lang === 'zh' ? '这次结果有帮助吗？' : 'Was this result helpful?'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm text-black/70"
              >
                {lang === 'zh' ? '关闭' : 'Close'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { value: 'helpful' as const, label: lang === 'zh' ? '有帮助' : 'Helpful' },
                { value: 'neutral' as const, label: lang === 'zh' ? '一般' : 'Neutral' },
                { value: 'unhelpful' as const, label: lang === 'zh' ? '没帮助' : 'Unhelpful' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setFeedbackRating(option.value);
                    if (feedbackState !== 'submitted') {
                      setFeedbackState('idle');
                    }
                  }}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium ${
                    feedbackRating === option.value
                      ? 'border-black bg-black text-white'
                      : 'border-black/10 bg-white text-black'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <textarea
                value={feedbackComment}
                onChange={(event) => {
                  setFeedbackComment(event.target.value);
                  if (feedbackState !== 'submitted') {
                    setFeedbackState('idle');
                  }
                }}
                placeholder={lang === 'zh' ? '可选：告诉我哪里不对，或者哪里有帮助。' : 'Optional: tell me what was wrong, or what was helpful.'}
                className="min-h-[92px] w-full rounded-[1rem] border border-black/8 bg-[#fcfcfc] px-4 py-3 text-sm text-black outline-none placeholder:text-black/35"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-black/50">
                {feedbackState === 'submitted'
                  ? (lang === 'zh' ? '反馈已提交。' : 'Feedback submitted.')
                  : feedbackState === 'error'
                    ? (lang === 'zh' ? '提交失败，请稍后重试。' : 'Submission failed. Please try again.')
                    : (lang === 'zh' ? '你的反馈会直接写入产品反馈表。' : 'Your feedback goes directly into the product feedback table.')}
              </p>
              <button
                type="button"
                onClick={() => {
                  void handleSubmitFeedback();
                }}
                disabled={!feedbackRating || feedbackState === 'submitting' || feedbackState === 'submitted'}
                className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-black/20"
              >
                {feedbackState === 'submitting'
                  ? (lang === 'zh' ? '提交中...' : 'Submitting...')
                  : feedbackState === 'submitted'
                    ? (lang === 'zh' ? '已提交' : 'Submitted')
                    : (lang === 'zh' ? '提交反馈' : 'Submit feedback')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {renderDebugModal(
        lang,
        debugStep,
        debugStep === 'logs'
          ? persistedLogs
          : debugStep === 'understand'
          ? {
              routing: debugRouting,
              officialSiteDiscovery: debugSiteDiscovery,
              brief: debugBrief,
            }
          : debugAnalysis,
        () => setDebugStep(null),
      )}
    </main>
  );
}

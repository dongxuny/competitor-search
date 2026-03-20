import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LanguageToggle } from '../components/LanguageToggle';
import { SiteLogo } from '../components/SiteLogo';
import { getCompetitorDetail, submitFeedback } from '../lib/api';
import { useLanguage } from '../hooks/useLanguage';
import type { Competitor, CompetitorDetail } from '../types';

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

export function CompetitorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lang, setLang } = useLanguage(searchParams.get('lang'));
  const [detail, setDetail] = useState<CompetitorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogs, setShowLogs] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<'helpful' | 'neutral' | 'unhelpful' | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackState, setFeedbackState] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  const targetName = searchParams.get('target') || '';
  const analyzeQuery = searchParams.get('q') || '';
  const competitor: Competitor = {
    name: searchParams.get('name') || '',
    website: searchParams.get('website') || '',
    startingPrice: searchParams.get('price') || '',
    bestFor: searchParams.get('bestFor') || '',
    positioning: searchParams.get('positioning') || '',
    country: searchParams.get('country') || '',
    features: [],
  };
  const logs = useMemo(() => detail?.logs || [], [detail?.logs]);

  useEffect(() => {
    let isActive = true;

    if (!targetName || !competitor.name) {
      setError('Competitor detail is not available.');
      setLoading(false);
      return () => {
        isActive = false;
      };
    }

    setLoading(true);
    setError(null);

    getCompetitorDetail(targetName, competitor, lang)
      .then((nextDetail) => {
        if (!isActive) return;
        setDetail(nextDetail);
        setLoading(false);
      })
      .catch((detailError) => {
        if (!isActive) return;
        setError(detailError instanceof Error ? detailError.message : 'Competitor detail could not be loaded.');
        setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [targetName, competitor.name, competitor.website, competitor.country, competitor.startingPrice, competitor.bestFor, competitor.positioning, lang]);

  function buildBackUrl() {
    if (!analyzeQuery) {
      return `/analyze?lang=${lang}`;
    }

    return `/analyze?q=${encodeURIComponent(analyzeQuery)}&lang=${lang}`;
  }

  function buildSelfUrl(nextLang: 'en' | 'zh') {
    const params = new URLSearchParams(searchParams);
    params.set('lang', nextLang);
    return `/competitor?${params.toString()}`;
  }

  async function handleSubmitFeedback() {
    if (!feedbackRating || feedbackState === 'submitting' || feedbackState === 'submitted') return;
    setFeedbackState('submitting');
    try {
      await submitFeedback({
        query: analyzeQuery || competitor.name || '[competitor-detail]',
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
            <LanguageToggle lang={lang} onToggle={(nextLang) => {
              setLang(nextLang);
              navigate(buildSelfUrl(nextLang));
            }} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {logs.length ? (
              <button
                type="button"
                onClick={() => setShowLogs(true)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black"
              >
                {lang === 'zh' ? '查看运行日志' : 'View logs'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowContactModal(true)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black"
            >
              {lang === 'zh' ? '联系作者' : 'Contact author'}
            </button>
            <button
              type="button"
              onClick={() => setShowFeedbackModal(true)}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-black"
            >
              {lang === 'zh' ? '反馈结果' : 'Give feedback'}
            </button>
            <Link
              to={buildBackUrl()}
              className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white"
            >
              {lang === 'zh' ? '返回分析结果' : 'Back to analysis'}
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="space-y-6">
            <section className="rounded-[1.1rem] border border-black/8 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium tracking-[-0.01em] text-black">
                  {lang === 'zh' ? '运行日志' : 'Run logs'}
                </h2>
                <span className="text-xs text-black/45">{lang === 'zh' ? '实时更新' : 'Live'}</span>
              </div>
              <div className="mt-3 rounded-[0.9rem] bg-[#fafafa] p-3">
                <div className="space-y-2 font-mono text-xs leading-6 text-black/65">
                  <p>{lang === 'zh' ? '0s  竞品详情分析已开始。' : '0s  Competitor detail analysis started.'}</p>
                  <p>{lang === 'zh' ? '0s  正在抓取竞品官网页面。' : '0s  Crawling competitor website.'}</p>
                </div>
              </div>
            </section>
            <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
              <div className="h-8 w-52 animate-pulse rounded bg-neutral-100" />
              <div className="mt-3 h-4 w-28 animate-pulse rounded bg-neutral-100" />
              <div className="mt-5 h-4 w-full animate-pulse rounded bg-neutral-100" />
              <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-neutral-100" />
            </section>
            <div className="grid gap-6 md:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <section key={item} className="rounded-[1.25rem] border border-black/8 bg-white p-5">
                  <div className="h-5 w-36 animate-pulse rounded bg-neutral-100" />
                  <div className="mt-4 h-4 w-full animate-pulse rounded bg-neutral-100" />
                  <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-neutral-100" />
                </section>
              ))}
            </div>
          </div>
        ) : error ? (
          <section className="rounded-[1.25rem] border border-red-200 bg-white p-5">
            <p className="text-sm text-red-600">{error}</p>
          </section>
        ) : detail ? (
          <div className="space-y-6">
            <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <SiteLogo
                      name={detail.competitor.name}
                      website={detail.competitor.website}
                      logo={detail.competitor.logo}
                      containerClassName="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/8 bg-white"
                      imgClassName="h-6 w-6 object-contain"
                    />
                    <div className="min-w-0">
                      <h1 className="break-words text-2xl font-medium tracking-[-0.03em] text-black md:text-[2rem]">
                        {detail.competitor.name}
                      </h1>
                      <a href={detail.competitor.website} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-sm text-black/55 underline decoration-black/20 underline-offset-4">
                        {detail.competitor.website}
                      </a>
                    </div>
                  </div>
                  {targetName ? (
                    <p className="mt-4 text-sm text-black/52">
                      {lang === 'zh' ? `当前正在与 ${targetName} 对比` : `Currently compared with ${targetName}`}
                    </p>
                  ) : null}
                  <p className="mt-4 max-w-3xl text-[15px] leading-7 text-black/70">{detail.competitor.positioning}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/8 bg-white px-3 text-xs text-black/60">
                    {getCountryFlag(detail.competitor.country) ? <span aria-hidden="true">{getCountryFlag(detail.competitor.country)}</span> : null}
                    <span>{detail.competitor.country}</span>
                  </span>
                  <span className="inline-flex h-8 items-center rounded-full border border-black/8 bg-white px-3 text-xs text-black/60">
                    {detail.competitor.startingPrice}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
              <div className="grid gap-6 md:grid-cols-[1fr,0.9fr]">
                <section>
                  <h2 className="text-lg font-medium tracking-[-0.02em] text-black">
                    {lang === 'zh' ? '核心能力' : 'Key capabilities'}
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.keyCapabilities.map((feature) => (
                      <span key={feature} className="rounded-full border border-black/8 bg-[#fcfcfc] px-3 py-1.5 text-xs text-black/68">
                        {feature}
                      </span>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-medium tracking-[-0.02em] text-black">
                    {lang === 'zh' ? '适合对象' : 'Best for'}
                  </h2>
                  <p className="mt-3 text-[15px] leading-7 text-black/70">{detail.competitor.bestFor}</p>
                </section>
              </div>
            </section>

            <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
              <h2 className="text-lg font-medium tracking-[-0.02em] text-black">
                {lang === 'zh' ? '为何是这个竞品' : 'Why this competitor'}
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-black/70">{detail.whyRelevant}</p>
            </section>

            <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-black">
                {lang === 'zh' ? '对比目标产品' : 'Compared with target'}
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <section className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                  <p className="text-sm font-semibold tracking-[-0.01em] text-black">{lang === 'zh' ? '对比' : 'Overlap'}</p>
                  <p className="mt-3 text-sm leading-7 text-black/70">{detail.overlapWithTarget}</p>
                </section>
                <section className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                  <p className="text-sm font-semibold tracking-[-0.01em] text-black">{lang === 'zh' ? '优势' : 'Strengths'}</p>
                  <p className="mt-3 text-sm leading-7 text-black/70">{detail.strongerIn}</p>
                </section>
                <section className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                  <p className="text-sm font-semibold tracking-[-0.01em] text-black">{lang === 'zh' ? '劣势 / 可被超越之处' : 'Weaknesses / target edge'}</p>
                  <p className="mt-3 text-sm leading-7 text-black/70">{detail.targetDifferentiation}</p>
                </section>
              </div>
            </section>

            <div className="grid gap-6 md:grid-cols-[1fr,0.9fr]">
              <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
                <h2 className="text-lg font-medium tracking-[-0.02em] text-black">
                  {lang === 'zh' ? '公司信号' : 'Company signals'}
                </h2>
                <div className="mt-4 space-y-3 text-sm text-black/70">
                  {detail.companySignals.fundingStage ? <p><span className="text-black/45">{lang === 'zh' ? '融资阶段' : 'Funding stage'}:</span> {detail.companySignals.fundingStage}</p> : null}
                  {detail.companySignals.totalFunding ? <p><span className="text-black/45">{lang === 'zh' ? '累计融资' : 'Total funding'}:</span> {detail.companySignals.totalFunding}</p> : null}
                  {detail.companySignals.latestRound ? <p><span className="text-black/45">{lang === 'zh' ? '最近一轮' : 'Latest round'}:</span> {detail.companySignals.latestRound}</p> : null}
                  {!detail.companySignals.fundingStage && !detail.companySignals.totalFunding && !detail.companySignals.latestRound ? (
                    <p className="text-black/45">{lang === 'zh' ? '暂无明确融资信息。' : 'No clear funding signals were returned.'}</p>
                  ) : null}
                </div>
              </section>
            </div>

            {detail.searchEvidence?.length ? (
              <section className="rounded-[1.25rem] border border-black/8 bg-white p-5">
                <h2 className="text-lg font-medium tracking-[-0.02em] text-black">
                  {lang === 'zh' ? '证据来源' : 'Evidence'}
                </h2>
                <div className="mt-4 space-y-3">
                  {detail.searchEvidence.map((item, index) => (
                    <article key={`${item.url}-${index}`} className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                      <p className="text-sm font-medium text-black">{item.title || item.url}</p>
                      <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-sm text-black/55 underline decoration-black/20 underline-offset-4">
                        {item.url}
                      </a>
                      <p className="mt-3 text-sm leading-6 text-black/68">{item.content}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
      {showLogs && logs.length ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={() => setShowLogs(false)}>
          <div
            className="w-full max-w-2xl rounded-[1.25rem] bg-white p-5 shadow-[0_20px_80px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-medium tracking-[-0.02em] text-black">
                {lang === 'zh' ? '运行日志' : 'Run logs'}
              </h2>
              <button
                type="button"
                onClick={() => setShowLogs(false)}
                className="inline-flex h-9 items-center justify-center rounded-full border border-black/10 px-4 text-sm text-black/70"
              >
                {lang === 'zh' ? '关闭' : 'Close'}
              </button>
            </div>
            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-[1rem] bg-[#fafafa] p-4">
              <div className="space-y-2 font-mono text-xs leading-6 text-black/65">
                {logs.map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showContactModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowContactModal(false)}>
          <div className="w-full max-w-[560px] rounded-[1.25rem] border border-black/8 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{lang === 'zh' ? '联系作者' : 'Contact author'}</p>
                <h2 className="mt-2 text-lg font-medium tracking-[-0.02em] text-black">{lang === 'zh' ? '欢迎直接联系我' : 'Reach out directly'}</h2>
              </div>
              <button type="button" onClick={() => setShowContactModal(false)} className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-black/10 px-4 text-sm text-black/70">
                {lang === 'zh' ? '关闭' : 'Close'}
              </button>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-[1fr,220px] md:items-start">
              <div className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{lang === 'zh' ? '邮箱' : 'Email'}</p>
                <a href="mailto:dongxuny@gmail.com" className="mt-2 inline-block break-all text-base font-medium text-black underline decoration-black/15 underline-offset-4">dongxuny@gmail.com</a>
              </div>
              <div className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{lang === 'zh' ? '微信' : 'WeChat'}</p>
                <img src="/wechat-qr.png" alt={lang === 'zh' ? '微信二维码' : 'WeChat QR code'} className="mt-3 w-full rounded-[0.85rem] border border-black/8 bg-white object-contain" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showFeedbackModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setShowFeedbackModal(false)}>
          <div className="w-full max-w-[640px] rounded-[1.25rem] border border-black/8 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">{lang === 'zh' ? '反馈' : 'Feedback'}</p>
                <h2 className="mt-2 text-lg font-medium tracking-[-0.02em] text-black">{lang === 'zh' ? '这次结果有帮助吗？' : 'Was this result helpful?'}</h2>
              </div>
              <button type="button" onClick={() => setShowFeedbackModal(false)} className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-black/10 px-4 text-sm text-black/70">
                {lang === 'zh' ? '关闭' : 'Close'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {[{ value: 'helpful' as const, label: lang === 'zh' ? '有帮助' : 'Helpful' }, { value: 'neutral' as const, label: lang === 'zh' ? '一般' : 'Neutral' }, { value: 'unhelpful' as const, label: lang === 'zh' ? '没帮助' : 'Unhelpful' }].map((option) => (
                <button key={option.value} type="button" onClick={() => { setFeedbackRating(option.value); if (feedbackState !== 'submitted') setFeedbackState('idle'); }} className={`inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium ${feedbackRating === option.value ? 'border-black bg-black text-white' : 'border-black/10 bg-white text-black'}`}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <textarea value={feedbackComment} onChange={(event) => { setFeedbackComment(event.target.value); if (feedbackState !== 'submitted') setFeedbackState('idle'); }} placeholder={lang === 'zh' ? '可选：告诉我哪里不对，或者哪里有帮助。' : 'Optional: tell me what was wrong, or what was helpful.'} className="min-h-[92px] w-full rounded-[1rem] border border-black/8 bg-[#fcfcfc] px-4 py-3 text-sm text-black outline-none placeholder:text-black/35" />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-black/50">
                {feedbackState === 'submitted' ? (lang === 'zh' ? '反馈已提交。' : 'Feedback submitted.') : feedbackState === 'error' ? (lang === 'zh' ? '提交失败，请稍后重试。' : 'Submission failed. Please try again.') : (lang === 'zh' ? '你的反馈会直接写入产品反馈表。' : 'Your feedback goes directly into the product feedback table.')}
              </p>
              <button type="button" onClick={() => { void handleSubmitFeedback(); }} disabled={!feedbackRating || feedbackState === 'submitting' || feedbackState === 'submitted'} className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-black/20">
                {feedbackState === 'submitting' ? (lang === 'zh' ? '提交中...' : 'Submitting...') : feedbackState === 'submitted' ? (lang === 'zh' ? '已提交' : 'Submitted') : (lang === 'zh' ? '提交反馈' : 'Submit feedback')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

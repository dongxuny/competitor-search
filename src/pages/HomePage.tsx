import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { InputForm } from '../components/InputForm';
import { LanguageToggle } from '../components/LanguageToggle';
import { useLanguage } from '../hooks/useLanguage';
import { t } from '../i18n';
import { requestAnalyzeIntent, submitFeedback } from '../lib/api';
import type { ProductInput } from '../types';

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lang, setLang } = useLanguage(searchParams.get('lang'));
  const prefilledQuery = searchParams.get('q')?.trim() ?? '';
  const [input, setInput] = useState<ProductInput>({ query: prefilledQuery });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<'helpful' | 'neutral' | 'unhelpful' | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackState, setFeedbackState] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  async function handleSubmit() {
    if (!input.query.trim()) {
      setError('Please enter a product URL or a product description.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const nextQuery = input.query.trim();
      const intent = await requestAnalyzeIntent(nextQuery, lang);
      navigate(`/analyze?q=${encodeURIComponent(nextQuery)}&lang=${lang}&intent=${encodeURIComponent(intent)}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'The analysis could not be started.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitFeedback() {
    if (!feedbackRating || feedbackState === 'submitting' || feedbackState === 'submitted') {
      return;
    }

    setFeedbackState('submitting');

    try {
      await submitFeedback({
        query: input.query.trim() || '[homepage]',
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
      <div className="mx-auto max-w-[860px]">
        <header className="mb-8 pt-8 text-center">
          <div className="mb-4 flex items-center justify-end gap-2">
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
              {lang === 'zh' ? '反馈产品' : 'Give feedback'}
            </button>
            <LanguageToggle lang={lang} onToggle={setLang} />
          </div>
          <p className="mb-4 text-sm font-medium tracking-[-0.01em] text-black/42">{t(lang, 'appName')}</p>
          <h1 className="mx-auto max-w-[760px] text-3xl font-semibold leading-[1.12] tracking-[-0.04em] text-black md:text-[3.35rem] md:leading-[1.08]">
            {t(lang, 'homeTitle')}
          </h1>
          <p className="mx-auto mt-2.5 max-w-[700px] text-sm text-black/50 md:text-[15px]">
            {t(lang, 'homeDescription')}
          </p>
        </header>

        <section className="space-y-4">
          <InputForm
            lang={lang}
            value={input}
            error={error}
            isSubmitting={isSubmitting}
            onChange={(next) => {
              setInput(next);
              if (error) {
                setError(null);
              }
            }}
            onSubmit={handleSubmit}
          />
        </section>
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
                <a
                  href="mailto:dongxuny@gmail.com"
                  className="mt-2 inline-block break-all text-base font-medium text-black underline decoration-black/15 underline-offset-4"
                >
                  dongxuny@gmail.com
                </a>
              </div>
              <div className="rounded-[1rem] border border-black/8 bg-[#fcfcfc] p-4">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
                  {lang === 'zh' ? '微信' : 'WeChat'}
                </p>
                <img
                  src="/wechat-qr.png"
                  alt={lang === 'zh' ? '微信二维码' : 'WeChat QR code'}
                  className="mt-3 w-full rounded-[0.85rem] border border-black/8 bg-white object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {showFeedbackModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setShowFeedbackModal(false)}
        >
          <div
            className="w-full max-w-[640px] rounded-[1.25rem] border border-black/8 bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-black/40">
                  {lang === 'zh' ? '反馈' : 'Feedback'}
                </p>
                <h2 className="mt-2 text-lg font-medium tracking-[-0.02em] text-black">
                  {lang === 'zh' ? '你觉得这个产品怎么样？' : 'What do you think about this product?'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-black/10 px-4 text-sm text-black/70"
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
                placeholder={lang === 'zh' ? '可选：告诉我你想要什么，或者哪里需要改进。' : 'Optional: tell me what you want, or what should be improved.'}
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
    </main>
  );
}

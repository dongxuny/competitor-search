import type { AppLanguage } from '../i18n';
import type { AnalysisJobStatus, Competitor, CompetitorDetail } from '../types';

interface StartAnalyzeResponse {
  jobId: string;
}

const inFlightAnalyzeStarts = new Map<string, Promise<string>>();

function getErrorMessage(data: unknown, fallback: string) {
  return typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string'
    ? data.error
    : fallback;
}

export async function startAnalyzeQuery(query: string, lang: AppLanguage): Promise<string> {
  const key = `${lang}::${query.trim().toLowerCase()}`;
  const existing = inFlightAnalyzeStarts.get(key);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const response = await fetch('/api/analyze/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, lang }),
    });

    let data: unknown;

    try {
      data = await response.json();
    } catch {
      throw new Error('The analysis service returned an invalid response.');
    }

    if (!response.ok) {
      throw new Error(getErrorMessage(data, 'The analysis could not be started.'));
    }

    return (data as StartAnalyzeResponse).jobId;
  })();

  inFlightAnalyzeStarts.set(key, request);

  try {
    return await request;
  } finally {
    inFlightAnalyzeStarts.delete(key);
  }
}

export async function getAnalyzeJob(jobId: string): Promise<AnalysisJobStatus> {
  const response = await fetch(`/api/analyze/${jobId}`);

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error('The analysis service returned an invalid response.');
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, 'The analysis status could not be loaded.'));
  }

  return data as AnalysisJobStatus;
}

interface CompetitorDetailResponse {
  detail: CompetitorDetail;
}

interface SubmitFeedbackInput {
  query: string;
  rating: 'helpful' | 'neutral' | 'unhelpful';
  comment?: string;
}

export async function getCompetitorDetail(
  targetName: string,
  competitor: Competitor,
  lang: AppLanguage,
): Promise<CompetitorDetail> {
  const response = await fetch('/api/competitor-detail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetName,
      competitor,
      lang,
    }),
  });

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error('The competitor detail service returned an invalid response.');
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, 'The competitor detail could not be generated.'));
  }

  return (data as CompetitorDetailResponse).detail;
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<void> {
  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error('The feedback service returned an invalid response.');
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, 'The feedback could not be submitted.'));
  }
}

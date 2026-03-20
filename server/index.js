import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMockAnalysis } from './mockData.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = resolve(__dirname, '../dist');
const distIndexPath = resolve(distDir, 'index.html');
const hasDistBuild = existsSync(distIndexPath);
const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
const COMPETITOR_COUNT = Math.min(10, Math.max(3, Number(process.env.COMPETITOR_COUNT || 4)));
const CRAWL_COMPETITOR_COUNT = 5;
const MAX_PAGES_PER_SITE = 5;
const SEARCH_TIMEOUT_MS = Number(process.env.SEARCH_TIMEOUT_MS || 5000);
const PAGE_FETCH_TIMEOUT_MS = Number(process.env.PAGE_FETCH_TIMEOUT_MS || 5000);
const METADATA_FETCH_TIMEOUT_MS = Number(process.env.METADATA_FETCH_TIMEOUT_MS || 3500);
const BROWSER_SEARCH_TIMEOUT_MS = Number(process.env.BROWSER_SEARCH_TIMEOUT_MS || 8000);
const tavilyApiKey = process.env.TAVILY_API_KEY || '';
const bochaApiKey = process.env.BOCHA_API_KEY || '';
const serperApiKey = process.env.SERPER_API_KEY || '';
const searchProvider = (process.env.SEARCH_PROVIDER || '').toLowerCase();
const searxngBaseUrl = process.env.SEARXNG_BASE_URL || '';
const bochaBaseUrl = process.env.BOCHA_BASE_URL || 'https://api.bocha.cn';
const serperBaseUrl = process.env.SERPER_BASE_URL || 'https://google.serper.dev';
const officialSiteBrowserEngine = (process.env.OFFICIAL_SITE_BROWSER_ENGINE || 'bing').toLowerCase();
const feishuAppId = process.env.FEISHU_APP_ID || '';
const feishuAppSecret = process.env.FEISHU_APP_SECRET || '';
const feishuBitableAppToken = process.env.FEISHU_BITABLE_APP_TOKEN || '';
const feishuBitableTableId = process.env.FEISHU_BITABLE_TABLE_ID || '';
const jobs = new Map();
let feishuTenantAccessToken = '';
let feishuTenantAccessTokenExpiresAt = 0;

const STEP_IDS = {
  understand: 'understand',
  search: 'search',
  analyze: 'analyze',
} ;

app.use(cors());
app.use(express.json());

if (hasDistBuild) {
  app.use(express.static(distDir));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getFeishuTenantAccessToken() {
  const now = Date.now();
  if (feishuTenantAccessToken && now < feishuTenantAccessTokenExpiresAt - 60_000) {
    return feishuTenantAccessToken;
  }

  if (!feishuAppId || !feishuAppSecret) {
    throw new Error('Feishu app credentials are not configured.');
  }

  const response = await fetchWithTimeout('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: feishuAppId,
      app_secret: feishuAppSecret,
    }),
  }, 5000);

  const data = await response.json();
  if (!response.ok || data?.code !== 0 || !data?.tenant_access_token) {
    throw new Error(data?.msg || 'Failed to obtain Feishu tenant access token.');
  }

  feishuTenantAccessToken = data.tenant_access_token;
  feishuTenantAccessTokenExpiresAt = now + (Number(data.expire) || 7200) * 1000;
  return feishuTenantAccessToken;
}

async function createFeishuBitableRecord(fields) {
  if (!feishuBitableAppToken || !feishuBitableTableId) {
    throw new Error('Feishu bitable target is not configured.');
  }

  const tenantAccessToken = await getFeishuTenantAccessToken();
  const response = await fetchWithTimeout(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${feishuBitableAppToken}/tables/${feishuBitableTableId}/records`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantAccessToken}`,
      },
      body: JSON.stringify({
        fields,
      }),
    },
    5000,
  );

  const data = await response.json();
  if (!response.ok || data?.code !== 0) {
    throw new Error(data?.msg || 'Failed to create Feishu bitable record.');
  }
}

function createClient() {
  if (provider === 'deepseek') {
    if (!process.env.DEEPSEEK_API_KEY) {
      return null;
    }

    return new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    });
  }

  if (provider === 'kimi') {
    if (!process.env.MOONSHOT_API_KEY) {
      return null;
    }

    return new OpenAI({
      apiKey: process.env.MOONSHOT_API_KEY,
      baseURL: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1',
    });
  }

  if (provider === 'qwen') {
    if (!process.env.DASHSCOPE_API_KEY) {
      return null;
    }

    return new OpenAI({
      apiKey: process.env.DASHSCOPE_API_KEY,
      baseURL: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function resolveModel() {
  if (provider === 'deepseek') {
    return process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  }

  if (provider === 'kimi') {
    return process.env.MOONSHOT_MODEL || 'moonshot-v1-8k';
  }

  if (provider === 'qwen') {
    return process.env.QWEN_MODEL || 'qwen-plus';
  }

  return process.env.OPENAI_MODEL || 'gpt-5';
}

const client = createClient();

const briefSchema = {
  name: 'competitor_search_brief',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'targetName',
      'productSummary',
      'marketPreference',
      'category',
      'subCategory',
      'targetUsers',
      'keyFeatures',
      'competitorHints',
      'competitorCandidates',
      'confidence',
      'enoughInformation',
      'reasoningNotes',
    ],
    properties: {
      targetName: { type: 'string' },
      productSummary: { type: 'string' },
      marketPreference: {
        type: 'string',
        enum: ['china', 'global', 'unknown'],
      },
      category: { type: 'string' },
      subCategory: { type: 'string' },
      targetUsers: {
        type: 'array',
        items: { type: 'string' },
      },
      keyFeatures: {
        type: 'array',
        items: { type: 'string' },
      },
      competitorHints: { type: 'string' },
      competitorCandidates: {
        type: 'array',
        maxItems: CRAWL_COMPETITOR_COUNT,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'website'],
          properties: {
            name: { type: 'string' },
            website: { type: 'string' },
          },
        },
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
      },
      enoughInformation: { type: 'boolean' },
      reasoningNotes: {
        type: 'string',
      },
    },
  },
  strict: true,
};

const discoverySchema = {
  name: 'product_discovery_bundle',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'targetName',
      'productSummary',
      'category',
      'subCategory',
      'targetUsers',
      'keyFeatures',
      'competitorHints',
      'competitorCandidates',
      'confidence',
      'enoughInformation',
      'reasoningNotes',
      'target',
      'competitors',
    ],
    properties: {
      targetName: { type: 'string' },
      productSummary: { type: 'string' },
      category: { type: 'string' },
      subCategory: { type: 'string' },
      targetUsers: {
        type: 'array',
        items: { type: 'string' },
      },
      keyFeatures: {
        type: 'array',
        items: { type: 'string' },
      },
      competitorHints: { type: 'string' },
      competitorCandidates: {
        type: 'array',
        maxItems: CRAWL_COMPETITOR_COUNT,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'website'],
          properties: {
            name: { type: 'string' },
            website: { type: 'string' },
          },
        },
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
      },
      enoughInformation: { type: 'boolean' },
      reasoningNotes: {
        type: 'string',
      },
      target: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'website', 'positioning'],
        properties: {
          name: { type: 'string' },
          website: { type: 'string' },
          positioning: { type: 'string' },
        },
      },
      competitors: {
        type: 'array',
        minItems: 3,
        maxItems: CRAWL_COMPETITOR_COUNT,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'website', 'positioning'],
          properties: {
            name: { type: 'string' },
            website: { type: 'string' },
            positioning: { type: 'string' },
          },
        },
      },
    },
  },
  strict: true,
};

const routingDecisionSchema = {
  name: 'analysis_routing_decision',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['inputKind', 'coreEntity', 'entityType', 'hasReliableKnowledge', 'shouldSearchOfficialSite', 'policyDecision', 'policyReason', 'confidence', 'reason', 'targetNameGuess'],
    properties: {
      inputKind: {
        type: 'string',
        enum: ['url', 'brand_query', 'category_query', 'product_description', 'similar_query', 'unclear_query'],
      },
      coreEntity: { type: 'string' },
      entityType: {
        type: 'string',
        enum: ['brand', 'product', 'category', 'unknown'],
      },
      hasReliableKnowledge: { type: 'boolean' },
      shouldSearchOfficialSite: { type: 'boolean' },
      policyDecision: {
        type: 'string',
        enum: ['allow', 'block'],
      },
      policyReason: { type: 'string' },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
      },
      reason: { type: 'string' },
      targetNameGuess: { type: 'string' },
    },
  },
  strict: true,
};

const candidateDiscoverySchema = {
  name: 'candidate_competitor_seeds',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['target', 'competitors'],
    properties: {
      target: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'website', 'positioning'],
        properties: {
          name: { type: 'string' },
          website: { type: 'string' },
          positioning: { type: 'string' },
        },
      },
      competitors: {
        type: 'array',
        minItems: 3,
        maxItems: CRAWL_COMPETITOR_COUNT,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'website', 'positioning'],
          properties: {
            name: { type: 'string' },
            website: { type: 'string' },
            positioning: { type: 'string' },
          },
        },
      },
    },
  },
  strict: true,
};

const analysisSchema = {
  name: 'competitor_analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['target', 'competitors', 'summary'],
    properties: {
      target: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'positioning', 'features'],
        properties: {
          name: { type: 'string' },
          positioning: { type: 'string' },
          features: {
            type: 'array',
            minItems: 3,
            maxItems: 6,
            items: { type: 'string' },
          },
        },
      },
      competitors: {
        type: 'array',
        minItems: COMPETITOR_COUNT,
        maxItems: COMPETITOR_COUNT,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'website', 'startingPrice', 'bestFor', 'positioning', 'country'],
          properties: {
            name: { type: 'string' },
            website: { type: 'string' },
            startingPrice: { type: 'string' },
            bestFor: { type: 'string' },
            positioning: { type: 'string' },
            country: { type: 'string' },
          },
        },
      },
      summary: { type: 'string' },
    },
  },
  strict: true,
};

const unifiedAnalysisSchema = {
  name: 'unified_competitor_analysis',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['brief', 'candidateSeeds', 'analysis'],
    properties: {
      brief: briefSchema.schema,
      candidateSeeds: {
        type: 'object',
        additionalProperties: false,
        required: ['target', 'competitors'],
        properties: {
          target: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'website', 'positioning'],
            properties: {
              name: { type: 'string' },
              website: { type: 'string' },
              positioning: { type: 'string' },
            },
          },
          competitors: {
            type: 'array',
            minItems: 3,
            maxItems: CRAWL_COMPETITOR_COUNT,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'website', 'positioning'],
              properties: {
                name: { type: 'string' },
                website: { type: 'string' },
                positioning: { type: 'string' },
              },
            },
          },
        },
      },
      analysis: analysisSchema.schema,
    },
  },
  strict: true,
};

const competitorDetailSchema = {
  name: 'competitor_detail',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'whyRelevant',
      'overlapWithTarget',
      'strongerIn',
      'targetDifferentiation',
      'keyCapabilities',
      'companySignals',
    ],
    properties: {
      whyRelevant: { type: 'string' },
      overlapWithTarget: { type: 'string' },
      strongerIn: { type: 'string' },
      targetDifferentiation: { type: 'string' },
      keyCapabilities: {
        type: 'array',
        minItems: 3,
        maxItems: 6,
        items: { type: 'string' },
      },
      companySignals: {
        type: 'object',
        additionalProperties: false,
        properties: {
          fundingStage: { type: 'string' },
          totalFunding: { type: 'string' },
          latestRound: { type: 'string' },
        },
        required: [],
      },
    },
  },
  strict: true,
};

const featureExtractionSchema = {
  name: 'target_feature_extraction',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['features'],
    properties: {
      features: {
        type: 'array',
        minItems: 0,
        maxItems: 6,
        items: { type: 'string' },
      },
    },
  },
  strict: true,
};

function normalizeInput(body) {
  return {
    query: typeof body?.query === 'string' ? body.query.trim() : '',
    lang: body?.lang === 'zh' ? 'zh' : 'en',
  };
}

function buildInitialSteps(lang) {
  return [
    {
      id: STEP_IDS.understand,
      label: lang === 'zh' ? '分析需求' : 'Understanding input',
      status: 'pending',
      startedAt: null,
      completedAt: null,
    },
    {
      id: STEP_IDS.search,
      label: lang === 'zh' ? '搜索外部证据' : 'Searching evidence',
      status: 'pending',
      startedAt: null,
      completedAt: null,
    },
    {
      id: STEP_IDS.analyze,
      label: lang === 'zh' ? '生成竞品分析' : 'Generating analysis',
      status: 'pending',
      startedAt: null,
      completedAt: null,
    },
  ];
}

function createJob(input) {
  const jobId = randomUUID();
  const job = {
    id: jobId,
    status: 'running',
    error: null,
    result: null,
    partialResult: null,
    steps: buildInitialSteps(input.lang),
    logs: [],
    createdAt: Date.now(),
  };

  jobs.set(jobId, job);
  return job;
}

function appendJobLog(job, message) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - job.createdAt) / 1000));
  const prefix = `${elapsedSeconds}s`;
  job.logs = [...job.logs, `${prefix}  ${message}`].slice(-80);
}

function updateJobStep(job, stepId, status) {
  const now = Date.now();
  job.steps = job.steps.map((step) => (
    step.id === stepId
      ? {
        ...step,
        status,
        startedAt: status === 'running' && !step.startedAt ? now : step.startedAt,
        completedAt: status === 'completed' || status === 'failed' ? now : step.completedAt,
      }
      : step
  ));
}

function setJobPartialResult(job, partialResult) {
  job.partialResult = partialResult;
}

function completeJob(job, result) {
  job.status = 'completed';
  job.result = {
    ...result,
    logs: job.logs,
  };
  job.partialResult = job.result;
}

function failJob(job, errorMessage) {
  job.status = 'failed';
  job.error = errorMessage;
}

function formatUsageLog(kind, usage, lang) {
  if (!usage) return '';

  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? (inputTokens + outputTokens));
  if (!inputTokens && !outputTokens && !totalTokens) return '';

  const labels = {
    route: lang === 'zh' ? '路由判断' : 'Routing',
    brief: lang === 'zh' ? '目标理解' : 'Target understanding',
    discovery: lang === 'zh' ? '目标理解与竞品发现' : 'Target understanding and discovery',
    candidate: lang === 'zh' ? '竞品发现' : 'Competitor discovery',
    unified: lang === 'zh' ? '目标理解、竞品发现与竞品分析' : 'Target understanding, discovery, and analysis',
    feature: lang === 'zh' ? '功能提取' : 'Feature extraction',
    analysis: lang === 'zh' ? '竞品分析' : 'Final analysis',
    detail: lang === 'zh' ? '竞品详情' : 'Competitor detail',
  };

  return lang === 'zh'
    ? `${labels[kind] || kind} tokens：输入 ${inputTokens} / 输出 ${outputTokens} / 总计 ${totalTokens}`
    : `${labels[kind] || kind} tokens: input ${inputTokens} / output ${outputTokens} / total ${totalTokens}`;
}

function parseQuery(query, lang) {
  const trimmed = query.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);
  const normalizedUrl = isUrl ? normalizeInputUrl(trimmed) : '';

  return {
    query: trimmed,
    url: normalizedUrl,
    description: isUrl ? '' : trimmed,
    lang,
  };
}

function shouldTriggerDemoError(query) {
  const haystack = query.toLowerCase();
  return haystack.includes('mock-error') || haystack.includes('error-demo') || haystack.includes('trigger error');
}

function cleanText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function extractTag(html, regex) {
  const match = html.match(regex);
  return match?.[1] ? cleanText(match[1]) : undefined;
}

function extractMetaContent(html, keys) {
  for (const key of keys) {
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["'][^>]*>`, 'i'),
    ];
    for (const pattern of patterns) {
      const value = extractTag(html, pattern);
      if (value) return value;
    }
  }
  return undefined;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html) {
  return cleanText(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    )
  );
}

function extractHeadings(html) {
  return [...html.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
    .slice(0, 6);
}

function extractSpecificHeadings(html, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  return [...html.matchAll(pattern)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
    .slice(0, tagName.toLowerCase() === 'h1' ? 2 : 6);
}

function extractExcerpt(html) {
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((text) => text.length >= 50)
    .slice(0, 3);
  return paragraphs.join(' ').slice(0, 420) || undefined;
}

async function fetchUrlMetadata(url) {
  if (!url) return null;

  try {
    const response = await fetchWithTimeout(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'AI-Competitor-Analyzer/1.0',
      },
    }, METADATA_FETCH_TIMEOUT_MS);

    if (!response.ok) return null;

    const html = await response.text();
    return {
      title: extractMetaContent(html, ['og:title', 'twitter:title']) || extractTag(html, /<title>([^<]+)<\/title>/i),
      description: extractMetaContent(html, ['description', 'og:description', 'twitter:description']) || extractExcerpt(html),
      domain: (() => {
        try {
          return new URL(url).hostname.replace('www.', '');
        } catch {
          return undefined;
        }
      })(),
      headings: extractHeadings(html),
      excerpt: extractExcerpt(html),
    };
  } catch {
    return null;
  }
}

function buildSourceText(input, payload) {
  const metadata = payload?.metadata || payload || {};
  const searchEvidence = Array.isArray(payload?.searchEvidence) ? payload.searchEvidence : [];

  const base = input.url
    ? `User input URL: ${input.url}
User input description: ${input.description || 'N/A'}
Fetched title: ${metadata?.title || 'N/A'}
Fetched description: ${metadata?.description || 'N/A'}
Fetched domain: ${metadata?.domain || 'N/A'}
Fetched headings: ${metadata?.headings?.join(' | ') || 'N/A'}
Fetched excerpt: ${metadata?.excerpt || 'N/A'}`
    : `User input text: ${input.description}`;

  if (!searchEvidence.length) {
    return base;
  }

  return `${base}

Crawled website evidence:
${buildSearchEvidenceText(searchEvidence)}`;
}

function buildSearchEvidenceText(searchEvidence) {
  if (!Array.isArray(searchEvidence) || !searchEvidence.length) {
    return 'Search evidence: none';
  }

  return [
    'Search evidence:',
    ...searchEvidence.map((item, index) => [
      `Result ${index + 1}:`,
      `- query: ${item.query}`,
      `- site kind: ${item.siteKind || 'N/A'}`,
      `- site name: ${item.siteName || 'N/A'}`,
      `- page type: ${item.pageType || 'N/A'}`,
      `- title: ${item.title || 'N/A'}`,
      `- meta description: ${item.metaDescription || 'N/A'}`,
      `- h1: ${Array.isArray(item.h1) && item.h1.length ? item.h1.join(' | ') : 'N/A'}`,
      `- h2: ${Array.isArray(item.h2) && item.h2.length ? item.h2.join(' | ') : 'N/A'}`,
      `- h3: ${Array.isArray(item.h3) && item.h3.length ? item.h3.join(' | ') : 'N/A'}`,
      `- url: ${item.url || 'N/A'}`,
      `- snippet: ${item.snippet || item.content || 'N/A'}`,
    ].join('\n')),
  ].join('\n');
}

function buildCandidateDiscoveryPrompt(input, payload) {
  const { brief, metadata, searchEvidence } = payload;

  return [
    'You are selecting target and competitor website seeds for a product intelligence pipeline.',
    'Do not write a final competitor analysis.',
    input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
    'Return only valid JSON.',
    'Your task is to identify the target product website and the 5 most relevant competitor websites to crawl next.',
    'First use the target summary and crawled target-site evidence to understand the category and workflow.',
    'Then pick direct competitors from that category.',
    'Use the target brand name whenever possible.',
    'Use official product or company websites, not review sites, directories, social profiles, or marketplaces.',
    'Prefer direct competitors in the same workflow and category.',
    'If the exact target website is unclear, use an empty string for target.website rather than inventing a domain.',
    'Each competitor.website must be a fully qualified HTTPS URL when known.',
    'Keep positioning concise and grounded.',
    '',
    `Competitor search brief:
${JSON.stringify(brief, null, 2)}`,
    '',
    buildSourceText(input, { metadata, searchEvidence }),
  ].join('\n');
}

function buildDiscoveryPrompt(input, payload) {
  const metadata = payload?.metadata || {};
  const canonicalBrandHint = [
    asString(metadata?.title, '').split('|')[0].trim(),
    asString(metadata?.domain, ''),
  ].filter(Boolean)[0] || '';

  return [
    'You are a product understanding and competitor-discovery engine.',
    'Do not write a final competitor analysis.',
    input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
    'Return only valid JSON.',
    'Your task is to understand the target product and identify the most relevant competitor website seeds to analyze next.',
    'Base your answer on the fetched webpage evidence and crawled website evidence whenever available.',
    'Do not compress a full brand name into a shorter nickname unless the website clearly uses the short form as the primary product name.',
    canonicalBrandHint ? `Preserve the official brand casing when possible. Likely brand hint: ${canonicalBrandHint}` : '',
    '',
    'You MUST infer:',
    '- targetName: product or brand name (not a generic category)',
    '- productSummary: what the product does (2-3 sentences)',
    '- category: the most useful market category for competitor discovery',
    '- subCategory: a narrower workflow or specialization inside that category',
    '- targetUsers: who it serves',
    '- keyFeatures: 3-6 high-level capabilities (no fake details)',
    '- competitorHints: what kind of competitors should be found (short phrase)',
    '- competitorCandidates: optional lightweight hints, and only if clearly supported',
    '- enoughInformation: whether we have enough info to proceed',
    '- target: canonical target website seed',
    `- competitors: the ${CRAWL_COMPETITOR_COUNT} most relevant competitor website seeds to analyze next`,
    '',
    'Selection rules:',
    '- Use official product or company websites, not review sites, directories, social profiles, or marketplaces.',
    '- Prefer direct competitors in the same workflow and category.',
    '- If the exact target website is unclear, use an empty string for target.website rather than inventing a domain.',
    '- Each competitor.website must be a fully qualified HTTPS URL when known.',
    '- Keep target.positioning and competitor.positioning concise and grounded.',
    '- If input is natural language, infer directly.',
    '- If input is a URL, use evidence in this order: pageTitle, metaDescription, headings, pageExcerpt, domainName.',
    '- Prefer the most specific defensible category from the evidence.',
    '- Do NOT output generic labels as targetName.',
    '- Do NOT hallucinate detailed features or pricing.',
    '- If uncertain, return fewer candidate hints instead of making them up.',
    '- Use target brand name whenever possible.',
    '',
    `Input evidence:
${buildSourceText(input, payload)}`,
  ].join('\n');
}

function buildRoutingPrompt(input, metadata) {
  return [
    'You are a lightweight routing engine for a product intelligence pipeline.',
    'Do NOT do full product analysis.',
    'Your only job is to decide whether the system can trust model knowledge directly or should first discover the official website.',
    input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
    'Return only valid JSON.',
    '',
    'Decide:',
    '- inputKind: url | brand_query | category_query | product_description | similar_query | unclear_query',
    '- coreEntity: the main product, brand, or category the user appears to be asking about',
    '- entityType: brand | product | category | unknown',
    '- hasReliableKnowledge: whether the model likely has enough reliable knowledge to skip official-site discovery',
    '- shouldSearchOfficialSite: whether the system should search for the official website before product understanding',
    '- policyDecision: allow | block',
    '- policyReason: one short category such as none, adult, gambling, drugs, violence, illegal, or unsupported',
    '- confidence: high | medium | low',
    '- reason: one short reason',
    '- targetNameGuess: the likely brand or product name if any',
    '',
    'Rules:',
    '- If the input is already a URL, set inputKind=url and shouldSearchOfficialSite=false.',
    '- If the input is a short brand/product name and there is no supporting description, prefer inputKind=brand_query.',
    '- If the input is mostly describing a type of product or workflow, prefer inputKind=category_query or product_description.',
    '- If the input is "similar to X", set inputKind=similar_query and identify X as coreEntity.',
    '- If the user input is vague natural language and you cannot tell whether the entity is a brand or category, use inputKind=unclear_query and entityType=unknown.',
    '- If the request appears to ask about clearly disallowed or illegal content categories, set policyDecision=block and provide a short policyReason.',
    '- If there is no clear policy issue, set policyDecision=allow and policyReason=none.',
    '- For brand_query inputs, only set hasReliableKnowledge=true if the product is widely known and you can reliably identify it from model knowledge alone.',
    '- If the input appears to refer to a brand/product name that may be unknown, set shouldSearchOfficialSite=true.',
    '- If the input is a product description or category query, usually set shouldSearchOfficialSite=false.',
    '- Be maximally honest.',
    '- If you do not reliably know the brand or product, say so through hasReliableKnowledge=false and shouldSearchOfficialSite=true.',
    '- Do not guess category, subcategory, or product details from the name alone.',
    '- Names containing words like cloud, data, flow, stack, hub, sync, or AI are not enough evidence by themselves.',
    '- Unknown means unknown. Do not approximate.',
    '',
    `Input evidence:
${buildSourceText(input, metadata)}`,
  ].join('\n');
}

function buildBriefPrompt(input, payload) {
  const metadata = payload?.metadata || {};
  const canonicalBrandHint = [
    asString(metadata?.title, '').split('|')[0].trim(),
    asString(metadata?.domain, ''),
  ].filter(Boolean)[0] || '';

  return [
    'You are a product understanding engine.',
    '',
    'Your task is NOT to perform full competitor analysis.',
    'Your task is to understand the target product well enough to support competitor discovery.',
    '',
    input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
    '',
    'The input may be:',
    '1. A URL with webpage evidence',
    '2. A natural-language product description',
    '3. A "find similar products" style query',
    '',
    'Your job is to produce a structured understanding of the target product.',
    'Base your answer on the fetched webpage evidence and crawled website evidence whenever available.',
    'Do not compress a full brand name into a shorter nickname unless the website clearly uses the short form as the primary product name.',
    canonicalBrandHint ? `Preserve the official brand casing when possible. Likely brand hint: ${canonicalBrandHint}` : '',
    '',
    'You MUST infer:',
    '- targetName: product or brand name (not a generic category)',
    '- productSummary: what the product does (2–3 sentences)',
    '- category: the most useful market category for competitor discovery',
    '- subCategory: a narrower workflow or specialization inside that category',
    '- targetUsers: who it serves',
    '- keyFeatures: 3–6 high-level capabilities (no fake details)',
    '- competitorHints: what kind of competitors should be found (short phrase)',
    '- competitorCandidates: optional, and only if clearly supported by the official-site evidence',
    '- enoughInformation: whether we have enough info to proceed',
    '',
    'Input interpretation rules:',
    '',
    'If input is a URL, use evidence in this order:',
    '1. pageTitle',
    '2. metaDescription',
    '3. headings',
    '4. pageExcerpt',
    '5. domainName',
    'Do NOT rely mainly on the domain unless necessary.',
    'Prefer the most specific defensible category from the evidence. Do not fall back to a broad category if a narrower category is clearly supported.',
    'If the evidence contains terms like FinOps, cloud cost management, cost optimization, anomaly detection, allocation, or multi-cloud cost visibility, prefer those narrower categories over generic "cloud service" labels.',
    'If the evidence contains both a short brand label and a fuller brand or company label, prefer the fuller stable product or brand name.',
    'Do not shorten a product name unless the website clearly uses the short name as the primary brand.',
    'If the official site domain or homepage title clearly contains the fuller brand name, prefer that brand name over a shorter product nickname used inside the page copy.',
    '',
    'If input is natural language, infer directly.',
    'If input is "similar to X", identify X and infer from it.',
    '',
    'Important constraints:',
    'targetName must be the product name or brand name, not a category label.',
    'Do NOT output generic labels as targetName.',
    'Do NOT hallucinate detailed features or pricing.',
    'Prefer broad but correct understanding over fake precision.',
    'category should be the market category that is most useful for finding direct competitors.',
    'Do not use overly broad umbrella labels like "cloud service", "marketing", or "software platform" if a narrower market category is clearly supported by the evidence.',
    'If FinOps, cloud cost management, influencer marketing platform, observability, or team knowledge management is clearly supported, prefer that as category.',
    'subCategory should only be used for a further specialization within the chosen category.',
    'competitorCandidates are optional in this step. Leave them empty if the evidence is not strong enough.',
    'If uncertain, return fewer competitors instead of making them up.',
    'keyFeatures must stay at the category or product-capability level. Do not invent implementation details.',
    'Prefer concrete capabilities taken from actual page sections, headings, or snippets.',
    'When pricing, features, solutions, or product pages are available, prioritize those pages over homepage slogans.',
    'Use headings and snippets from product, features, pricing, or solutions pages as the strongest evidence for keyFeatures.',
    'Do not assume H3 is always more important than H2. Use whichever headings most clearly describe concrete capabilities.',
    'Prefer specific capabilities like cost allocation, anomaly detection, budget management, usage visibility, tag management, creator discovery, campaign workflow, or audience analytics over broad labels like cloud optimization or efficiency improvement.',
    'Avoid marketing-value phrases like "efficiency improvement", "enterprise platform service", or "global ecosystem connection" unless they are the only supported evidence.',
    '',
    'Confidence control:',
    '- enoughInformation = true if category-level competitor discovery is possible',
    '- false only if input is too vague',
    '',
    'Set enoughInformation to true if there is enough signal to run a useful category-level competitor search.',
    'Set it to false only if the evidence is too weak to support even a broad competitor search.',
    '',
    'Return ONLY valid JSON.',
    'Do not include markdown.',
    'Do not include explanations outside JSON.',
    'reasoningNotes must be a short evidence-based note string, not chain-of-thought.',
    '',
    `Input evidence:
${buildSourceText(input, payload)}`,
  ].join('\n');
}

function buildAnalysisPrompt(input, payload) {
  const { brief, candidateSeeds } = payload;

  return [
    'You are a product analyst generating a competitor analysis result.',
    input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
    'Use the competitor search brief below as the source of truth.',
    'The brief already defines what kind of competitor search should happen next.',
    'Base the result primarily on category, subCategory, targetUsers, searchIntent, and competitorSearchQuery.',
    'Use the official website candidates below to refine target understanding and competitor selection.',
    'Prefer vertical direct competitors in the same workflow category over large adjacent platforms.',
    'Do not default to hyperscalers, horizontal suites, or infrastructure giants unless the target itself is clearly a broad cloud platform.',
    'If the target is a specialized SaaS tool, prioritize specialized SaaS competitors first.',
    'For FinOps or cloud cost management, prefer products such as dedicated cost management, optimization, and cloud financial operations tools over general cloud providers.',
    'Return a target object with name, positioning, and 3 to 6 key features.',
    'target.features must be concrete product capabilities, workflows, or modules.',
    'Do not use user groups, market categories, confidence labels, or vague placeholders as features.',
    'Bad feature examples: "enterprise users", "cloud platform", "users not clear".',
    'Good feature examples: "cost allocation", "anomaly detection", "multi-cloud visibility", "optimization recommendations".',
    `Return exactly ${COMPETITOR_COUNT} competitors.`,
    'Prefer direct competitors if the brief suggests a direct competitor search.',
    'Prefer similar alternatives if the brief suggests alternatives.',
    'Prefer representative category players if the brief suggests a broad category search.',
    'Rank competitors by relevance to the target workflow, not by overall market size.',
    'Each competitor must include name, website, startingPrice, bestFor, positioning, and country.',
    'Use short pricing labels such as "$49/mo", "Custom pricing", or "Free".',
    'Keep bestFor very short, ideally 2 to 5 words.',
    'Keep positioning to one short sentence fragment, ideally under 14 words.',
    'Use fully qualified HTTPS URLs.',
    'If an exact price is unclear, use "Custom pricing".',
    'Return summary as a single short paragraph, not bullets.',
    'Keep the summary under 80 words.',
    'In the summary, focus on the competitive landscape of the specific category, not the broader adjacent market.',
    'Do not return markdown or extra explanation outside the JSON schema.',
    '',
    `Competitor search brief:
${JSON.stringify(brief, null, 2)}`,
    '',
    `Candidate websites:
${JSON.stringify(candidateSeeds, null, 2)}`,
  ].join('\n');
}

function buildUnifiedAnalysisPrompt(input, payload) {
  const metadata = payload?.metadata || {};
  const canonicalBrandHint = [
    asString(metadata?.title, '').split('|')[0].trim(),
    asString(metadata?.domain, ''),
  ].filter(Boolean)[0] || '';

  return [
    'You are a product analyst generating a structured competitor analysis bundle.',
    'Do all work in one pass: understand the target, identify competitor website seeds, and produce the final competitor analysis.',
    input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
    'Return only valid JSON.',
    canonicalBrandHint ? `Preserve the official brand casing when possible. Likely brand hint: ${canonicalBrandHint}` : '',
    '',
    'The output has three top-level keys:',
    '- brief: the target understanding result',
    '- candidateSeeds: target/competitor website seeds',
    '- analysis: final competitor analysis result',
    '',
    'General rules:',
    '- Base your answer on fetched webpage evidence and crawled website evidence whenever available.',
    '- If input is natural language, infer directly.',
    '- If input is a URL, use evidence in this order: pageTitle, metaDescription, headings, pageExcerpt, domainName.',
    '- Prefer the most specific defensible category from the evidence.',
    '- Do not hallucinate detailed features or pricing.',
    '- Use official product or company websites, not review sites, directories, social profiles, or marketplaces.',
    '- Prefer direct competitors in the same workflow and category.',
    '- If the exact target website is unclear, use an empty string for target.website rather than inventing a domain.',
    '- Each competitor.website must be a fully qualified HTTPS URL when known.',
    '- Keep candidateSeeds.target.positioning and candidateSeeds.competitors.positioning concise and grounded.',
    '',
    'brief rules:',
    '- targetName must be the product or brand name, not a generic category label.',
    '- productSummary should be 2-3 sentences.',
    '- marketPreference must capture explicit geographic preference from the user when present: china | global | unknown.',
    '- keyFeatures must be 3-6 concrete product capabilities when supported.',
    '- competitorCandidates are optional lightweight hints.',
    '',
    'analysis rules:',
    '- Use brief and candidateSeeds as the source of truth for the final analysis.',
    `- Return exactly ${COMPETITOR_COUNT} competitors.`,
    '- If marketPreference is china, prioritize China-based / Chinese-market competitors first and only fill remaining slots with non-China competitors if needed.',
    '- target.features must be concrete product capabilities, workflows, or modules.',
    '- Each competitor must include name, website, startingPrice, bestFor, positioning, and country.',
    '- Use short pricing labels such as "$49/mo", "Custom pricing", or "Free".',
    '- Keep bestFor very short, ideally 2 to 5 words.',
    '- Keep positioning to one short sentence fragment, ideally under 14 words.',
    '- Return summary as a single short paragraph under 80 words.',
    '',
    `Input evidence:
${buildSourceText(input, payload)}`,
  ].join('\n');
}

function buildCompetitorDetailPrompt(input, payload) {
  const { targetName, competitor, searchEvidence } = payload;

  return [
    'You are generating a competitor detail page for a product intelligence app.',
    input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
    'Use the competitor seed data and external search evidence below.',
    'Be concise, specific, and evidence-grounded.',
    'Return only valid JSON.',
    'whyRelevant should explain why this competitor matters for the target product.',
    'overlapWithTarget should describe the shared workflow or market overlap.',
    'strongerIn should describe where this competitor appears stronger.',
    'targetDifferentiation should describe where the target product may differentiate.',
    'keyCapabilities must contain 3 to 6 concrete capabilities.',
    'companySignals should include fundingStage, totalFunding, and latestRound only when reasonably supported. Omit unsupported fields.',
    '',
    `Target product: ${targetName}`,
    `Competitor seed:
${JSON.stringify(competitor, null, 2)}`,
    '',
    buildSearchEvidenceText(searchEvidence),
  ].join('\n');
}

function buildFeatureExtractionPrompt(input, payload) {
  const { brief, searchEvidence } = payload;

  return [
    'You are extracting target product capabilities for a competitor analysis app.',
    input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
    'Return only valid JSON.',
    'Extract 3 to 6 concrete product capabilities when the evidence supports them.',
    'If the evidence is weak, return fewer items or an empty array.',
    'Do not invent features that are not supported by the evidence.',
    'Do not return user groups, market categories, or vague placeholders.',
    'Prefer functional capabilities, modules, or workflows visible in search evidence and webpage evidence.',
    'Prioritize headings and snippets from product, features, pricing, or solutions pages over homepage marketing copy.',
    'Do not assume H3 is always better than H2. Use the heading level that most clearly expresses a concrete capability.',
    'If search evidence mentions creator discovery, campaign management, audience analytics, influencer outreach, CRM, reporting, or cost optimization, use those concrete concepts rather than generic category words.',
    'Good feature examples: "creator discovery", "campaign workflow", "audience analytics".',
    'Bad feature examples: "marketing platform", "automation support", "general users".',
    '',
    `Competitor search brief:
${JSON.stringify(brief, null, 2)}`,
    '',
    buildSearchEvidenceText(searchEvidence),
  ].join('\n');
}

function buildDeepSeekMessages(kind, input, payload) {
  if (kind === 'route') {
    return [
      {
        role: 'system',
        content: [
          'You are a lightweight routing engine for a product intelligence pipeline.',
          input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
          'Return only valid JSON.',
          'Do not include markdown or extra prose.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildRoutingPrompt(input, payload),
      },
    ];
  }

  if (kind === 'brief') {
    return [
      {
        role: 'system',
        content: [
          'You are a product understanding engine.',
          input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
          'Return only valid JSON.',
          'Do not include markdown or extra prose.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildBriefPrompt(input, payload),
      },
    ];
  }

  if (kind === 'discovery') {
    return [
      {
        role: 'system',
        content: [
          'You understand the target product and select competitor website seeds for a product intelligence pipeline.',
          input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
          'Return only valid JSON.',
          'Do not include markdown or extra prose.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildDiscoveryPrompt(input, payload),
      },
    ];
  }

  if (kind === 'detail') {
    return [
      {
        role: 'system',
        content: [
          'You are generating structured competitor detail data for a product intelligence app.',
          input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
          'Return only valid JSON.',
          'Do not include markdown or extra prose.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildCompetitorDetailPrompt(input, payload),
      },
    ];
  }

  if (kind === 'candidate') {
    return [
      {
        role: 'system',
        content: [
          'You select official target and competitor websites for a product intelligence pipeline.',
          input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
          'Return only valid JSON.',
          'Do not include markdown or extra prose.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildCandidateDiscoveryPrompt(input, payload),
      },
    ];
  }

  if (kind === 'feature') {
    return [
      {
        role: 'system',
        content: [
          'You extract concrete product capabilities from product evidence.',
          input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
          'Return only valid JSON.',
          'Do not include markdown or extra prose.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildFeatureExtractionPrompt(input, payload),
      },
    ];
  }

  if (kind === 'analysis') {
    return [
      {
        role: 'system',
        content: [
          'You are a product analyst generating a structured competitor analysis from official website evidence.',
          input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
          'Return only valid JSON.',
          'Do not include markdown or extra prose.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildAnalysisPrompt(input, payload),
      },
    ];
  }

  if (kind === 'unified') {
    return [
      {
        role: 'system',
        content: [
          'You understand the target product, select competitor website seeds, and generate the final structured competitor analysis in one pass.',
          input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
          'Return only valid JSON.',
          'Do not include markdown or extra prose.',
        ].join(' '),
      },
      {
        role: 'user',
        content: buildUnifiedAnalysisPrompt(input, payload),
      },
    ];
  }

  return [
    {
      role: 'system',
      content: [
        'You are a product analyst generating a structured competitor analysis.',
        input.lang === 'zh' ? 'Return all text in Simplified Chinese.' : 'Return all text in English.',
        'Return only valid JSON.',
        'The JSON must contain target, competitors, and summary.',
        'target must include name, positioning, and 3 to 6 key features.',
        `competitors must contain exactly ${COMPETITOR_COUNT} items.`,
        'Each competitor must include name, website, startingPrice, bestFor, positioning, and country.',
        'summary must be a single paragraph string.',
        'Do not include markdown or extra prose.',
      ].join(' '),
    },
    {
      role: 'user',
      content: buildAnalysisPrompt(input, payload),
    },
  ];
}

function buildCompetitorDetailQueries(targetName, competitor) {
  const queries = [];
  const seen = new Set();

  const push = (value) => {
    const query = normalizeSearchText(value);
    if (!query) return;
    const key = query.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    queries.push(query);
  };

  push(`${competitor.name} ${competitor.website}`);
  push(`${competitor.name} pricing funding`);
  push(`${competitor.name} compared to ${targetName}`);

  return queries.slice(0, 3);
}

function pickFirstNonEmpty(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || '';
}

function asString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asStringArray(value, minItems = 0, fallback = []) {
  const items = Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
    : [];
  return items.length >= minItems ? items : fallback;
}

function normalizeBrief(input, brief, metadata) {
  const defaultTargetName = metadata?.title || metadata?.domain || '';
  const normalized = brief && typeof brief === 'object' ? brief : {};
  const normalizedCategory = asString(
    normalized.category,
    input.lang === 'zh' ? '待识别软件类别' : 'Unclear software category',
  );
  const normalizedHints = asString(
    normalized.competitorHints,
    input.lang === 'zh' ? '找到与该产品或类别最相关的竞品。' : 'Find the most relevant competitors for this product or category.',
  );
  const normalizedMarketPreference = ['china', 'global', 'unknown'].includes(normalized.marketPreference)
    ? normalized.marketPreference
    : /中国|国内|china|chinese/i.test(input.query)
      ? 'china'
      : 'unknown';
  const normalizedCandidates = Array.isArray(normalized.competitorCandidates)
    ? normalized.competitorCandidates
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        name: asString(item.name, ''),
        website: asString(item.website, ''),
      }))
      .filter((item) => item.name)
      .slice(0, CRAWL_COMPETITOR_COUNT)
    : [];

  return {
    inputType: input.url
      ? 'url'
      : /similar|alternative|alternatives|类似|竞品|对标/i.test(input.query)
        ? 'similar_query'
        : 'description',
    targetName: asString(normalized.targetName, defaultTargetName),
    referenceProduct: '',
    productSummary: asString(
      normalized.productSummary,
      input.lang === 'zh'
        ? '当前输入指向一个待识别的软件产品或产品类别。'
        : 'The input appears to refer to a software product or product category that needs further identification.'
    ),
    marketPreference: normalizedMarketPreference,
    category: normalizedCategory,
    subCategory: asString(normalized.subCategory, ''),
    targetUsers: asStringArray(
      normalized.targetUsers,
      0,
      []
    ).slice(0, 4),
    keyFeatures: asStringArray(normalized.keyFeatures, 0, []).slice(0, 6),
    competitorHints: normalizedHints,
    competitorCandidates: normalizedCandidates,
    searchIntent: normalizedHints,
    competitorSearchQuery: input.lang === 'zh'
      ? `${normalizedCandidates[0]?.name || asString(normalized.targetName, normalizedCategory) || normalizedCategory} 竞品`
      : `${normalizedCandidates[0]?.name || asString(normalized.targetName, normalizedCategory) || normalizedCategory} competitors`,
    confidence: ['high', 'medium', 'low'].includes(normalized.confidence) ? normalized.confidence : 'medium',
    enoughInformation:
      typeof normalized.enoughInformation === 'boolean'
        ? normalized.enoughInformation
        : Boolean(input.description || metadata?.description || metadata?.excerpt),
    reasoningNotes: asStringArray(
      typeof normalized.reasoningNotes === 'string' ? [normalized.reasoningNotes] : normalized.reasoningNotes,
      0,
      [
        metadata?.title ? `title: ${metadata.title}` : null,
        metadata?.description ? `description: ${metadata.description}` : null,
        metadata?.domain ? `domain: ${metadata.domain}` : null,
        metadata?.excerpt ? `excerpt: ${metadata.excerpt}` : null,
      ].filter(Boolean),
    ).slice(0, 6),
  };
}

function buildFeatureFlags(featureNames, availableIndexes) {
  return featureNames.map((name, index) => ({
    name,
    available: availableIndexes.includes(index),
  }));
}

function inferFeatureFallback(searchEvidence, brief, lang) {
  const haystack = [
    brief?.productSummary || '',
    brief?.category || '',
    brief?.subCategory || '',
    ...(Array.isArray(searchEvidence) ? searchEvidence.map((item) => `${item.title || ''} ${item.content || ''}`) : []),
  ]
    .join(' ')
    .toLowerCase();

  const catalog = [
    {
      patterns: ['cost allocation', '成本分摊', 'allocation'],
      label: lang === 'zh' ? '成本分摊' : 'Cost allocation',
    },
    {
      patterns: ['anomaly detection', '异常检测', 'cost anomaly'],
      label: lang === 'zh' ? '异常检测' : 'Anomaly detection',
    },
    {
      patterns: ['multi-cloud', '多云', 'cross-cloud'],
      label: lang === 'zh' ? '多云成本视图' : 'Multi-cloud cost visibility',
    },
    {
      patterns: ['optimization', '优化建议', 'rightsizing', 'savings'],
      label: lang === 'zh' ? '优化建议' : 'Optimization recommendations',
    },
    {
      patterns: ['reporting', '报表', 'dashboard'],
      label: lang === 'zh' ? '成本报表' : 'Cost reporting',
    },
    {
      patterns: ['budget', '预算'],
      label: lang === 'zh' ? '预算管理' : 'Budget management',
    },
    {
      patterns: ['kubernetes', 'k8s'],
      label: lang === 'zh' ? 'Kubernetes 成本分析' : 'Kubernetes cost analysis',
    },
    {
      patterns: ['finops', '财务运营'],
      label: lang === 'zh' ? 'FinOps 工作流' : 'FinOps workflows',
    },
    {
      patterns: ['forecast', '预测'],
      label: lang === 'zh' ? '成本预测' : 'Cost forecasting',
    },
    {
      patterns: ['tag', '标签'],
      label: lang === 'zh' ? '标签管理' : 'Tag management',
    },
  ];

  const features = catalog
    .filter((entry) => entry.patterns.some((pattern) => haystack.includes(pattern)))
    .map((entry) => entry.label);

  if (features.length >= 3) {
    return features.slice(0, 6);
  }

  const categoryText = `${brief?.category || ''} ${brief?.subCategory || ''} ${brief?.productSummary || ''}`.toLowerCase();

  if (
    /notion|knowledge|wiki|documentation|note|notes|workspace|collaboration|project management|文档|笔记|知识库|协作|工作空间/.test(categoryText)
  ) {
    return lang === 'zh'
      ? ['笔记与文档', '数据库视图', '团队协作']
      : ['Notes and docs', 'Database views', 'Team collaboration'];
  }

  if (/crm|sales|pipeline|lead|客户|销售|线索|商机/.test(categoryText)) {
    return lang === 'zh'
      ? ['销售管道', '联系人管理', '自动化流程']
      : ['Sales pipeline', 'Contact management', 'Workflow automation'];
  }

  if (/seo|search|keyword|backlink|ranking|关键词|搜索|外链|排名/.test(categoryText)) {
    return lang === 'zh'
      ? ['关键词跟踪', '站点审计', '排名报告']
      : ['Keyword tracking', 'Site audit', 'Ranking reports'];
  }

  if (/support|help desk|customer service|ticket|客服|工单|支持/.test(categoryText)) {
    return lang === 'zh'
      ? ['共享收件箱', '自动化规则', '知识库']
      : ['Shared inbox', 'Automation rules', 'Knowledge base'];
  }

  if (/analytics|dashboard|bi|reporting|分析|报表|看板/.test(categoryText)) {
    return lang === 'zh'
      ? ['仪表盘', '自定义报表', '数据探索']
      : ['Dashboards', 'Custom reporting', 'Data exploration'];
  }

  return lang === 'zh'
    ? ['核心工作流', '协作能力', '自动化支持']
    : ['Core workflow', 'Collaboration features', 'Automation support'];
}

function normalizeSearchText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizeWebsite(value) {
  const text = asString(value, '');
  if (!text) return '';

  try {
    const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    const url = new URL(withScheme);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function normalizeInputUrl(value) {
  const website = normalizeWebsite(value);
  if (!website) return '';

  try {
    const url = new URL(website);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/') {
      return url.origin;
    }

    const keepPathPatterns = [
      /^\/pricing(?:\/|$)/i,
      /^\/features?(?:\/|$)/i,
      /^\/product(?:\/|$)/i,
      /^\/platform(?:\/|$)/i,
      /^\/solutions?(?:\/|$)/i,
      /^\/use-cases?(?:\/|$)/i,
    ];

    if (keepPathPatterns.some((pattern) => pattern.test(path))) {
      return `${url.origin}${path}`;
    }

    const fallbackToRootPatterns = [
      /^\/login(?:\/|$)/i,
      /^\/signin(?:\/|$)/i,
      /^\/signup(?:\/|$)/i,
      /^\/account(?:\/|$)/i,
      /^\/dashboard(?:\/|$)/i,
      /^\/manage(?:\/|$)/i,
      /^\/admin(?:\/|$)/i,
      /^\/creator(?:\/|$)/i,
      /^\/user(?:\/|$)/i,
      /^\/settings(?:\/|$)/i,
      /^\/console(?:\/|$)/i,
      /^\/workspace(?:\/|$)/i,
    ];

    const depth = path.split('/').filter(Boolean).length;
    if (fallbackToRootPatterns.some((pattern) => pattern.test(path)) || depth >= 3) {
      return url.origin;
    }

    return `${url.origin}${path}`;
  } catch {
    return website;
  }
}

function normalizeBrandText(value) {
  return asString(value, '')
    .toLowerCase()
    .replace(/https?:\/\//g, '')
    .replace(/^www\./, '')
    .replace(/\.[a-z]{2,}$/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
}

function isBrandNameLikeQuery(query) {
  const text = asString(query, '').trim();
  if (!text) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (/similar|alternative|alternatives|类似|竞品|对标/i.test(text)) return false;
  if (text.length > 40) return false;
  if (/\s/.test(text) && text.split(/\s+/).length > 2) return false;
  return !/[,.!?]/.test(text);
}

function buildInsufficientSiteDiscoveryError(lang, query) {
  return lang === 'zh'
    ? `当前无法仅根据“${query}”可靠识别产品。请补充官网 URL 或一句产品描述后再试。`
    : `The product "${query}" could not be identified reliably from the name alone. Please add an official URL or a short product description and try again.`;
}

function buildPolicyBlockedError(lang) {
  return lang === 'zh'
    ? '当前请求不支持分析。'
    : 'This request is not supported for analysis.';
}

function hostnameFromUrl(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function originFromUrl(value) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function sameHostname(a, b) {
  return hostnameFromUrl(a) && hostnameFromUrl(a) === hostnameFromUrl(b);
}

function scoreDiscoveredLink(url, text) {
  const haystack = `${url} ${text}`.toLowerCase();
  let score = 0;

  const groups = [
    ['pricing', 'plan', 'plans', 'billing', 'price'],
    ['features', 'feature', 'product', 'platform'],
    ['solutions', 'solution', 'use-cases', 'usecase', 'customers', 'industries'],
    ['about', 'company', 'team'],
  ];

  groups.forEach((patterns, index) => {
    if (patterns.some((pattern) => haystack.includes(pattern))) {
      score += 100 - index * 10;
    }
  });

  if (/\/blog\/|\/news\/|\/docs\/|\/help\/|\/support\//.test(haystack)) {
    score -= 80;
  }

  if (/llm-price|price-browser|calculator|compare|comparison|provider\/|model\/|api-pricing/.test(haystack)) {
    score -= 90;
  }

  if (/docs|blog|news|privacy|terms|login|signin|signup|careers|jobs|academy|community/.test(haystack)) {
    score -= 50;
  }

  return score;
}

function classifyDiscoveredLink(url, text = '') {
  const haystack = `${url} ${text}`.toLowerCase();

  if (/pricing|plan|plans|billing|price/.test(haystack)) return 'pricing';
  if (/features|feature|product|platform/.test(haystack)) return 'features';
  if (/solutions|solution|use-cases|usecase|customers|industries/.test(haystack)) return 'solutions';
  if (/about|company|team/.test(haystack)) return 'about';
  return 'other';
}

function selectHighValueLinks(links) {
  const selected = [];
  const seen = new Set();
  const preferredTypes = ['pricing', 'features', 'solutions', 'about'];

  preferredTypes.forEach((type) => {
    const match = links.find((link) => classifyDiscoveredLink(link.url, link.text) === type);
    if (match && !seen.has(match.url)) {
      seen.add(match.url);
      selected.push(match);
    }
  });

  for (const link of links) {
    if (selected.length >= MAX_PAGES_PER_SITE - 1) break;
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    selected.push(link);
  }

  return selected.slice(0, MAX_PAGES_PER_SITE - 1);
}

function scoreOfficialSiteCandidate(candidate, targetName) {
  const normalizedTarget = normalizeBrandText(targetName);
  const hostname = hostnameFromUrl(candidate.url);
  const title = asString(candidate.title, '').toLowerCase();
  const content = asString(candidate.content, '').toLowerCase();
  const url = asString(candidate.url, '').toLowerCase();
  let score = 0;

  if (!candidate.url) return -999;

  if (normalizedTarget) {
    if (normalizeBrandText(hostname).includes(normalizedTarget)) score += 60;
    if (normalizeBrandText(title).includes(normalizedTarget)) score += 40;
    if (normalizeBrandText(content).includes(normalizedTarget)) score += 20;
  }

  try {
    const parsed = new URL(candidate.url);
    const path = parsed.pathname.replace(/\/+$/, '') || '/';
    const depth = path === '/' ? 0 : path.split('/').filter(Boolean).length;
    if (depth === 0) score += 35;
    if (depth >= 2) score -= 25;
  } catch {
    // ignore malformed candidate URL
  }

  if (/pricing|plan|plans|product|platform|features|solution|about/.test(url)) score += 10;
  if (/g2|capterra|linkedin|wikipedia|facebook|x\.com|twitter|instagram|youtube|github|crunchbase/.test(url)) score -= 60;
  if (/blog|news|docs|help|support/.test(url)) score -= 50;

  return score;
}

function normalizeRoutingDecision(input, decision) {
  const normalized = decision && typeof decision === 'object' ? decision : {};
  const inferredInputKind = input.url
    ? 'url'
    : /similar|alternative|alternatives|类似|竞品|对标/i.test(input.query)
      ? 'similar_query'
      : isBrandNameLikeQuery(input.query)
        ? 'brand_query'
        : /\s/.test(input.query.trim())
        ? 'product_description'
        : 'brand_query';
  const normalizedInputKind = ['url', 'brand_query', 'category_query', 'product_description', 'similar_query', 'unclear_query'].includes(normalized.inputKind)
    ? normalized.inputKind
    : inferredInputKind;
  const hasReliableKnowledge = Boolean(normalized.hasReliableKnowledge);
  const normalizedEntityType = ['brand', 'product', 'category', 'unknown'].includes(normalized.entityType)
    ? normalized.entityType
    : normalizedInputKind === 'brand_query'
      ? 'brand'
      : normalizedInputKind === 'category_query'
        ? 'category'
        : normalizedInputKind === 'product_description'
          ? 'product'
          : 'unknown';
  const normalizedTargetNameGuess = asString(normalized.targetNameGuess, input.query);
  const hasSearchableBrandLikeEntity = (
    normalizedInputKind === 'brand_query' ||
    normalizedEntityType === 'brand' ||
    normalizedEntityType === 'product'
  ) && !isPlaceholderEntityName(normalizedTargetNameGuess);

  return {
    inputKind: normalizedInputKind,
    coreEntity: asString(normalized.coreEntity, input.query),
    entityType: normalizedEntityType,
    hasReliableKnowledge,
    shouldSearchOfficialSite: input.url
      ? false
      : hasSearchableBrandLikeEntity && !hasReliableKnowledge
        ? true
      : typeof normalized.shouldSearchOfficialSite === 'boolean'
        ? normalized.shouldSearchOfficialSite && hasSearchableBrandLikeEntity
        : inferredInputKind === 'brand_query' && hasSearchableBrandLikeEntity,
    policyDecision: ['allow', 'block'].includes(normalized.policyDecision) ? normalized.policyDecision : 'allow',
    policyReason: asString(normalized.policyReason, 'none'),
    confidence: ['high', 'medium', 'low'].includes(normalized.confidence) ? normalized.confidence : 'medium',
    reason: asString(normalized.reason, ''),
    targetNameGuess: normalizedTargetNameGuess,
  };
}

function isPlaceholderEntityName(value) {
  const normalized = normalizeSearchText(value).toLowerCase();
  return [
    '',
    'unknown',
    '未知',
    'unknown product',
    'unknown brand',
    '目标产品',
    '产品',
    '品牌',
  ].includes(normalized);
}

function extractLinks(html, baseUrl) {
  const origin = originFromUrl(baseUrl);
  if (!origin) return [];

  const seen = new Set();
  const links = [];
  const matches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);

  for (const match of matches) {
    const rawHref = asString(match[1], '');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
      continue;
    }

    let absolute;
    try {
      absolute = new URL(rawHref, origin).toString();
    } catch {
      continue;
    }

    if (!sameHostname(absolute, origin)) continue;

    const normalized = absolute.replace(/[#?].*$/, '').replace(/\/$/, '') || absolute;
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);

    const text = stripHtml(match[2] || '');
    const score = scoreDiscoveredLink(normalized, text);
    if (score <= 0) continue;

    links.push({ url: normalized, text, score });
  }

  return links.sort((a, b) => b.score - a.score);
}

function extractLogoUrl(html, pageUrl) {
  const iconHref = extractMetaContent(html, ['og:image']) || extractTag(
    html,
    /<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
  );

  if (!iconHref) return '';

  try {
    return new URL(iconHref, pageUrl).toString();
  } catch {
    return '';
  }
}

async function fetchPageSnapshot(url) {
  if (!url) return null;

  try {
    const response = await fetchWithTimeout(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'AI-Competitor-Analyzer/1.0',
      },
    }, PAGE_FETCH_TIMEOUT_MS);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const finalUrl = normalizeInputUrl(response.url || url) || normalizeInputUrl(url) || url;
    const title = extractMetaContent(html, ['og:title', 'twitter:title']) || extractTag(html, /<title>([^<]+)<\/title>/i);
    const description = extractMetaContent(html, ['description', 'og:description', 'twitter:description']) || '';
    const h1 = extractSpecificHeadings(html, 'h1');
    const h2 = extractSpecificHeadings(html, 'h2');
    const h3 = extractSpecificHeadings(html, 'h3');
    const headings = extractHeadings(html);
    const excerpt = extractExcerpt(html) || '';
    const logo = extractLogoUrl(html, finalUrl);
    const links = extractLinks(html, finalUrl);

    return {
      url: finalUrl,
      title,
      description,
      metaDescription: description,
      h1,
      h2,
      h3,
      headings,
      excerpt,
      snippet: excerpt,
      logo,
      links,
      content: [description, ...h1, ...h2.slice(0, 4), ...h3.slice(0, 4), excerpt].filter(Boolean).join(' | ').slice(0, 1200),
    };
  } catch {
    return null;
  }
}

function buildCandidateSiteList(input, brief, metadata, candidates) {
  const sites = [];
  const seen = new Set();

  const push = (kind, name, website, positioning = '') => {
    const normalizedWebsite = normalizeWebsite(website);
    const key = `${kind}:${name}:${normalizedWebsite}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    sites.push({
      kind,
      name: asString(name, kind === 'target' ? (brief.targetName || metadata?.domain || 'Target Product') : 'Competitor'),
      website: normalizedWebsite,
      positioning: asString(positioning, ''),
    });
  };

  push('target', candidates?.target?.name || brief.targetName || metadata?.title || metadata?.domain, input.url || candidates?.target?.website || '', candidates?.target?.positioning || brief.productSummary);

  const competitorSeeds = Array.isArray(candidates?.competitors) && candidates.competitors.length
    ? candidates.competitors
    : Array.isArray(brief?.competitorCandidates)
      ? brief.competitorCandidates.map((item) => ({
        name: item.name,
        website: item.website,
        positioning: '',
      }))
      : [];
  competitorSeeds.slice(0, CRAWL_COMPETITOR_COUNT).forEach((competitor) => {
    push('competitor', competitor?.name, competitor?.website, competitor?.positioning);
  });

  return sites;
}

async function crawlSiteEvidence(site, lang) {
  const homepage = await fetchPageSnapshot(site.website);
  if (!homepage) return [];

  const pageUrls = [homepage.url];
  const selectedLinks = selectHighValueLinks(homepage.links);
  for (const link of selectedLinks) {
    pageUrls.push(link.url);
  }

  const pages = [];
  for (const pageUrl of pageUrls) {
    const snapshot = pageUrl === homepage.url ? homepage : await fetchPageSnapshot(pageUrl);
    if (!snapshot) continue;
    pages.push(snapshot);
  }

  return pages.map((page, index) => ({
    pageType: index === 0
      ? 'homepage'
      : classifyDiscoveredLink(page.url, page.title || ''),
    query: site.kind === 'target'
      ? (lang === 'zh' ? `目标官网抓取: ${site.name}` : `Target crawl: ${site.name}`)
      : (lang === 'zh' ? `竞品官网抓取: ${site.name}` : `Competitor crawl: ${site.name}`),
    title: page.title || site.name,
    url: page.url,
    metaDescription: page.metaDescription || '',
    h1: Array.isArray(page.h1) ? page.h1 : [],
    h2: Array.isArray(page.h2) ? page.h2 : [],
    h3: Array.isArray(page.h3) ? page.h3 : [],
    snippet: page.snippet || page.excerpt || '',
    content: [
      index === 0 ? (lang === 'zh' ? 'Homepage' : 'Homepage') : (lang === 'zh' ? 'Discovered page' : 'Discovered page'),
      `Page type: ${index === 0 ? 'homepage' : classifyDiscoveredLink(page.url, page.title || '')}`,
      page.description,
      ...page.headings.slice(0, 6),
      page.excerpt,
    ].filter(Boolean).join(' | ').slice(0, 1000),
    score: index === 0 ? 100 : 80 - index,
    siteName: site.name,
    siteKind: site.kind,
    logo: page.logo,
  }));
}

async function gatherWebsiteEvidence(input, brief, metadata, candidates) {
  const siteList = buildCandidateSiteList(input, brief, metadata, candidates);
  const evidence = [];

  for (const site of siteList) {
    if (!site.website) continue;
    const siteEvidence = await crawlSiteEvidence(site, input.lang);
    evidence.push(...siteEvidence);
  }

  return evidence.slice(0, MAX_PAGES_PER_SITE * (CRAWL_COMPETITOR_COUNT + 1));
}

function mergeMetadataWithEvidence(metadata, candidates, websiteEvidence) {
  const targetHomepage = Array.isArray(websiteEvidence)
    ? websiteEvidence.find((item) => item.siteKind === 'target' && item.pageType === 'homepage')
    : null;
  const targetWebsite = normalizeWebsite(candidates?.target?.website || '');

  return {
    ...metadata,
    title: metadata?.title || targetHomepage?.title || candidates?.target?.name || undefined,
    description: metadata?.description || targetHomepage?.content || candidates?.target?.positioning || undefined,
    domain: metadata?.domain || hostnameFromUrl(targetHomepage?.url || targetWebsite) || undefined,
    excerpt: metadata?.excerpt || targetHomepage?.content || undefined,
    logo: targetHomepage?.logo || undefined,
    website: targetHomepage?.url || targetWebsite || undefined,
  };
}

function normalizeCandidateSeeds(input, brief, metadata, rawCandidates) {
  const targetWebsite = normalizeWebsite(rawCandidates?.target?.website || input.url || '');
  const normalizedCompetitors = Array.isArray(rawCandidates?.competitors)
    ? rawCandidates.competitors
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        name: asString(item.name, ''),
        website: normalizeWebsite(item.website),
        positioning: asString(item.positioning, ''),
      }))
      .filter((item) => item.name && item.website)
      .slice(0, CRAWL_COMPETITOR_COUNT)
    : [];

  return {
    target: {
      name: asString(rawCandidates?.target?.name, brief.targetName || metadata?.title || metadata?.domain || 'Target Product'),
      website: targetWebsite,
      positioning: asString(rawCandidates?.target?.positioning, brief.productSummary),
    },
    competitors: normalizedCompetitors,
  };
}

function buildSearchQueries(input, brief, metadata) {
  const queries = [];
  const seen = new Set();

  const push = (value) => {
    const query = normalizeSearchText(value);
    if (!query) return;
    const key = query.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    queries.push(query);
  };

  if (input.url) {
    push(metadata?.domain);
    push(`site:${metadata?.domain || input.url} ${metadata?.title || ''}`);
  } else {
    push(input.query);
  }

  push(`${brief.targetName || brief.referenceProduct || ''} ${brief.category || ''}`);
  push(brief.competitorSearchQuery);

  return queries.slice(0, 3);
}

async function searchTavily(query, lang) {
  if (!tavilyApiKey || !query) {
    return null;
  }

  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tavilyApiKey}`,
    },
    body: JSON.stringify({
      query,
      topic: 'general',
      search_depth: 'advanced',
      chunks_per_source: 3,
      max_results: 5,
      include_answer: 'basic',
      include_raw_content: false,
      country: lang === 'zh' ? 'china' : undefined,
    }),
  }, SEARCH_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}`);
  }

  return response.json();
}

async function searchSearXNG(query, lang) {
  if (!searxngBaseUrl || !query) {
    return null;
  }

  const url = new URL('/search', searxngBaseUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('language', lang === 'zh' ? 'zh-CN' : 'en-US');
  url.searchParams.set('safesearch', '0');

  const response = await fetchWithTimeout(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AI-Competitor-Analyzer/1.0',
    },
  }, SEARCH_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`SearXNG search failed with status ${response.status}`);
  }

  return response.json();
}

async function searchBocha(query, lang) {
  if (!bochaApiKey || !query) {
    return null;
  }

  const url = new URL('/v1/web-search', bochaBaseUrl);
  const response = await fetchWithTimeout(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bochaApiKey}`,
    },
    body: JSON.stringify({
      query,
      summary: true,
      freshness: 'noLimit',
      count: 5,
    }),
  }, SEARCH_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`Bocha search failed with status ${response.status}`);
  }

  return response.json();
}

async function searchSerper(query, lang) {
  if (!serperApiKey || !query) {
    return null;
  }

  const url = new URL('/search', serperBaseUrl);
  const response = await fetchWithTimeout(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': serperApiKey,
    },
    body: JSON.stringify({
      q: query,
      gl: lang === 'zh' ? 'cn' : 'us',
      hl: lang === 'zh' ? 'zh-cn' : 'en',
      num: 5,
      autocorrect: false,
    }),
  }, SEARCH_TIMEOUT_MS);

  if (!response.ok) {
    throw new Error(`Serper search failed with status ${response.status}`);
  }

  return response.json();
}

function resolveSearchProvider() {
  if (searchProvider === 'serper' && serperApiKey) {
    return 'serper';
  }

  if (searchProvider === 'bocha' && bochaApiKey) {
    return 'bocha';
  }

  if (searchProvider === 'searxng' && searxngBaseUrl) {
    return 'searxng';
  }

  if (searchProvider === 'tavily' && tavilyApiKey) {
    return 'tavily';
  }

  if (searchProvider) {
    return '';
  }

  if (bochaApiKey) {
    return 'bocha';
  }

  if (serperApiKey) {
    return 'serper';
  }

  if (searxngBaseUrl) {
    return 'searxng';
  }

  if (tavilyApiKey) {
    return 'tavily';
  }

  return '';
}

function normalizeSearchEvidenceItem(query, item) {
  return {
    query,
    title: asString(item?.title, ''),
    url: asString(item?.url, ''),
    content: asString(item?.content, '').slice(0, 900),
    score: typeof item?.score === 'number' ? item.score : 0,
  };
}

function normalizeSearXNGItem(query, item) {
  return {
    query,
    title: asString(item?.title, ''),
    url: asString(item?.url, ''),
    content: asString(item?.content || item?.snippet, '').slice(0, 900),
    score: typeof item?.score === 'number' ? item.score : 0,
  };
}

function normalizeBochaItem(query, item) {
  return {
    query,
    title: asString(item?.name, ''),
    url: asString(item?.url, ''),
    content: asString(item?.summary || item?.snippet || '', '').slice(0, 900),
    score: typeof item?.score === 'number' ? item.score : 0,
  };
}

function getBochaRows(result) {
  if (Array.isArray(result?.webPages?.value)) {
    return result.webPages.value;
  }

  if (Array.isArray(result?.data?.webPages?.value)) {
    return result.data.webPages.value;
  }

  return [];
}

function normalizeSerperItem(query, item) {
  return {
    query,
    title: asString(item?.title, ''),
    url: asString(item?.link, ''),
    content: asString(item?.snippet, '').slice(0, 900),
    score: typeof item?.position === 'number' ? Math.max(0, 100 - ((item.position - 1) * 5)) : 0,
  };
}

function getSerperRows(result) {
  return Array.isArray(result?.organic) ? result.organic : [];
}

function rankOfficialSiteCandidates(candidates, targetName) {
  return candidates
    .map((candidate) => ({ ...candidate, score: scoreOfficialSiteCandidate(candidate, targetName) }))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5);
}

function pickOfficialSiteUrl(rankedCandidates) {
  const topCandidate = rankedCandidates[0];
  let selectedUrl = topCandidate && (topCandidate.score || 0) >= 20 ? topCandidate.url : '';

  if (selectedUrl) {
    try {
      const parsed = new URL(selectedUrl);
      const path = parsed.pathname.replace(/\/+$/, '') || '/';
      const depth = path === '/' ? 0 : path.split('/').filter(Boolean).length;
      if (depth >= 2 || /blog|news|docs|help|support/i.test(path)) {
        selectedUrl = parsed.origin;
      }
    } catch {
      selectedUrl = normalizeWebsite(selectedUrl);
    }
  }

  return selectedUrl;
}

async function collectSerperOfficialSiteCandidates(queries, lang) {
  if (!serperApiKey) {
    return [];
  }

  const candidates = [];
  const seen = new Set();

  for (const query of queries) {
    let result;

    try {
      result = await searchSerper(query, lang);
    } catch (error) {
      console.error(
        '[site-discovery:serper] query failed',
        JSON.stringify({
          query,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      continue;
    }

    for (const row of getSerperRows(result)) {
      const candidate = normalizeSerperItem(query, row);
      if (!candidate.url || seen.has(candidate.url)) continue;
      seen.add(candidate.url);
      candidates.push(candidate);
    }
  }

  return candidates;
}

async function collectBrowserOfficialSiteCandidates(queries, lang) {
  let chromium;

  try {
    ({ chromium } = await import('playwright'));
  } catch (error) {
    console.error(
      '[site-discovery:browser] playwright unavailable',
      JSON.stringify({ message: error instanceof Error ? error.message : String(error) }),
    );
    return [];
  }

  if (officialSiteBrowserEngine !== 'bing') {
    return [];
  }

  let browser;

  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    console.error(
      '[site-discovery:browser] launch failed',
      JSON.stringify({ message: error instanceof Error ? error.message : String(error) }),
    );
    return [];
  }

  const candidates = [];
  const seen = new Set();

  try {
    const page = await browser.newPage();

    for (const query of queries) {
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=${lang === 'zh' ? 'zh-Hans' : 'en-US'}`;

      try {
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: BROWSER_SEARCH_TIMEOUT_MS,
        });
        await page.waitForSelector('li.b_algo h2 a', { timeout: 2500 }).catch(() => {});
      } catch (error) {
        console.error(
          '[site-discovery:browser] navigation failed',
          JSON.stringify({
            query,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
        continue;
      }

      const rows = await page.$$eval('li.b_algo', (items) => items.slice(0, 8).map((item, index) => {
        const anchor = item.querySelector('h2 a');
        const snippet = item.querySelector('.b_caption p, .b_snippet, p');
        return {
          title: anchor?.textContent?.trim() || '',
          url: anchor?.getAttribute('href') || '',
          content: snippet?.textContent?.trim() || '',
          score: Math.max(0, 100 - (index * 5)),
        };
      }));

      for (const row of rows) {
        const candidate = {
          query,
          title: asString(row.title, ''),
          url: asString(row.url, ''),
          content: asString(row.content, '').slice(0, 900),
          score: typeof row.score === 'number' ? row.score : 0,
        };
        if (!candidate.url || seen.has(candidate.url)) continue;
        seen.add(candidate.url);
        candidates.push(candidate);
      }
    }
  } finally {
    await browser.close();
  }

  return candidates;
}

function buildDomainGuessUrls(targetName) {
  const normalized = normalizeSearchText(targetName)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\b(official|官网|platform|app|software|tool|cloud|ai)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return [];
  }

  const labels = [
    normalized.replace(/\s+/g, ''),
    normalized.split(' ')[0] || '',
  ].filter((value, index, array) => value.length >= 3 && array.indexOf(value) === index);

  const tlds = ['com', 'ai', 'io', 'cn', 'co', 'app'];
  const urls = [];
  const seen = new Set();

  for (const label of labels) {
    for (const tld of tlds) {
      const url = `https://${label}.${tld}`;
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  }

  return urls.slice(0, 12);
}

async function collectDomainGuessCandidates(targetName, query) {
  const candidates = [];

  for (const guessedUrl of buildDomainGuessUrls(targetName)) {
    const metadata = await fetchUrlMetadata(guessedUrl);
    if (!metadata?.title && !metadata?.description) continue;

    candidates.push({
      query,
      title: metadata.title || '',
      url: guessedUrl,
      content: metadata.description || metadata.excerpt || '',
      score: 0,
    });
  }

  return candidates;
}

async function gatherSearchEvidence(input, brief, metadata) {
  const queries = buildSearchQueries(input, brief, metadata);
  const activeSearchProvider = resolveSearchProvider();

  if (!queries.length || !activeSearchProvider) {
    return [];
  }

  const evidence = [];
  const seen = new Set();

  for (const query of queries) {
    let result;

    try {
      result = activeSearchProvider === 'searxng'
        ? await searchSearXNG(query, input.lang)
        : activeSearchProvider === 'serper'
          ? await searchSerper(query, input.lang)
        : activeSearchProvider === 'bocha'
          ? await searchBocha(query, input.lang)
          : await searchTavily(query, input.lang);
    } catch (error) {
      console.error(
        `[search:${activeSearchProvider}] query failed`,
        JSON.stringify({
          query,
          message: error instanceof Error ? error.message : String(error),
        })
      );
      continue;
    }

    const rows = activeSearchProvider === 'searxng'
      ? (Array.isArray(result?.results) ? result.results : [])
      : activeSearchProvider === 'serper'
        ? getSerperRows(result)
      : activeSearchProvider === 'bocha'
        ? getBochaRows(result)
        : (Array.isArray(result?.results) ? result.results : []);

    for (const row of rows) {
      const normalized = activeSearchProvider === 'searxng'
        ? normalizeSearXNGItem(query, row)
        : activeSearchProvider === 'serper'
          ? normalizeSerperItem(query, row)
        : activeSearchProvider === 'bocha'
          ? normalizeBochaItem(query, row)
          : normalizeSearchEvidenceItem(query, row);
      const key = `${normalized.title}|${normalized.url}`.toLowerCase();
      if (!normalized.title && !normalized.content) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      evidence.push(normalized);
      if (evidence.length >= 8) {
        return evidence;
      }
    }
  }

  return evidence;
}

async function discoverOfficialSite(input, routeDecision) {
  const targetName = routeDecision.targetNameGuess || input.query;
  const queries = [
    `${targetName} 官网`,
    `${targetName} official site`,
  ].map((query) => normalizeSearchText(query)).filter(Boolean);

  const serperCandidates = await collectSerperOfficialSiteCandidates(queries, input.lang);
  const rankedSerper = rankOfficialSiteCandidates(serperCandidates, targetName);
  const serperSelectedUrl = pickOfficialSiteUrl(rankedSerper);

  if (serperSelectedUrl) {
    return {
      provider: 'serper',
      queries,
      candidates: rankedSerper.map((item) => ({
        title: item.title,
        url: item.url,
        content: item.content,
        score: item.score || 0,
      })),
      selectedUrl: serperSelectedUrl,
    };
  }

  const browserCandidates = await collectBrowserOfficialSiteCandidates(queries, input.lang);
  const rankedBrowser = rankOfficialSiteCandidates(browserCandidates, targetName);
  const browserSelectedUrl = pickOfficialSiteUrl(rankedBrowser);

  if (browserSelectedUrl) {
    return {
      provider: `browser:${officialSiteBrowserEngine}`,
      queries,
      candidates: rankedBrowser.map((item) => ({
        title: item.title,
        url: item.url,
        content: item.content,
        score: item.score || 0,
      })),
      selectedUrl: browserSelectedUrl,
    };
  }

  const domainCandidates = await collectDomainGuessCandidates(targetName, queries[0] || targetName);
  const rankedDomain = rankOfficialSiteCandidates(domainCandidates, targetName);
  const domainSelectedUrl = pickOfficialSiteUrl(rankedDomain);

  return {
    provider: domainSelectedUrl ? 'domain_guess' : 'none',
    queries,
    candidates: rankedDomain.map((item) => ({
      title: item.title,
      url: item.url,
      content: item.content,
      score: item.score || 0,
    })),
    selectedUrl: domainSelectedUrl,
  };
}

async function gatherCompetitorDetailEvidence(input, targetName, competitor) {
  const website = normalizeWebsite(competitor.website);
  if (!website) {
    return [];
  }

  return crawlSiteEvidence(
    {
      kind: 'competitor',
      name: competitor.name || targetName || 'Competitor',
      website,
      positioning: competitor.positioning || '',
    },
    input.lang,
  );
}

function buildFallbackCompetitors(targetName, targetFeatures) {
  const templates = [
    ['AltNova', 'https://www.altnova.com', 'Custom pricing', 'Mid-market teams', 'Broader workflow suite for growing software teams.', 'United States'],
    ['FlowBench', 'https://www.flowbench.io', '$39/mo', 'SMB operators', 'Workflow-first alternative focused on simpler day-to-day execution.', 'United Kingdom'],
    ['MarketGrid', 'https://www.marketgrid.ai', '$79/mo', 'Product teams', 'Research and market context tool with collaborative analysis features.', 'Canada'],
    ['ScopeLoop', 'https://www.scopeloop.com', 'Custom pricing', 'Ops leaders', 'Structured intelligence workflow for teams that need repeatable analysis.', 'Australia'],
    ['SignalPort', 'https://www.signalport.io', '$99/mo', 'Growth teams', 'Competitive visibility platform centered on alerts and reporting.', 'United States'],
    ['VectorDesk', 'https://www.vectordesk.com', '$59/mo', 'Startup teams', 'Compact software alternative focused on clarity and speed.', 'Germany'],
    ['NorthstarIQ', 'https://www.northstariq.com', 'Custom pricing', 'Commercial teams', 'Market intelligence layer designed for cross-functional planning.', 'United States'],
    ['ModeRiver', 'https://www.moderiver.com', '$49/mo', 'Lean ops teams', 'Focused competitor in the same workflow category with a simpler setup path.', 'Netherlands'],
    ['AtlasLoop', 'https://www.atlasloop.io', 'Custom pricing', 'Growth-stage software teams', 'Broader category product with stronger reporting and governance depth.', 'United States'],
    ['LatticePeak', 'https://www.latticepeak.com', '$89/mo', 'Cross-functional teams', 'Mid-market alternative emphasizing collaboration and decision support.', 'Ireland'],
  ];

  return templates
    .map(([name, website, startingPrice, bestFor, positioning, country]) => ({
      name,
      website,
      startingPrice,
      bestFor,
      positioning,
      country,
      features: buildFeatureFlags(targetFeatures, [0, 1, 2]),
    }))
    .filter((competitor) => competitor.name !== targetName);
}

function isChinaCountryLabel(value) {
  const normalized = asString(value, '').trim().toLowerCase();
  return ['china', 'cn', '中国', '中国大陆', 'mainland china', 'prc'].includes(normalized);
}

function ensureCompetitorCount(result, count = COMPETITOR_COUNT) {
  const targetFeatures = Array.isArray(result?.target?.features) ? result.target.features : [];
  const existing = Array.isArray(result?.competitors) ? result.competitors : [];
  const seen = new Set();

  const normalized = existing
    .filter((competitor) => competitor && typeof competitor === 'object')
    .filter((competitor) => {
      const key = String(competitor.name || '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, count);

  if (normalized.length >= count) {
    return normalized.slice(0, count);
  }

  const fallback = buildFallbackCompetitors(result?.target?.name || 'Target Product', targetFeatures);
  for (const competitor of fallback) {
    if (normalized.length >= count) break;
    const key = competitor.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(competitor);
  }

  return normalized.slice(0, count);
}

function applyMarketPreference(competitors, marketPreference, count = COMPETITOR_COUNT) {
  if (!Array.isArray(competitors) || marketPreference !== 'china') {
    return Array.isArray(competitors) ? competitors.slice(0, count) : [];
  }

  const china = competitors.filter((competitor) => isChinaCountryLabel(competitor?.country));
  const others = competitors.filter((competitor) => !isChinaCountryLabel(competitor?.country));

  return [...china, ...others].slice(0, count);
}

function findHomepageLogo(searchEvidence, website, kind = 'competitor') {
  const normalizedWebsite = normalizeWebsite(website);
  if (!normalizedWebsite || !Array.isArray(searchEvidence)) {
    return '';
  }

  const normalizedOrigin = hostnameFromUrl(normalizedWebsite);
  if (!normalizedOrigin) {
    return '';
  }

  const homepage = searchEvidence.find((item) => {
    if (!item || item.siteKind !== kind || item.pageType !== 'homepage' || !item.logo) {
      return false;
    }

    return hostnameFromUrl(item.url || '') === normalizedOrigin;
  });

  return homepage?.logo || '';
}

function finalizeResult(input, brief, result, metadata, searchEvidence = []) {
  const safeTarget = result?.target || {};
  const safeCompetitors = applyMarketPreference(
    ensureCompetitorCount(result, COMPETITOR_COUNT),
    brief?.marketPreference,
    COMPETITOR_COUNT,
  );
  const modelFeatures = asStringArray(safeTarget.features, 1, []);
  const validFeatures = modelFeatures.filter((feature) => {
    const lower = feature.toLowerCase();
    return ![
      'users not yet clear',
      '待确认用户群体',
      'unclear software category',
      '待识别软件类别',
      'general users',
      'target user',
      'product category',
    ].includes(lower);
  });
  const modelTargetName = asString(safeTarget.name, '');
  const briefTargetName = asString(brief.targetName, '');
  const finalTargetName =
    briefTargetName && (looksLikeCategoryLabel(modelTargetName) || !modelTargetName)
      ? briefTargetName
      : modelTargetName || brief.referenceProduct || 'Target Product';
  const finalFeatures = validFeatures.slice(0, 6);

  return {
    routing: result?.routing,
    officialSiteDiscovery: result?.officialSiteDiscovery,
    brief,
    analysisDebug: {
      target: result?.target || undefined,
      competitors: Array.isArray(result?.competitors) ? result.competitors : [],
      summary: asString(result?.summary, ''),
    },
    searchEvidence,
    target: {
      name: finalTargetName,
      inputQuery: input.query,
      sourceLabel: input.url ? 'URL analysis' : 'Description analysis',
      positioning: asString(
        safeTarget.positioning,
        brief.productSummary || (input.lang === 'zh' ? '暂未获得明确定位。' : 'Positioning was not returned clearly.')
      ),
      features: finalFeatures,
      metadata: metadata || undefined,
    },
    competitors: safeCompetitors.slice(0, COMPETITOR_COUNT).map((competitor, index) => ({
      name: asString(competitor?.name, `Competitor ${index + 1}`),
      website: asString(competitor?.website, 'https://example.com'),
      logo: findHomepageLogo(searchEvidence, competitor?.website, 'competitor') || undefined,
      startingPrice: asString(competitor?.startingPrice, 'Custom pricing'),
      bestFor: asString(competitor?.bestFor, 'General users'),
      positioning: asString(
        competitor?.positioning,
        input.lang === 'zh' ? '模型未返回该竞品的定位。' : 'Competitor positioning was not returned by the model.'
      ),
      country: asString(competitor?.country, input.lang === 'zh' ? '未知' : 'Unknown'),
      features: [],
    })),
    summary: asString(
      result?.summary,
      input.lang === 'zh'
        ? '未能稳定生成完整总结，但当前竞品列表仍可作为初步参考。'
        : 'A complete summary could not be generated, but the returned competitor set may still be useful for review.'
    ),
  };
}

function buildPartialResult(input, brief, metadata, searchEvidence = []) {
  const hasConcreteSummary = !isGenericProductSummary(brief.productSummary);
  const partialFeatures = Array.isArray(brief.keyFeatures) ? brief.keyFeatures.slice(0, 6) : [];

  return {
    routing: undefined,
    brief,
    searchEvidence,
    target: {
      name: brief.targetName || brief.referenceProduct || (input.lang === 'zh' ? '目标产品' : 'Target Product'),
      inputQuery: input.query,
      sourceLabel: input.url ? 'URL analysis' : 'Description analysis',
      positioning: hasConcreteSummary ? brief.productSummary : '',
      features: partialFeatures,
      metadata: metadata || undefined,
    },
    competitors: [],
    summary: '',
  };
}

function buildRoutingPartialResult(input, routing, metadata) {
  return {
    routing,
    officialSiteDiscovery: undefined,
    brief: undefined,
    searchEvidence: [],
    target: {
      name: routing?.targetNameGuess || input.query || (input.lang === 'zh' ? '目标产品' : 'Target Product'),
      inputQuery: input.query,
      sourceLabel: input.url ? 'URL analysis' : 'Description analysis',
      positioning: '',
      features: [],
      metadata: metadata || undefined,
    },
    competitors: [],
    summary: '',
  };
}

function isGenericProductSummary(summary) {
  const normalized = asString(summary, '').replace(/[。.!?]/g, '').toLowerCase();

  if (!normalized) return true;

  const genericPatterns = [
    '当前输入指向一个待识别的软件产品或产品类别',
    '待识别的软件产品或产品类别',
    '待识别软件产品',
    '待识别产品类别',
    'the input appears to refer to a software product or product category that needs further identification',
    'software product or product category that needs further identification',
    'product category that needs further identification',
    'needs further identification',
  ];

  return genericPatterns.some((pattern) => normalized.includes(pattern));
}

function looksLikeCategoryLabel(value) {
  const normalized = asString(value, '').replace(/[。.!?]/g, '').toLowerCase();

  if (!normalized) return false;

  return [
    'platform',
    'software',
    'tool',
    'service',
    'solution',
    'workspace',
    'marketing platform',
    'social media',
    'crm',
    'cloud service',
    'cloud platform',
    '数字营销',
    '社交媒体',
    '营销平台',
    '平台',
    '软件',
    '工具',
    '解决方案',
    '工作空间',
    '云服务',
    '云平台',
  ].some((pattern) => normalized.includes(pattern));
}

async function createStructuredJson(kind, input, payload, schema, options = {}) {
  const { onUsage } = options;

  if (provider === 'deepseek' || provider === 'kimi' || provider === 'qwen') {
    const response = await client.chat.completions.create({
      model: resolveModel(),
      messages: buildDeepSeekMessages(kind, input, payload),
      response_format: {
        type: 'json_object',
      },
    });

    onUsage?.(response?.usage || null);

    const output = response.choices?.[0]?.message?.content;
    if (!output) {
      throw new Error('The model did not return structured output.');
    }

    return JSON.parse(output);
  }

  const prompt = kind === 'brief'
    ? buildBriefPrompt(input, payload)
    : kind === 'route'
      ? buildRoutingPrompt(input, payload)
    : kind === 'discovery'
      ? buildDiscoveryPrompt(input, payload)
    : kind === 'unified'
      ? buildUnifiedAnalysisPrompt(input, payload)
    : kind === 'candidate'
      ? buildCandidateDiscoveryPrompt(input, payload)
    : kind === 'detail'
      ? buildCompetitorDetailPrompt(input, payload)
      : kind === 'feature'
        ? buildFeatureExtractionPrompt(input, payload)
        : buildAnalysisPrompt(input, payload);
  const response = await client.responses.create({
    model: resolveModel(),
    reasoning: { effort: 'low' },
    input: prompt,
    text: {
      format: {
        type: 'json_schema',
        name: schema.name,
        schema: schema.schema,
        strict: schema.strict,
      },
    },
  });

  onUsage?.(response?.usage || null);

  const output = response.output_text;
  if (!output) {
    throw new Error('The model did not return structured output.');
  }

  return JSON.parse(output);
}

function inferEvidenceBackedFeatures(searchEvidence, lang) {
  const haystack = Array.isArray(searchEvidence)
    ? searchEvidence.map((item) => `${item.title || ''} ${item.content || ''}`.toLowerCase()).join(' ')
    : '';

  const catalog = [
    {
      patterns: ['creator discovery', 'influencer discovery', 'find creators', '达人搜索', '红人搜索'],
      label: lang === 'zh' ? '达人发现' : 'Creator discovery',
    },
    {
      patterns: ['campaign management', 'campaign workflow', '活动管理', 'campaign'],
      label: lang === 'zh' ? '营销活动管理' : 'Campaign management',
    },
    {
      patterns: ['audience analytics', 'audience insight', '受众分析', 'audience'],
      label: lang === 'zh' ? '受众分析' : 'Audience analytics',
    },
    {
      patterns: ['crm', 'relationship management', '关系管理'],
      label: lang === 'zh' ? '达人关系管理' : 'Creator relationship management',
    },
    {
      patterns: ['reporting', 'report', 'dashboard', '报表', '看板'],
      label: lang === 'zh' ? '数据报表' : 'Reporting',
    },
    {
      patterns: ['cost allocation', '成本分摊', 'allocation'],
      label: lang === 'zh' ? '成本分摊' : 'Cost allocation',
    },
    {
      patterns: ['anomaly detection', '异常检测', 'cost anomaly'],
      label: lang === 'zh' ? '异常检测' : 'Anomaly detection',
    },
    {
      patterns: ['multi-cloud', '多云', 'cross-cloud'],
      label: lang === 'zh' ? '多云成本视图' : 'Multi-cloud cost visibility',
    },
    {
      patterns: ['optimization recommendations', 'optimization', 'rightsizing', '优化建议'],
      label: lang === 'zh' ? '优化建议' : 'Optimization recommendations',
    },
    {
      patterns: ['cost forecasting', 'forecast', '预测'],
      label: lang === 'zh' ? '成本预测' : 'Cost forecasting',
    },
    {
      patterns: ['tag management', 'tagging', '标签管理'],
      label: lang === 'zh' ? '标签管理' : 'Tag management',
    },
    {
      patterns: ['notes', 'docs', 'documentation', 'knowledge base', '笔记', '文档', '知识库'],
      label: lang === 'zh' ? '笔记与文档' : 'Notes and docs',
    },
    {
      patterns: ['database', 'table', '数据库'],
      label: lang === 'zh' ? '数据库视图' : 'Database views',
    },
    {
      patterns: ['team collaboration', 'collaboration', '协作'],
      label: lang === 'zh' ? '团队协作' : 'Team collaboration',
    },
  ];

  return catalog
    .filter((entry) => entry.patterns.some((pattern) => haystack.includes(pattern)))
    .map((entry) => entry.label)
    .slice(0, 6);
}

function extractPriceFromEvidence(searchEvidence, lang, fallback = '') {
  const content = Array.isArray(searchEvidence)
    ? searchEvidence.map((item) => item.content || '').join(' ')
    : '';

  if (!content) return fallback;

  const priceMatch = content.match(/\$ ?\d+(?:\.\d+)?(?:\/(?:mo|month|yr|year))?/i);
  if (priceMatch?.[0]) {
    return priceMatch[0].replace(/\s+/g, '');
  }

  if (/free plan|free tier|永久免费|免费版|free\b/i.test(content)) {
    return lang === 'zh' ? '免费' : 'Free';
  }

  if (/contact sales|contact us for pricing|custom pricing|定制报价|联系销售/i.test(content)) {
    return lang === 'zh' ? '定制报价' : 'Custom pricing';
  }

  return fallback;
}

function extractFundingSignalsFromEvidence(searchEvidence) {
  const content = Array.isArray(searchEvidence)
    ? searchEvidence.map((item) => `${item.title || ''} ${item.content || ''}`).join(' ')
    : '';

  if (!content) {
    return {};
  }

  const stageMatch = content.match(/\b(seed|series a|series b|series c|series d|pre-seed|post-ipo)\b/i);
  const totalFundingMatch = content.match(/\$ ?\d+(?:\.\d+)?\s?(?:million|billion|m|b)/i);
  const latestRoundMatch = content.match(/\b(seed|series a|series b|series c|series d|pre-seed|post-ipo)\b[^.]{0,40}\$ ?\d+(?:\.\d+)?\s?(?:million|billion|m|b)/i);

  return {
    fundingStage: stageMatch?.[0] || '',
    totalFunding: totalFundingMatch?.[0] || '',
    latestRound: latestRoundMatch?.[0] || '',
  };
}

function buildMockCompetitorDetail(targetName, competitor, searchEvidence = [], lang = 'en') {
  return {
    competitor: {
      name: competitor.name,
      website: competitor.website,
      logo: findHomepageLogo(searchEvidence, competitor.website, 'competitor') || undefined,
      country: competitor.country,
      startingPrice: competitor.startingPrice,
      positioning: competitor.positioning,
      bestFor: competitor.bestFor,
    },
    whyRelevant:
      lang === 'zh'
        ? `${competitor.name} 与 ${targetName} 处于相近的软件工作流和目标市场，因此具有直接参考价值。`
        : `${competitor.name} is relevant because it operates in a similar workflow category and addresses a comparable target market to ${targetName}.`,
    overlapWithTarget:
      lang === 'zh'
        ? `${competitor.name} 与 ${targetName} 在核心工作流和目标用户上存在明显重叠。`
        : `${competitor.name} appears to overlap with ${targetName} in both core workflow and target audience.`,
    strongerIn:
      lang === 'zh'
        ? `${competitor.name} 可能在品牌认知、市场成熟度或更完整的功能深度上更强。`
        : `${competitor.name} may be stronger in market maturity, brand recognition, or depth of functionality.`,
    targetDifferentiation:
      lang === 'zh'
        ? `${targetName} 可以通过更聚焦的体验、更轻量的实施方式或更清晰的产品定位形成差异化。`
        : `${targetName} may differentiate through a more focused user experience, lighter implementation, or clearer positioning.`,
    keyCapabilities: [competitor.bestFor, competitor.positioning, competitor.startingPrice].filter(Boolean).slice(0, 3),
    companySignals: {},
    searchEvidence,
  };
}

async function runCompetitorDetail(input, payload, hooks = {}) {
  const { onLog } = hooks;
  const { targetName, competitor } = payload;

  if (!client) {
    onLog?.(input.lang === 'zh' ? '未配置在线模型，使用本地 mock 详情。' : 'Using local mock detail because no live model is configured.');
    return buildMockCompetitorDetail(targetName, competitor, [], input.lang);
  }

  onLog?.(input.lang === 'zh'
    ? `正在抓取竞品官网页面：${competitor.website}`
    : `Crawling competitor website: ${competitor.website}`);
  const searchEvidence = await gatherCompetitorDetailEvidence(input, targetName, competitor);
  onLog?.(input.lang === 'zh' ? '正在生成竞品详情分析。' : 'Generating competitor detail analysis.');
  const rawDetail = await createStructuredJson('detail', input, { targetName, competitor, searchEvidence }, competitorDetailSchema, {
    onUsage: (usage) => {
      const line = formatUsageLog('detail', usage, input.lang);
      if (line) onLog?.(line);
    },
  });
  const evidencePrice = extractPriceFromEvidence(searchEvidence, input.lang, competitor.startingPrice);
  const evidenceFunding = extractFundingSignalsFromEvidence(searchEvidence);
  const evidenceCapabilities = inferEvidenceBackedFeatures(searchEvidence, input.lang);
  const homepage = Array.isArray(searchEvidence)
    ? searchEvidence.find((item) => item.pageType === 'homepage')
    : null;

  return {
    logs: [],
    competitor: {
      name: competitor.name,
      website: pickFirstNonEmpty(homepage?.url, competitor.website),
      logo: homepage?.logo || undefined,
      country: competitor.country,
      startingPrice: evidencePrice || competitor.startingPrice,
      positioning: competitor.positioning,
      bestFor: competitor.bestFor,
    },
    whyRelevant: asString(rawDetail?.whyRelevant, input.lang === 'zh' ? '该产品与目标产品存在明显竞争关系。' : 'This product appears to be a relevant competitor to the target.'),
    overlapWithTarget: asString(rawDetail?.overlapWithTarget, input.lang === 'zh' ? '两者存在核心工作流重叠。' : 'The two products appear to overlap in core workflow.'),
    strongerIn: asString(rawDetail?.strongerIn, input.lang === 'zh' ? '该竞品可能在成熟度或功能深度上更强。' : 'This competitor may be stronger in maturity or depth.'),
    targetDifferentiation: asString(rawDetail?.targetDifferentiation, input.lang === 'zh' ? '目标产品仍可能通过聚焦定位形成差异。' : 'The target may still differentiate through focus or positioning.'),
    keyCapabilities: asStringArray(rawDetail?.keyCapabilities, 1, evidenceCapabilities).slice(0, 6),
    companySignals: {
      fundingStage: asString(rawDetail?.companySignals?.fundingStage, evidenceFunding.fundingStage || ''),
      totalFunding: asString(rawDetail?.companySignals?.totalFunding, evidenceFunding.totalFunding || ''),
      latestRound: asString(rawDetail?.companySignals?.latestRound, evidenceFunding.latestRound || ''),
    },
    searchEvidence,
  };
}

async function runAnalysis(input, metadata, hooks = {}) {
  const { onRoute, onBrief, onSearch, onComplete, onLog, onUnifiedStart } = hooks;

  if (!client) {
    onLog?.(input.lang === 'zh' ? '未配置在线模型，使用本地 mock 结果。' : 'Using local mock result because no live model is configured.');
    const mockResult = buildMockAnalysis(input.query, metadata, input.lang);
    if (onBrief && mockResult.brief) {
      onBrief(mockResult.brief, buildPartialResult(input, mockResult.brief, metadata));
    }
    if (onSearch) {
      onSearch(mockResult.searchEvidence || [], buildPartialResult(input, mockResult.brief || {}, metadata, mockResult.searchEvidence || []));
    }
    if (onComplete) {
      onComplete(mockResult);
    }
    return mockResult;
  }

  let workingInput = { ...input };
  let workingMetadata = metadata;
  let routeDecision;
  let officialSiteDiscovery;
  let targetWebsiteEvidence = [];

  if (!input.url) {
    onLog?.(input.lang === 'zh' ? '正在判断输入类型与是否需要搜索官网。' : 'Determining input type and whether official-site discovery is needed.');
    const rawRouteDecision = await createStructuredJson('route', input, metadata, routingDecisionSchema, {
      onUsage: (usage) => {
        const line = formatUsageLog('route', usage, input.lang);
        if (line) onLog?.(line);
      },
    });
    routeDecision = normalizeRoutingDecision(input, rawRouteDecision);
    if (onRoute) {
      onRoute(routeDecision, buildRoutingPartialResult(input, routeDecision, workingMetadata));
    }

    if (routeDecision.policyDecision === 'block') {
      onLog?.(input.lang === 'zh'
        ? `请求已被策略拦截：${routeDecision.policyReason || 'unsupported'}`
        : `Request blocked by policy: ${routeDecision.policyReason || 'unsupported'}`);
      throw new Error(buildPolicyBlockedError(input.lang));
    }

    if (routeDecision.shouldSearchOfficialSite) {
      onLog?.(input.lang === 'zh'
        ? `正在搜索官网候选：${routeDecision.targetNameGuess || input.query}`
        : `Searching official-site candidates for ${routeDecision.targetNameGuess || input.query}`);
      officialSiteDiscovery = await discoverOfficialSite(input, routeDecision);
      if (onRoute) {
        onRoute(routeDecision, {
          ...buildRoutingPartialResult(input, routeDecision, workingMetadata),
          officialSiteDiscovery,
        });
      }
      if (officialSiteDiscovery?.selectedUrl) {
        onLog?.(input.lang === 'zh'
          ? `已找到官网：${officialSiteDiscovery.selectedUrl}`
          : `Official site selected: ${officialSiteDiscovery.selectedUrl}`);
        workingInput = {
          ...input,
          url: officialSiteDiscovery.selectedUrl,
        };
        const discoveredMetadata = await fetchUrlMetadata(officialSiteDiscovery.selectedUrl);
        workingMetadata = {
          ...(workingMetadata || {}),
          ...(discoveredMetadata || {}),
          website: officialSiteDiscovery.selectedUrl,
        };
      } else if (routeDecision.entityType === 'brand' || routeDecision.inputKind === 'brand_query') {
        onLog?.(input.lang === 'zh' ? '未找到可信官网，分析终止。' : 'No reliable official site found. Stopping analysis.');
        throw new Error(buildInsufficientSiteDiscoveryError(input.lang, input.query));
      }
    }
  }

  if (workingInput.url) {
    onLog?.(input.lang === 'zh'
      ? `正在抓取官网页面：${workingInput.url}`
      : `Crawling target website: ${workingInput.url}`);
    targetWebsiteEvidence = await crawlSiteEvidence(
      {
        kind: 'target',
        name: routeDecision?.targetNameGuess || workingMetadata?.title || workingMetadata?.domain || input.query,
        website: workingInput.url,
        positioning: '',
      },
      input.lang,
    );
    workingMetadata = mergeMetadataWithEvidence(
      workingMetadata,
      {
        target: {
          name: routeDecision?.targetNameGuess || workingMetadata?.title || workingMetadata?.domain || input.query,
          website: workingInput.url,
          positioning: '',
        },
        competitors: [],
      },
      targetWebsiteEvidence,
    );
  }

  onLog?.(input.lang === 'zh'
    ? '正在理解目标产品、发现竞品候选并生成分析。'
    : 'Understanding the target, discovering competitor seeds, and generating analysis.');
  onUnifiedStart?.();
  const rawUnified = await createStructuredJson(
    'unified',
    workingInput,
    { metadata: workingMetadata, searchEvidence: targetWebsiteEvidence },
    unifiedAnalysisSchema,
    {
      onUsage: (usage) => {
        const line = formatUsageLog('unified', usage, input.lang);
        if (line) onLog?.(line);
      },
    },
  );
  const brief = normalizeBrief(workingInput, rawUnified?.brief, workingMetadata);
  const candidateSeeds = normalizeCandidateSeeds(workingInput, brief, workingMetadata, rawUnified?.candidateSeeds);
  if (onBrief) {
    onBrief(brief, {
      ...buildPartialResult(input, brief, workingMetadata, targetWebsiteEvidence),
      routing: routeDecision,
      officialSiteDiscovery,
    });
  }
  const searchEvidence = targetWebsiteEvidence;
  const mergedMetadata = mergeMetadataWithEvidence(workingMetadata, candidateSeeds, targetWebsiteEvidence);
  onLog?.(input.lang === 'zh'
    ? `已识别 ${candidateSeeds.competitors.length} 个竞品候选，正在整理分析输入。`
    : `Identified ${candidateSeeds.competitors.length} competitor candidates. Preparing final analysis input.`);
  if (onSearch) {
    onSearch(searchEvidence, {
      ...buildPartialResult(input, brief, mergedMetadata, searchEvidence),
      routing: routeDecision,
      officialSiteDiscovery,
    });
  }

  if (!brief.enoughInformation && !brief.category.trim() && !searchEvidence.length) {
    throw new Error(
      input.lang === 'zh'
        ? '当前 URL 提供的信息不足，无法可靠识别产品并生成竞品结果。请补充一句产品描述后再试。'
        : 'The current URL does not provide enough product information for a reliable competitor search. Please add a short product description and try again.'
    );
  }

  const finalResult = finalizeResult(
    input,
    brief,
    { ...(rawUnified?.analysis || {}), routing: routeDecision, officialSiteDiscovery },
    mergedMetadata,
    searchEvidence,
  );
  if (onComplete) {
    onComplete(finalResult);
  }
  return finalResult;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: client ? 'live' : 'mock',
    provider,
    searchProvider: resolveSearchProvider() || 'none',
    tavily: Boolean(tavilyApiKey),
    bocha: Boolean(bochaApiKey),
    serper: Boolean(serperApiKey),
    searxng: Boolean(searxngBaseUrl),
    date: new Date().toISOString(),
  });
});

app.post('/api/analyze/start', async (req, res) => {
  const normalized = normalizeInput(req.body);
  const input = parseQuery(normalized.query, normalized.lang);

  if (!input.query) {
    res.status(400).json({ error: 'Please provide a product URL or a product description.' });
    return;
  }

  if (shouldTriggerDemoError(input.query)) {
    res.status(400).json({ error: 'The analysis could not be generated for this input. Try a different product URL or description.' });
    return;
  }

  const job = createJob(input);

  void (async () => {
    try {
      appendJobLog(job, input.lang === 'zh' ? '任务已开始。' : 'Analysis started.');
      const metadata = await fetchUrlMetadata(input.url);

      updateJobStep(job, STEP_IDS.understand, 'running');
      const result = await runAnalysis(input, metadata, {
        onLog: (message) => appendJobLog(job, message),
        onRoute: (_routing, partialResult) => {
          setJobPartialResult(job, partialResult);
        },
        onUnifiedStart: () => {
          updateJobStep(job, STEP_IDS.understand, 'completed');
          updateJobStep(job, STEP_IDS.search, 'completed');
          updateJobStep(job, STEP_IDS.analyze, 'running');
        },
        onBrief: (_brief, partialResult) => {
          setJobPartialResult(job, partialResult);
        },
        onSearch: (_searchEvidence, partialResult) => {
          setJobPartialResult(job, partialResult);
        },
        onComplete: (finalResult) => {
          appendJobLog(job, input.lang === 'zh' ? '分析已完成。' : 'Analysis completed.');
          updateJobStep(job, STEP_IDS.analyze, 'completed');
          completeJob(job, finalResult);
        },
      });

      if (job.status !== 'completed') {
        completeJob(job, result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown analysis error.';
      appendJobLog(job, input.lang === 'zh' ? `分析失败：${message}` : `Analysis failed: ${message}`);
      updateJobStep(job, STEP_IDS.understand, job.steps[0].status === 'completed' ? 'completed' : 'failed');
      updateJobStep(job, STEP_IDS.search, job.steps[1].status === 'running' ? 'failed' : job.steps[1].status);
      updateJobStep(job, STEP_IDS.analyze, job.steps[2].status === 'running' ? 'failed' : job.steps[2].status);
      failJob(job, client ? `Live analysis failed: ${message}` : message);
    }
  })();

  res.json({
    jobId: job.id,
  });
});

app.get('/api/analyze/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    res.status(404).json({ error: 'Analysis job not found.' });
    return;
  }

  res.json({
    jobId: job.id,
    status: job.status,
    error: job.error,
    steps: job.steps,
    logs: job.logs,
    partialResult: job.partialResult,
    result: job.result,
  });
});

app.post('/api/analyze', async (req, res) => {
  const normalized = normalizeInput(req.body);
  const input = parseQuery(normalized.query, normalized.lang);

  if (!input.query) {
    res.status(400).json({ error: 'Please provide a product URL or a product description.' });
    return;
  }

  if (shouldTriggerDemoError(input.query)) {
    res.status(400).json({ error: 'The analysis could not be generated for this input. Try a different product URL or description.' });
    return;
  }

  try {
    const metadata = await fetchUrlMetadata(input.url);
    const result = await runAnalysis(input, metadata);
    res.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown analysis error.';

    if (client) {
      res.status(502).json({ error: `Live analysis failed: ${message}` });
      return;
    }

    res.json({
      result: buildMockAnalysis(input.query, undefined, input.lang),
    });
  }
});

app.post('/api/competitor-detail', async (req, res) => {
  const lang = req.body?.lang === 'zh' ? 'zh' : 'en';
  const input = {
    query: '',
    url: '',
    description: '',
    lang,
  };
  const targetName = asString(req.body?.targetName, '');
  const competitor = req.body?.competitor || {};

  if (!targetName || !asString(competitor?.name, '')) {
    res.status(400).json({ error: 'Target and competitor are required.' });
    return;
  }

  try {
    const detailStartedAt = Date.now();
    const logs = [];
    const appendDetailLog = (message) => {
      const prefix = `${Math.max(0, Math.round((Date.now() - detailStartedAt) / 1000))}s`;
      logs.push(`${prefix}  ${message}`);
    };
    appendDetailLog(lang === 'zh' ? '竞品详情分析已开始。' : 'Competitor detail analysis started.');
    const detail = await runCompetitorDetail(input, {
      targetName,
      competitor: {
        name: asString(competitor.name, ''),
        website: asString(competitor.website, ''),
        country: asString(competitor.country, ''),
        startingPrice: asString(competitor.startingPrice, ''),
        positioning: asString(competitor.positioning, ''),
        bestFor: asString(competitor.bestFor, ''),
      },
    }, {
      onLog: appendDetailLog,
    });
    appendDetailLog(lang === 'zh' ? '竞品详情分析已完成。' : 'Competitor detail analysis completed.');
    res.json({ detail: { ...detail, logs } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown competitor detail error.';

    if (client) {
      res.status(502).json({ error: `Live competitor detail failed: ${message}` });
      return;
    }

    res.json({
      detail: buildMockCompetitorDetail(targetName, competitor, [], lang),
    });
  }
});

app.post('/api/feedback', async (req, res) => {
  const query = asString(req.body?.query, '');
  const rating = asString(req.body?.rating, '');
  const comment = asString(req.body?.comment, '');

  if (!query || !['helpful', 'neutral', 'unhelpful'].includes(rating)) {
    res.status(400).json({ error: 'Query and a valid rating are required.' });
    return;
  }

  try {
    await createFeishuBitableRecord({
      created_at: new Date().toISOString(),
      query,
      rating,
      comment,
      status: 'new',
    });
    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown feedback error.';
    console.error('[feedback] failed', message);
    res.status(502).json({ error: `Feedback submission failed: ${message}` });
  }
});

if (hasDistBuild) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(distIndexPath);
  });
}

app.listen(port, () => {
  console.log(`${hasDistBuild ? 'App' : 'API'} server listening on http://localhost:${port}`);
});

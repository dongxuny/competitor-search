import type { AnalysisResult, Competitor } from '../types';

interface Scenario {
  id: string;
  matches: string[];
  target: {
    name: string;
    positioning: string;
    features: string[];
  };
  competitors: Competitor[];
  summary: string;
  metadata: {
    title: string;
    description: string;
    headings: string[];
    excerpt: string;
  };
}

const scenarios: Scenario[] = [
  {
    id: 'competitor-intelligence',
    matches: ['competitor', 'pricing intelligence', 'battlecard', 'compare', 'crayon', 'klue', 'kompyte'],
    target: {
      name: 'SignalDeck',
      positioning:
        'Positioned as a lightweight competitor intelligence tool for SaaS teams that need faster market visibility and clearer product comparisons.',
      features: ['AI summaries', 'Competitor tracking', 'Comparison table', 'Pricing intelligence', 'Export reports'],
    },
    competitors: [
      {
        name: 'Crayon',
        website: 'https://www.crayon.co',
        startingPrice: 'Custom pricing',
        bestFor: 'Enterprise monitoring',
        positioning: 'Enterprise-grade competitive intelligence for go-to-market teams.',
        country: 'United States',
        features: [
          { name: 'AI summaries', available: true },
          { name: 'Competitor tracking', available: true },
          { name: 'Comparison table', available: true },
          { name: 'Pricing intelligence', available: true },
          { name: 'Export reports', available: true },
        ],
      },
      {
        name: 'Klue',
        website: 'https://www.klue.com',
        startingPrice: 'Custom pricing',
        bestFor: 'Sales enablement',
        positioning: 'Battlecards and competitor intelligence focused on sales workflows.',
        country: 'Canada',
        features: [
          { name: 'AI summaries', available: true },
          { name: 'Competitor tracking', available: true },
          { name: 'Comparison table', available: true },
          { name: 'Pricing intelligence', available: false },
          { name: 'Export reports', available: true },
        ],
      },
      {
        name: 'Kompyte',
        website: 'https://www.kompyte.com',
        startingPrice: '$300+/mo',
        bestFor: 'Automated alerts',
        positioning: 'Competitor monitoring with automated updates and alerting.',
        country: 'United States',
        features: [
          { name: 'AI summaries', available: false },
          { name: 'Competitor tracking', available: true },
          { name: 'Comparison table', available: true },
          { name: 'Pricing intelligence', available: true },
          { name: 'Export reports', available: false },
        ],
      },
    ],
    summary:
      'SignalDeck appears to sit in a focused segment of the competitive intelligence market, where smaller SaaS teams may prefer speed, clarity, and pricing visibility over the broader but heavier workflows offered by enterprise incumbents.',
    metadata: {
      title: 'SignalDeck | Competitor Intelligence for SaaS Teams',
      description: 'Track competitors, monitor pricing changes, and generate concise AI summaries for faster market analysis.',
      headings: ['Competitor tracking', 'Pricing intelligence', 'Comparison workflows', 'Export reports'],
      excerpt:
        'SignalDeck presents itself as a lightweight competitor analysis workflow for SaaS teams that need faster market visibility, clear pricing snapshots, and structured comparison output.',
    },
  },
  {
    id: 'crm',
    matches: ['crm', 'pipeline', 'sales crm', 'hubspot', 'pipedrive', 'deals', 'lead management'],
    target: {
      name: 'PipelineOS',
      positioning:
        'Positioned as a focused CRM for small sales teams that want pipeline visibility and lighter operational overhead.',
      features: ['Pipeline tracking', 'Contact management', 'Email sync', 'Workflow automation', 'Forecasting'],
    },
    competitors: [
      {
        name: 'HubSpot CRM',
        website: 'https://www.hubspot.com/products/crm',
        startingPrice: 'Free / Paid hubs',
        bestFor: 'All-in-one CRM',
        positioning: 'Broad CRM platform for marketing, sales, and service teams.',
        country: 'United States',
        features: [
          { name: 'Pipeline tracking', available: true },
          { name: 'Contact management', available: true },
          { name: 'Email sync', available: true },
          { name: 'Workflow automation', available: true },
          { name: 'Forecasting', available: true },
        ],
      },
      {
        name: 'Pipedrive',
        website: 'https://www.pipedrive.com',
        startingPrice: '$14+/user/mo',
        bestFor: 'Sales pipelines',
        positioning: 'Pipeline-centric CRM built for day-to-day sales execution.',
        country: 'Estonia',
        features: [
          { name: 'Pipeline tracking', available: true },
          { name: 'Contact management', available: true },
          { name: 'Email sync', available: true },
          { name: 'Workflow automation', available: true },
          { name: 'Forecasting', available: false },
        ],
      },
      {
        name: 'Close',
        website: 'https://www.close.com',
        startingPrice: '$49+/user/mo',
        bestFor: 'Inside sales',
        positioning: 'Sales CRM with calling and email workflows for revenue teams.',
        country: 'United States',
        features: [
          { name: 'Pipeline tracking', available: true },
          { name: 'Contact management', available: true },
          { name: 'Email sync', available: true },
          { name: 'Workflow automation', available: true },
          { name: 'Forecasting', available: true },
        ],
      },
    ],
    summary:
      'PipelineOS appears positioned in the lighter end of the CRM market, where smaller sales teams are likely to value faster setup, simpler pipeline workflows, and lower operational overhead over full revenue-platform breadth.',
    metadata: {
      title: 'PipelineOS | Simple Sales CRM',
      description: 'A pipeline-first CRM with lightweight automation, contact management, and sales forecasting.',
      headings: ['Pipeline visibility', 'Automation', 'Email sync', 'Forecasting'],
      excerpt:
        'PipelineOS focuses on startup sales teams that want a cleaner CRM experience with fast setup, clear deal stages, and lightweight workflow automation.',
    },
  },
  {
    id: 'seo',
    matches: ['seo', 'search console', 'keywords', 'backlinks', 'ahrefs', 'semrush', 'organic traffic'],
    target: {
      name: 'Rankforge',
      positioning:
        'Positioned as an SEO workflow tool for lean marketing teams that need search visibility, site audits, and simpler reporting.',
      features: ['Keyword tracking', 'SERP analysis', 'Site audit', 'Backlink monitoring', 'Reporting'],
    },
    competitors: [
      {
        name: 'Ahrefs',
        website: 'https://ahrefs.com',
        startingPrice: '$129+/mo',
        bestFor: 'SEO teams',
        positioning: 'Deep SEO toolkit for keywords, backlinks, and search visibility.',
        country: 'Singapore',
        features: [
          { name: 'Keyword tracking', available: true },
          { name: 'SERP analysis', available: true },
          { name: 'Site audit', available: true },
          { name: 'Backlink monitoring', available: true },
          { name: 'Reporting', available: true },
        ],
      },
      {
        name: 'Semrush',
        website: 'https://www.semrush.com',
        startingPrice: '$140+/mo',
        bestFor: 'Growth marketers',
        positioning: 'SEO and search marketing suite with broad content and ranking workflows.',
        country: 'United States',
        features: [
          { name: 'Keyword tracking', available: true },
          { name: 'SERP analysis', available: true },
          { name: 'Site audit', available: true },
          { name: 'Backlink monitoring', available: true },
          { name: 'Reporting', available: true },
        ],
      },
      {
        name: 'Moz Pro',
        website: 'https://moz.com/products/pro',
        startingPrice: '$99+/mo',
        bestFor: 'SEO basics',
        positioning: 'SEO software for ranking visibility and site health monitoring.',
        country: 'United States',
        features: [
          { name: 'Keyword tracking', available: true },
          { name: 'SERP analysis', available: true },
          { name: 'Site audit', available: true },
          { name: 'Backlink monitoring', available: false },
          { name: 'Reporting', available: true },
        ],
      },
    ],
    summary:
      'Rankforge appears to fit a narrower SEO workflow segment, where lean marketing teams may prioritize simpler reporting, ranking visibility, and practical optimization workflows over the broader scope of larger search marketing suites.',
    metadata: {
      title: 'Rankforge | SEO Workflows for Marketing Teams',
      description: 'Track rankings, monitor backlinks, run site audits, and generate reporting for SEO workflows.',
      headings: ['Keyword tracking', 'SERP analysis', 'Backlinks', 'Reporting'],
      excerpt:
        'Rankforge is presented as a practical SEO workflow product for marketers who need ranking visibility, lightweight reporting, and ongoing optimization support.',
    },
  },
  {
    id: 'support',
    matches: ['support', 'help desk', 'customer service', 'intercom', 'zendesk', 'ticket'],
    target: {
      name: 'ReplyFlow',
      positioning:
        'Positioned as a support workflow product for SaaS teams that want modern inbox collaboration and lighter support operations.',
      features: ['Shared inbox', 'AI replies', 'Knowledge base', 'Automation rules', 'CSAT tracking'],
    },
    competitors: [
      {
        name: 'Intercom',
        website: 'https://www.intercom.com',
        startingPrice: 'Custom pricing',
        bestFor: 'AI support',
        positioning: 'Customer service platform focused on messaging and AI support automation.',
        country: 'United States',
        features: [
          { name: 'Shared inbox', available: true },
          { name: 'AI replies', available: true },
          { name: 'Knowledge base', available: true },
          { name: 'Automation rules', available: true },
          { name: 'CSAT tracking', available: true },
        ],
      },
      {
        name: 'Zendesk',
        website: 'https://www.zendesk.com',
        startingPrice: '$55+/agent/mo',
        bestFor: 'Support teams',
        positioning: 'Service software for support teams managing larger operations.',
        country: 'United States',
        features: [
          { name: 'Shared inbox', available: true },
          { name: 'AI replies', available: true },
          { name: 'Knowledge base', available: true },
          { name: 'Automation rules', available: true },
          { name: 'CSAT tracking', available: true },
        ],
      },
      {
        name: 'Help Scout',
        website: 'https://www.helpscout.com',
        startingPrice: '$50+/mo',
        bestFor: 'SaaS support',
        positioning: 'Shared inbox and knowledge base tool for modern support teams.',
        country: 'United States',
        features: [
          { name: 'Shared inbox', available: true },
          { name: 'AI replies', available: false },
          { name: 'Knowledge base', available: true },
          { name: 'Automation rules', available: true },
          { name: 'CSAT tracking', available: true },
        ],
      },
    ],
    summary:
      'ReplyFlow appears positioned between lightweight inbox tools and broader support suites, with its strongest appeal likely coming from simpler setup and more modern AI-assisted workflows for growing SaaS support teams.',
    metadata: {
      title: 'ReplyFlow | Customer Support for SaaS Teams',
      description: 'Manage support conversations with a shared inbox, automation rules, AI-assisted replies, and a lightweight knowledge base.',
      headings: ['Shared inbox', 'Automation rules', 'AI-assisted replies', 'Knowledge base'],
      excerpt:
        'ReplyFlow is presented as a support workflow for SaaS teams that need a shared inbox, faster replies, and enough automation without the complexity of enterprise service tools.',
    },
  },
];

function extractNameFromUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return hostname.split('.')[0]?.replace(/[-_]/g, ' ') || 'Target Product';
  } catch {
    return 'Target Product';
  }
}

function extractNameFromDescription(description: string) {
  const cleaned = description.trim().split(/[,.]/)[0];
  if (!cleaned) return 'Target Product';
  return cleaned.split(' ').slice(0, 3).join(' ');
}

export function normalizeQuery(query: string) {
  const trimmed = query.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);

  return {
    query: trimmed,
    url: isUrl ? trimmed : '',
    description: isUrl ? '' : trimmed,
  };
}

function inferScenario(query: string) {
  const haystack = query.toLowerCase();
  return scenarios.find((scenario) => scenario.matches.some((keyword) => haystack.includes(keyword))) ?? scenarios[0];
}

export function buildMockAnalysis(query: string): AnalysisResult {
  const normalized = normalizeQuery(query);
  const scenario = inferScenario(normalized.query);
  const inferredName = normalized.url ? extractNameFromUrl(normalized.url) : extractNameFromDescription(normalized.description);
  const targetName = inferredName
    ? inferredName.replace(/\b\w/g, (char) => char.toUpperCase())
    : scenario.target.name;

  return {
    target: {
      name: targetName,
      inputQuery: normalized.query,
      sourceLabel: normalized.url ? 'URL analysis' : 'Description analysis',
      positioning: scenario.target.positioning,
      features: scenario.target.features,
      metadata: {
        domain: normalized.url ? (() => {
          try {
            return new URL(normalized.url).hostname.replace('www.', '');
          } catch {
            return undefined;
          }
        })() : undefined,
        ...scenario.metadata,
      },
    },
    competitors: scenario.competitors,
    summary: scenario.summary,
  };
}

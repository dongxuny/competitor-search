function buildFeatureFlags(featureNames, availableIndexes) {
  return featureNames.map((name, index) => ({
    name,
    available: availableIndexes.includes(index),
  }));
}

const scenarios = [
  {
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
        features: buildFeatureFlags(['AI summaries', 'Competitor tracking', 'Comparison table', 'Pricing intelligence', 'Export reports'], [0, 1, 2, 3, 4]),
      },
      {
        name: 'Klue',
        website: 'https://www.klue.com',
        startingPrice: 'Custom pricing',
        bestFor: 'Sales enablement',
        positioning: 'Battlecards and competitor intelligence focused on sales workflows.',
        country: 'Canada',
        features: buildFeatureFlags(['AI summaries', 'Competitor tracking', 'Comparison table', 'Pricing intelligence', 'Export reports'], [0, 1, 2, 4]),
      },
      {
        name: 'Kompyte',
        website: 'https://www.kompyte.com',
        startingPrice: '$300+/mo',
        bestFor: 'Automated alerts',
        positioning: 'Competitor monitoring with automated updates and alerting.',
        country: 'United States',
        features: buildFeatureFlags(['AI summaries', 'Competitor tracking', 'Comparison table', 'Pricing intelligence', 'Export reports'], [1, 2, 3]),
      },
    ],
    summary:
      'SignalDeck appears to sit in a focused segment of the competitive intelligence market, where smaller SaaS teams may prefer speed, clarity, and pricing visibility over the broader but heavier workflows offered by enterprise incumbents.',
  },
  {
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
        features: buildFeatureFlags(['Pipeline tracking', 'Contact management', 'Email sync', 'Workflow automation', 'Forecasting'], [0, 1, 2, 3, 4]),
      },
      {
        name: 'Pipedrive',
        website: 'https://www.pipedrive.com',
        startingPrice: '$14+/user/mo',
        bestFor: 'Sales pipelines',
        positioning: 'Pipeline-centric CRM built for day-to-day sales execution.',
        country: 'Estonia',
        features: buildFeatureFlags(['Pipeline tracking', 'Contact management', 'Email sync', 'Workflow automation', 'Forecasting'], [0, 1, 2, 3]),
      },
      {
        name: 'Close',
        website: 'https://www.close.com',
        startingPrice: '$49+/user/mo',
        bestFor: 'Inside sales',
        positioning: 'Sales CRM with calling and email workflows for revenue teams.',
        country: 'United States',
        features: buildFeatureFlags(['Pipeline tracking', 'Contact management', 'Email sync', 'Workflow automation', 'Forecasting'], [0, 1, 2, 3, 4]),
      },
    ],
    summary:
      'PipelineOS appears positioned in the lighter end of the CRM market, where smaller sales teams are likely to value faster setup, simpler pipeline workflows, and lower operational overhead over full revenue-platform breadth.',
  },
  {
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
        features: buildFeatureFlags(['Keyword tracking', 'SERP analysis', 'Site audit', 'Backlink monitoring', 'Reporting'], [0, 1, 2, 3, 4]),
      },
      {
        name: 'Semrush',
        website: 'https://www.semrush.com',
        startingPrice: '$140+/mo',
        bestFor: 'Growth marketers',
        positioning: 'SEO and search marketing suite with broad content and ranking workflows.',
        country: 'United States',
        features: buildFeatureFlags(['Keyword tracking', 'SERP analysis', 'Site audit', 'Backlink monitoring', 'Reporting'], [0, 1, 2, 3, 4]),
      },
      {
        name: 'Moz Pro',
        website: 'https://moz.com/products/pro',
        startingPrice: '$99+/mo',
        bestFor: 'SEO basics',
        positioning: 'SEO software for ranking visibility and site health monitoring.',
        country: 'United States',
        features: buildFeatureFlags(['Keyword tracking', 'SERP analysis', 'Site audit', 'Backlink monitoring', 'Reporting'], [0, 1, 2, 4]),
      },
    ],
    summary:
      'Rankforge appears to fit a narrower SEO workflow segment, where lean marketing teams may prioritize simpler reporting, ranking visibility, and practical optimization workflows over the broader scope of larger search marketing suites.',
  },
  {
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
        features: buildFeatureFlags(['Shared inbox', 'AI replies', 'Knowledge base', 'Automation rules', 'CSAT tracking'], [0, 1, 2, 3, 4]),
      },
      {
        name: 'Zendesk',
        website: 'https://www.zendesk.com',
        startingPrice: '$55+/agent/mo',
        bestFor: 'Support teams',
        positioning: 'Service software for support teams managing larger operations.',
        country: 'United States',
        features: buildFeatureFlags(['Shared inbox', 'AI replies', 'Knowledge base', 'Automation rules', 'CSAT tracking'], [0, 1, 2, 3, 4]),
      },
      {
        name: 'Help Scout',
        website: 'https://www.helpscout.com',
        startingPrice: '$50+/mo',
        bestFor: 'SaaS support',
        positioning: 'Shared inbox and knowledge base tool for modern support teams.',
        country: 'United States',
        features: buildFeatureFlags(['Shared inbox', 'AI replies', 'Knowledge base', 'Automation rules', 'CSAT tracking'], [0, 2, 3, 4]),
      },
    ],
    summary:
      'ReplyFlow appears positioned between lightweight inbox tools and broader support suites, with its strongest appeal likely coming from simpler setup and more modern AI-assisted workflows for growing SaaS support teams.',
  },
];

function normalizeQuery(query) {
  const trimmed = query.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);
  return {
    query: trimmed,
    url: isUrl ? trimmed : '',
    description: isUrl ? '' : trimmed,
  };
}

function extractNameFromUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return hostname.split('.')[0]?.replace(/[-_]/g, ' ') || 'Target Product';
  } catch {
    return 'Target Product';
  }
}

function extractNameFromDescription(description) {
  const cleaned = description.trim().split(/[,.]/)[0];
  if (!cleaned) return 'Target Product';
  return cleaned.split(' ').slice(0, 3).join(' ');
}

function inferScenario(query) {
  const haystack = query.toLowerCase();
  return scenarios.find((scenario) => scenario.matches.some((keyword) => haystack.includes(keyword))) || scenarios[0];
}

export function buildMockAnalysis(query, metadata = null, lang = 'en') {
  const normalized = normalizeQuery(query);
  const scenario = inferScenario(normalized.query);
  const inferredName = normalized.url ? extractNameFromUrl(normalized.url) : extractNameFromDescription(normalized.description);
  const targetName = inferredName ? inferredName.replace(/\b\w/g, (char) => char.toUpperCase()) : scenario.target.name;

  return {
    brief: {
      inputType: normalized.url ? 'url' : 'description',
      targetName,
      referenceProduct: '',
      productSummary: scenario.target.positioning,
      category: scenario.target.positioning,
      subCategory: '',
      targetUsers: lang === 'zh' ? ['待确认用户'] : ['General software teams'],
      searchIntent:
        lang === 'zh'
          ? `寻找与 ${targetName} 最相关的竞品。`
          : `Find the most relevant competitors for ${targetName}.`,
      competitorSearchQuery:
        lang === 'zh' ? `${targetName} 竞品` : `${targetName} competitors`,
      confidence: 'medium',
      enoughInformation: true,
      reasoningNotes: [],
    },
    target: {
      name: targetName,
      inputQuery: normalized.query,
      sourceLabel: normalized.url ? 'URL analysis' : 'Description analysis',
      positioning: scenario.target.positioning,
      features: scenario.target.features,
      metadata: {
        ...(metadata || {}),
      },
    },
    competitors: scenario.competitors,
    summary: scenario.summary,
  };
}

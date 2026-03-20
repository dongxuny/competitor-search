export interface ProductInput {
  query: string;
}

export interface FeatureFlag {
  name: string;
  available: boolean;
}

export interface Competitor {
  name: string;
  website: string;
  logo?: string;
  startingPrice: string;
  bestFor: string;
  positioning: string;
  country: string;
  features: FeatureFlag[];
}

export interface CompetitorDetail {
  logs?: string[];
  competitor: {
    name: string;
    website: string;
    logo?: string;
    country: string;
    startingPrice: string;
    positioning: string;
    bestFor: string;
  };
  whyRelevant: string;
  overlapWithTarget: string;
  strongerIn: string;
  targetDifferentiation: string;
  keyCapabilities: string[];
  companySignals: {
    fundingStage?: string;
    totalFunding?: string;
    latestRound?: string;
  };
  searchEvidence?: SearchEvidenceItem[];
}

export interface SearchEvidenceItem {
  query: string;
  title: string;
  url: string;
  content: string;
  metaDescription?: string;
  h1?: string[];
  h2?: string[];
  h3?: string[];
  snippet?: string;
  score?: number;
  siteName?: string;
  siteKind?: 'target' | 'competitor';
  pageType?: 'homepage' | 'pricing' | 'features' | 'solutions' | 'about' | 'other' | 'detail';
  logo?: string;
}

export interface AnalysisStep {
  id: 'understand' | 'search' | 'analyze';
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number | null;
  completedAt?: number | null;
}

export interface CompetitorSearchBrief {
  inputType: 'url' | 'description' | 'similar_query';
  targetName: string;
  referenceProduct: string;
  productSummary: string;
  marketPreference?: 'china' | 'global' | 'unknown';
  category: string;
  subCategory: string;
  targetUsers: string[];
  keyFeatures?: string[];
  competitorHints?: string;
  competitorCandidates?: Array<{
    name: string;
    website: string;
  }>;
  searchIntent: string;
  competitorSearchQuery: string;
  confidence: 'high' | 'medium' | 'low';
  enoughInformation?: boolean;
  reasoningNotes?: string[];
}

export interface RoutingDecision {
  inputKind: 'url' | 'brand_query' | 'category_query' | 'product_description' | 'similar_query' | 'unclear_query';
  coreEntity: string;
  entityType: 'brand' | 'product' | 'category' | 'unknown';
  hasReliableKnowledge: boolean;
  shouldSearchOfficialSite: boolean;
  policyDecision: 'allow' | 'block';
  policyReason: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  targetNameGuess: string;
}

export interface OfficialSiteDiscovery {
  provider: string;
  queries: string[];
  candidates: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
  selectedUrl?: string;
}

export interface AnalysisResult {
  logs?: string[];
  routing?: RoutingDecision;
  officialSiteDiscovery?: OfficialSiteDiscovery;
  brief?: CompetitorSearchBrief;
  analysisDebug?: {
    target?: {
      name?: string;
      positioning?: string;
      features?: string[];
    };
    competitors?: Array<{
      name?: string;
      website?: string;
      startingPrice?: string;
      bestFor?: string;
      positioning?: string;
      country?: string;
    }>;
    summary?: string;
  };
  searchEvidence?: SearchEvidenceItem[];
  target: {
    name: string;
    inputQuery: string;
    sourceLabel: string;
    positioning: string;
    features: string[];
    metadata?: {
      title?: string;
      description?: string;
      domain?: string;
      headings?: string[];
      excerpt?: string;
      logo?: string;
      website?: string;
    };
  };
  competitors: Competitor[];
  summary: string;
}

export interface AnalysisJobStatus {
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  error: string | null;
  steps: AnalysisStep[];
  logs: string[];
  partialResult: AnalysisResult | null;
  result: AnalysisResult | null;
}

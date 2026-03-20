# AI Competitor Analyzer

A React + TypeScript + Vite + Tailwind app for competitor discovery. The app accepts a product URL or description on `/`, then renders the analysis on `/analyze`. The backend can use local mock data or a live LLM provider, and can optionally enrich the analysis with Tavily search results.

## Features

- React + TypeScript + Vite + Tailwind CSS
- Single input field for URL or product description
- Dedicated `/analyze` page
- Four result states: empty, loading, error, success
- Five result sections:
  - Target Product
  - Competitor Overview
  - Comparison Table
  - AI Summary
  - Actions
- Local mock scenarios for competitor intelligence, CRM, SEO, and support
- Optional Tavily search enrichment for live analysis

## Run Locally

```bash
npm install
npm run dev
```

Open:

- Frontend: `http://localhost:5173`

## LLM Provider

The analysis API can use OpenAI, DeepSeek, Kimi, or Qwen via Alibaba Cloud Model Studio / DashScope. Configure `.env`:

```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-5
```

Or:

```bash
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

Or:

```bash
LLM_PROVIDER=kimi
MOONSHOT_API_KEY=your_kimi_key
MOONSHOT_MODEL=moonshot-v1-8k
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1
```

Or:

```bash
LLM_PROVIDER=qwen
DASHSCOPE_API_KEY=your_dashscope_key
QWEN_MODEL=qwen-plus
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

If the selected provider is not configured, the server falls back to local mock data.

## Search Provider

The live analysis pipeline can enrich evidence with Tavily, Bocha, Serper, or SearXNG.

### Tavily

```bash
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=your_tavily_key
```

### Bocha

```bash
SEARCH_PROVIDER=bocha
BOCHA_API_KEY=your_bocha_key
BOCHA_BASE_URL=https://api.bocha.cn
```

### Serper

```bash
SEARCH_PROVIDER=serper
SERPER_API_KEY=your_serper_key
SERPER_BASE_URL=https://google.serper.dev
```

Official-site discovery fallback order is now:

- `serper`
- `domain guess`

### SearXNG

```bash
SEARCH_PROVIDER=searxng
SEARXNG_BASE_URL=http://localhost:8080
```

When a search provider is configured, the server will:

- generate a competitor search brief
- search external evidence
- feed that evidence into the final competitor analysis step

## Build

```bash
npm run build
npm run preview
```

## Docker

Build for the current machine and load it into the local Docker daemon:

```bash
docker buildx build --platform linux/amd64 -t ai-competitor-analyzer:amd64 --load .
```

If you are on Apple Silicon and want a native local image instead:

```bash
docker buildx build --platform linux/arm64 -t ai-competitor-analyzer:arm64 --load .
```

Run the container:

```bash
docker run --rm -p 8787:8787 --env-file .env ai-competitor-analyzer:amd64
```

Then open:

- App: `http://localhost:8787`

To publish a multi-arch image:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t your-registry/ai-competitor-analyzer:latest \
  --push .
```

## Project Structure

```text
.
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── src
    ├── App.tsx
    ├── index.css
    ├── main.tsx
    ├── types.ts
    ├── components
    │   ├── ComparisonTable.tsx
    │   ├── InputForm.tsx
    │   └── analyze
    │       ├── ActionsSection.tsx
    │       ├── AISummarySection.tsx
    │       ├── CompetitorOverviewSection.tsx
    │       └── TargetProductSection.tsx
    ├── data
    │   └── mockData.ts
    ├── lib
    │   └── mockAnalyze.ts
    └── pages
        ├── AnalyzePage.tsx
        └── HomePage.tsx
```

## Mock Analyze Flow

- Homepage input redirects to `/analyze?q=...`
- `/analyze` performs a local mock analysis
- Empty state: `/analyze` with no query
- Loading state: shown while mock analysis is resolving
- Error state: use `mock-error` as input
- Success state: use any normal URL or description input

## Example Inputs

- `https://example.com/competitor-intelligence`
- `A lightweight CRM for startup sales teams that need pipeline visibility and simple automation.`
- `An SEO product for marketers that tracks keywords, backlinks, and reporting.`
- `mock-error`

# Scraper Pipeline

This directory is a small standalone backend that offloads URL discovery and page fetching while keeping the same response shapes used by the app's current knowledge-base pipeline.

It includes a lightweight local `scrape -> prepare -> upload` orchestrator for development. The `scrape` step can use Firecrawl or Cloudflare Browser Run for acquisition, `prepare` chunks the markdown for retrieval, and `upload` embeds/upserts chunks into Pinecone plus stores chunks in Postgres for lexical retrieval.

## Run

```bash
npm run scraper:dev
```

The service loads `.env` from the repo root and listens on `http://localhost:8787` by default.

## Endpoints

- `GET /health`
- `POST /scrape`
- `POST /scrape/stream`
- `POST /prepare`
- `POST /upload`
- `POST /runs`
- `GET /runs/:runId`
- `POST /runs/:runId/stop`

`POST /scrape` accepts the existing scrape payload:

```json
{
  "scrape_provider": "cloudflare",
  "seed_urls": ["https://example.com/docs"],
  "allowed_prefixes": ["https://example.com/docs/"],
  "max_pages": 50,
  "parallel_workers": 4,
  "respect_allowed_prefixes": true
}
```

The scraper filters results locally against `allowed_prefixes` and writes markdown plus metadata under `.temp/scraper-runs/<run_id>/`.

## Providers

- `scrape_provider: "cloudflare"` uses Cloudflare Browser Run. By default it uses `cloudflare_discovery_mode: "crawl"` with Browser Run `/crawl`. That mode uses `cloudflare_render_mode: "auto"`: try a cheap static crawl first, then retry that seed with browser rendering if the static output is empty or looks like a JavaScript app shell.
- `cloudflare_discovery_mode: "static"` keeps discovery local: the scraper fetches static HTML with the repo's BFS, `allowed_prefixes`, and URL whitelist/blacklist rules, then sends each discovered HTML document to Cloudflare `/markdown`. Use this for docs sites and event pages where link discovery must behave like the old Selenium/static scraper without paying Cloudflare to discover every sidebar link.
- `cloudflare_static_discovery_scope: "allowed_prefixes"` keeps `seed_urls` as the canonical start pages but also lets static discovery enqueue allowed-prefix roots as scope roots. Use it when a site should have one visible base page while trusted allowed areas may be crawled as their own roots.
- `scrape_provider: "firecrawl"` keeps the previous Firecrawl map + batch scrape behavior.
- If a request does not include `scrape_provider`, the scraper uses `SCRAPER_SCRAPE_PROVIDER` / `SCRAPER_PROVIDER`, falling back to `cloudflare`.

Cloudflare `/crawl` accepts wildcard include/exclude patterns, so the scraper converts `allowed_prefixes` into include patterns and still applies the repo's regex whitelist/blacklist after results come back.

## Environment

- `FIRECRAWL_API_KEY` is required when using `scrape_provider: "firecrawl"`.
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are required when using `scrape_provider: "cloudflare"`. The token needs Browser Rendering / Browser Run edit permission.
- `OPENROUTER_API_KEY` is optional for the `prepare.finetune` cleaning pass.
- `PINECONE_API_KEY`, `PINECONE_INDEX`, and `PINECONE_INDEX_HOST` are required for `upload`.
- `SCRAPER_SCRAPE_PROVIDER` can be `cloudflare` or `firecrawl`.
- `FIRECRAWL_BASE_URL` defaults to `https://api.firecrawl.dev`.
- `CLOUDFLARE_API_BASE_URL` defaults to `https://api.cloudflare.com/client/v4`.
- `CLOUDFLARE_CRAWL_RENDER_MODE` defaults to `auto`. Use `static` to force `render: false`, or `browser` to force `render: true`.
- `CLOUDFLARE_DISCOVERY_MODE` defaults to `crawl`. Use `static` to fetch links locally and use Cloudflare only for Markdown conversion.
- `CLOUDFLARE_STATIC_DISCOVERY_SCOPE` defaults to `seed`. Set it to `allowed_prefixes` to let static discovery crawl allowed-prefix roots without adding them to `seed_urls`.
- `CLOUDFLARE_DISCOVERY_TIMEOUT_MS` defaults to `15000`.
- `CLOUDFLARE_DISCOVERY_DELAY_SECONDS` defaults to `0`; use this only to slow local HTML discovery.
- `CLOUDFLARE_CRAWL_RENDER` is still supported as a legacy boolean override.
- `CLOUDFLARE_CRAWL_PURPOSES` defaults to `search,ai-input`.
- `CLOUDFLARE_CRAWL_MAX_AGE` defaults to `86400`.
- `SCRAPER_PORT` defaults to `8787`.
- `SCRAPER_OUTPUT_DIR` defaults to `.temp/scraper-runs`.
- `FIRECRAWL_POLL_INTERVAL_MS` defaults to `2500`.
- `FIRECRAWL_JOB_TIMEOUT_MS` defaults to `900000`.
- `CLOUDFLARE_CRAWL_POLL_INTERVAL_MS` defaults to `5000`.
- `CLOUDFLARE_CRAWL_JOB_TIMEOUT_MS` defaults to `1800000`.
- `CLOUDFLARE_CRAWL_STALL_TIMEOUT_MS` defaults to `120000`; set to `0` to wait only for the full job timeout. If a crawl job stops reporting progress, the scraper records the job as stalled, collects completed records, and continues to the next seed.
- `CLOUDFLARE_REQUEST_TIMEOUT_MS` defaults to `45000`.
- `CLOUDFLARE_REQUEST_MAX_RETRIES` defaults to `1`; the scraper also has job-level retries, so keep this low for broad crawls.
- `CLOUDFLARE_CRAWL_SEED_DELAY_SECONDS` is used when the request does not include `delay`; per-request `delay` is honored between Cloudflare seed jobs.

## Cloudflare Passthroughs

Use `cloudflare_crawl_options` for site-specific Browser Run options. The scraper protects `url`, `limit`, `depth`, `formats`, and `options` fields that must stay aligned with the app's scrape settings.

```json
{
  "scrape_provider": "cloudflare",
  "cloudflare_render_mode": "browser",
  "cloudflare_per_seed_limit": 100,
  "cloudflare_stall_timeout_ms": 60000,
  "cloudflare_crawl_options": {
    "gotoOptions": { "waitUntil": "networkidle2", "timeout": 60000 },
    "waitForSelector": { "selector": "main", "timeout": 30000 },
    "options": {
      "excludePatterns": ["**/archive/**"]
    }
  }
}
```

Use `cloudflare_markdown_options` only with `cloudflare_discovery_mode: "static"` when a site needs Cloudflare `/markdown` options. The scraper protects `url` and `html` because those are set from each discovered page.

```json
{
  "scrape_provider": "cloudflare",
  "cloudflare_discovery_mode": "static",
  "seed_urls": ["https://docs.example.com/"],
  "allowed_prefixes": ["https://docs.example.com/"],
  "max_pages": 300,
  "max_depth": 7,
  "cloudflare_markdown_options": {
    "gotoOptions": { "timeout": 60000 }
  }
}
```

## Firecrawl Passthroughs

Add optional request fields when a specific site needs custom Firecrawl behavior:

```json
{
  "firecrawl_scrape_options": {
    "waitFor": 1000,
    "proxy": "auto"
  },
  "firecrawl_batch_options": {
    "zeroDataRetention": false
  }
}
```

# Firecrawl Scraper

This directory is a small standalone scrape-step backend that offloads URL discovery and page fetching to Firecrawl while keeping the same `POST /scrape` response shape used by the app's current knowledge-base pipeline.

It intentionally implements the acquisition step only. The app's full `scrape -> prepare -> upload` `/runs` workflow still needs the existing pipeline wrapper or a future orchestrator that runs this scraper in the same environment as prepare/upload.

## Run

```bash
FIRECRAWL_API_KEY=fc-... npm run scraper:dev
```

The service listens on `http://localhost:8787` by default.

## Endpoints

- `GET /health`
- `POST /scrape`
- `POST /scrape/stream`

`POST /scrape` accepts the existing scrape payload:

```json
{
  "seed_urls": ["https://example.com/docs"],
  "allowed_prefixes": ["https://example.com/docs/"],
  "max_pages": 50,
  "parallel_workers": 4,
  "respect_allowed_prefixes": true
}
```

The scraper maps URLs with Firecrawl, filters them locally against `allowed_prefixes`, batch-scrapes the final URL set, and writes markdown plus metadata under `.temp/firecrawl-runs/<run_id>/`.

## Environment

- `FIRECRAWL_API_KEY` is required.
- `FIRECRAWL_BASE_URL` defaults to `https://api.firecrawl.dev`.
- `SCRAPER_PORT` defaults to `8787`.
- `SCRAPER_OUTPUT_DIR` defaults to `.temp/firecrawl-runs`.
- `FIRECRAWL_POLL_INTERVAL_MS` defaults to `2500`.
- `FIRECRAWL_JOB_TIMEOUT_MS` defaults to `900000`.

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

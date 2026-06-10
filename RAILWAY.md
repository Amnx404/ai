# Railway Deployment

This repo is intended to run as two Railway services from the same GitHub repo:

1. `web` uses `/railway.json` and runs the Next.js app.
2. `scraper` uses `/railway.scraper.json` and runs the scraping pipeline service.

## Web service

Use the default Railway config file path:

```text
/railway.json
```

Required variables:

```text
DATABASE_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
WIDGET_JWT_SECRET
OPENROUTER_API_KEY
PINECONE_API_KEY
PINECONE_INDEX
SCRAPER_PIPELINE_BASE_URL
callback_URL
```

Recommended optional variables:

```text
PINECONE_INDEX_HOST
PINECONE_EMBED_MODEL
PINECONE_RERANK_MODEL
SCRAPER_SCRAPE_PROVIDER
RESEND_API_KEY
RESEND_FROM
LANGFUSE_SECRET_KEY
LANGFUSE_PUBLIC_KEY
LANGFUSE_BASE_URL
LANGFUSE_PROJECT_ID
SCRAPER_FINETUNE_MODEL
FINETUNE_PROMPT
```

Set `NEXTAUTH_URL` and `callback_URL` to the public production URL for the web service.

## Scraper service

Create a second Railway service from the same repo and set its config file path to:

```text
/railway.scraper.json
```

Required variables:

```text
DATABASE_URL
PINECONE_API_KEY
PINECONE_INDEX
```

Required provider variables depend on the selected scraper:

```text
SCRAPER_SCRAPE_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

or:

```text
SCRAPER_SCRAPE_PROVIDER=firecrawl
FIRECRAWL_API_KEY
```

Recommended optional variables:

```text
PINECONE_INDEX_HOST
PINECONE_EMBED_MODEL
OPENROUTER_API_KEY
SCRAPER_FINETUNE_MODEL
FINETUNE_PROMPT
SCRAPER_OUTPUT_DIR
FIRECRAWL_JOB_TIMEOUT_MS
CLOUDFLARE_CRAWL_JOB_TIMEOUT_MS
CLOUDFLARE_CRAWL_STALL_TIMEOUT_MS
```

After the scraper service has a Railway URL, set the web service's `SCRAPER_PIPELINE_BASE_URL` to that scraper URL.

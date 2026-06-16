# Railway Deployment

Two Railway services from the same GitHub repo:

1. **`web`** — Next.js app, uses `/railway.json`
2. **`scraper`** — scraping pipeline, uses `/railway.scraper.json`

Both services share the same **Neon** PostgreSQL database (`DATABASE_URL`). The scraper generates embeddings via OpenRouter (`baai/bge-m3`, 1024 dims) and stores them as pgvector in Neon. The web service queries pgvector directly — no Pinecone required for retrieval.

---

## Web service

Config file path: `/railway.json`

**Required variables:**

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (`?sslmode=require&channel_binding=require`) |
| `NEXTAUTH_SECRET` | Random secret — `openssl rand -hex 32` |
| `NEXTAUTH_URL` | Public URL of this service, e.g. `https://app.altegolabs.com` |
| `callback_URL` | Same as `NEXTAUTH_URL` |
| `WIDGET_JWT_SECRET` | Random secret for widget session tokens |
| `OPENROUTER_API_KEY` | LLM (Gemini Flash) + embeddings (bge-m3) |
| `SCRAPER_PIPELINE_BASE_URL` | Internal URL of the scraper service, e.g. `http://scraper.railway.internal:8080` |

**Optional variables:**

| Variable | Notes |
|---|---|
| `PINECONE_API_KEY` | Only needed if cross-encoder reranking via Pinecone is re-enabled |
| `PINECONE_RERANK_MODEL` | Defaults to `bge-reranker-v2-m3` |
| `RESEND_API_KEY` | Magic-link emails in production |
| `RESEND_FROM` | e.g. `Alt Ego <onboarding@altegolabs.com>` |
| `LANGFUSE_SECRET_KEY` | Observability traces |
| `LANGFUSE_PUBLIC_KEY` | |
| `LANGFUSE_BASE_URL` | |
| `LANGFUSE_PROJECT_ID` | |
| `SCRAPER_SCRAPE_PROVIDER` | `cloudflare` or `firecrawl` |
| `SCRAPER_FINETUNE_MODEL` | Model for chunk cleaning step |
| `FINETUNE_PROMPT` | Custom cleaning prompt |

---

## Scraper service

Config file path: `/railway.scraper.json`

**Required variables:**

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Same Neon connection string as the web service |
| `OPENROUTER_API_KEY` | Embeddings via `baai/bge-m3` |

**Provider variables** (pick one):

```
# Cloudflare Browser Rendering scraper
SCRAPER_SCRAPE_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...   (Browser Rendering permission)

# OR Firecrawl scraper
SCRAPER_SCRAPE_PROVIDER=firecrawl
FIRECRAWL_API_KEY=...
```

**Optional variables:**

| Variable | Notes |
|---|---|
| `OPENROUTER_MODEL` | Override for chunk-cleaning LLM |
| `SCRAPER_FINETUNE_MODEL` | |
| `FINETUNE_PROMPT` | |
| `SCRAPER_OUTPUT_DIR` | Defaults to `.temp/scraper-runs` |
| `FIRECRAWL_JOB_TIMEOUT_MS` | |
| `CLOUDFLARE_CRAWL_JOB_TIMEOUT_MS` | |
| `CLOUDFLARE_CRAWL_STALL_TIMEOUT_MS` | |

---

## Deployment steps

1. Create a **Neon** project and copy the pooled connection string.
2. In Railway, create the **web** service from this repo (config: `/railway.json`). Set all required web variables.
3. In Railway, create the **scraper** service from the same repo (config: `/railway.scraper.json`). Set all required scraper variables.
4. Copy the scraper service's internal Railway URL into the web service's `SCRAPER_PIPELINE_BASE_URL`. The scraper service listens on IPv6 (`SCRAPER_HOST=::`) so the web service can reach Railway private networking.
5. On first deploy, `prisma migrate deploy` runs automatically (pre-deploy command in `railway.json`).

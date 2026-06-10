# Local UI + Scraper

Use this when you want the admin UI to start local knowledge-base runs against the local scraper service.

## 1. Environment

Your local `.env` should include:

```text
NEXTAUTH_URL=http://localhost:3001
callback_URL=http://localhost:3001
SCRAPER_PIPELINE_BASE_URL=http://localhost:8787
SCRAPER_SCRAPE_PROVIDER=cloudflare
SCRAPER_PORT=8787
```

Use `.env.local.example` as a safe checklist. Do not commit real API keys.

## 2. Seed a UI-ready demo site

```bash
npm run seed:local-demo
```

If you want the seeded site attached to a specific login email:

```bash
npm run seed:local-demo -- --email=you@example.com
```

The command creates or updates the bundled demo fixture, sets the local user to `MAX` so the UI can use the 1000-page setting, and writes Cloudflare knowledge-group scrape parameters into `Site.scrapeConfig`.

## 3. Run both local services

```bash
npm run dev:local
```

This starts:

- Next UI: the first free port starting at `http://localhost:3001`
- Scraper pipeline: the first free port starting at `http://localhost:8787`

The runner prints the exact URLs it selected. Open the seeded site path on the printed web URL, go to the Knowledge tab, and use `Start knowledge refresh`.

To force a specific UI port:

```bash
WEB_PORT=3002 npm run dev:local
```

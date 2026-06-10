import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, relative, resolve } from "path";

import { runCloudflareScrape } from "./cloudflare-scrape.js";
import { FirecrawlClient, type FirecrawlClientOptions, sleep } from "./firecrawl-client.js";
import type {
  ApiStatus,
  FirecrawlBatchStatusResponse,
  FirecrawlDocument,
  FirecrawlProgressEvent,
  SavedPage,
  ScrapeRequest,
} from "./types.js";
import {
  applyRegexFilters,
  canonicalizeUrl,
  dedupeCandidates,
  isAllowedByPrefix,
  normalizeAllowedPrefixes,
  type UrlCandidate,
} from "./url-scope.js";

export type RunFirecrawlScrapeOptions = {
  runId?: string;
  outputRoot?: string;
  pollIntervalMs?: number;
  firecrawl?: FirecrawlClientOptions;
  onProgress?: (event: FirecrawlProgressEvent) => void | Promise<void>;
};

export async function runScrape(
  request: ScrapeRequest,
  opts: RunFirecrawlScrapeOptions = {},
): Promise<ApiStatus> {
  const provider = scrapeProvider(request);
  if (provider === "cloudflare") {
    return runCloudflareScrape(request, opts);
  }
  return runFirecrawlScrape(request, opts);
}

function scrapeProvider(request: ScrapeRequest) {
  const raw =
    request.scrape_provider ??
    process.env.SCRAPER_SCRAPE_PROVIDER ??
    process.env.SCRAPER_PROVIDER ??
    "cloudflare";
  return String(raw).trim().toLowerCase() === "firecrawl" ? "firecrawl" : "cloudflare";
}

export async function runFirecrawlScrape(
  request: ScrapeRequest,
  opts: RunFirecrawlScrapeOptions = {},
): Promise<ApiStatus> {
  const started = new Date();
  const runId = opts.runId ?? makeRunId();
  const outputRoot = resolve(opts.outputRoot ?? process.env.SCRAPER_OUTPUT_DIR ?? ".temp/scraper-runs");
  const runDir = join(outputRoot, runId);
  const pagesDir = join(runDir, "pages");
  const metadataDir = join(runDir, "metadata");
  const pollIntervalMs = opts.pollIntervalMs ?? Number(process.env.FIRECRAWL_POLL_INTERVAL_MS ?? 2500);
  const jobTimeoutMs = Number(process.env.FIRECRAWL_JOB_TIMEOUT_MS ?? 15 * 60 * 1000);

  const emit = async (event: Omit<FirecrawlProgressEvent, "run_id">) => {
    await opts.onProgress?.({ ...event, run_id: runId });
  };

  await emit({ event: "start", message: "Starting Firecrawl scrape" });

  const seedUrls = normalizeUrlList(request.seed_urls);
  if (seedUrls.length === 0) {
    throw new Error("Scrape request must include at least one valid seed URL");
  }

  const respectAllowedPrefixes = request.respect_allowed_prefixes !== false;
  const allowedPrefixes = respectAllowedPrefixes
    ? normalizeAllowedPrefixes(request.allowed_prefixes ?? [], seedUrls)
    : [];
  const maxPages = clampInteger(request.max_pages, 10, 1, 10_000);
  const mapLimit = Math.min(100_000, Math.max(maxPages * 4, maxPages, 100));
  const client = new FirecrawlClient(opts.firecrawl);

  const candidates: UrlCandidate[] = seedUrls.map((url) => ({ url, source: "seed" }));
  const mapErrors: Record<string, string> = {};

  if (request.skip_map !== true) {
    for (const seedUrl of mapSeedUrls(seedUrls)) {
      await emit({
        event: "map_start",
        message: `Discovering URLs from ${seedUrl}`,
        data: { seed_url: seedUrl },
      });

      try {
        const mapped = await client.map({
          url: seedUrl,
          sitemap: "include",
          includeSubdomains: false,
          ignoreQueryParameters: true,
          limit: mapLimit,
          timeout: 60_000,
        });

        for (const link of mapped.links ?? []) {
          candidates.push({ ...link, source: "map" });
        }

        await emit({
          event: "map_done",
          message: `Discovered ${(mapped.links ?? []).length} candidate URLs`,
          data: { seed_url: seedUrl, links: (mapped.links ?? []).length },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Map failed";
        mapErrors[seedUrl] = message;
        await emit({
          event: "map_failed",
          message,
          data: { seed_url: seedUrl },
        });
      }
    }
  }

  const filteredCandidates = applyRegexFilters(
    dedupeCandidates(candidates).filter((candidate) =>
      respectAllowedPrefixes ? isAllowedByPrefix(candidate.url, allowedPrefixes) : true,
    ),
    {
      whitelist: request.url_whitelist_patterns,
      blacklist: request.url_blacklist_patterns,
    },
  );
  const urlsToScrape = filteredCandidates.slice(0, maxPages).map((candidate) => candidate.url);

  if (urlsToScrape.length === 0) {
    throw new Error("Firecrawl discovery found no URLs inside the allowed prefixes");
  }

  const documentsByUrl = new Map<string, FirecrawlDocument>();
  const scrapedUrls = new Set<string>();
  const batchJobs: Array<{
    id: string;
    url: string | null;
    invalid_urls: string[];
    credits_used: number | null;
    total: number | null;
    completed: number | null;
    expires_at: string | null;
  }> = [];

  const scrapeBatch = async (urls: string[], pass: "initial" | "document_links") => {
    for (const url of urls) scrapedUrls.add(url);

    await emit({
      event: "batch_start",
      message: `Scraping ${urls.length} URLs with Firecrawl`,
      data: { url_count: urls.length, pass },
    });

    const batch = await client.startBatchScrape({
      ...safeFirecrawlOverrides(request.firecrawl_scrape_options),
      ...safeFirecrawlOverrides(request.firecrawl_batch_options),
      urls,
      maxConcurrency: clampInteger(request.parallel_workers, 4, 1, 50),
      ignoreInvalidURLs: true,
      formats: ["markdown"],
      onlyMainContent: true,
      onlyCleanContent: false,
      removeBase64Images: true,
      blockAds: true,
      timeout: firecrawlTimeoutMs(request.selenium_page_load_timeout),
    });

    if (!batch.success || !batch.id) {
      throw new Error(batch.error ?? "Firecrawl did not return a batch scrape id");
    }

    const { finalStatus, documents } = await waitForBatchScrape(client, batch.id, {
      pollIntervalMs,
      timeoutMs: jobTimeoutMs,
      runId,
      emit,
    });

    collectDocuments(documentsByUrl, documents);
    batchJobs.push({
      id: batch.id,
      url: batch.url ?? null,
      invalid_urls: batch.invalidURLs ?? [],
      credits_used: finalStatus.creditsUsed ?? null,
      total: finalStatus.total ?? null,
      completed: finalStatus.completed ?? null,
      expires_at: finalStatus.expiresAt ?? null,
    });
  };

  await scrapeBatch(urlsToScrape, "initial");

  const maxLinkDepth = clampInteger(request.max_depth, 1, 0, 5);
  for (let depth = 0; depth < maxLinkDepth; depth += 1) {
    const remaining = maxPages - scrapedUrls.size;
    if (remaining <= 0) break;

    const documentCandidates = applyRegexFilters(
      dedupeCandidates(discoverDocumentLinkCandidates([...documentsByUrl.values()])).filter(
        (candidate) =>
          !scrapedUrls.has(candidate.url) &&
          looksLikeScrapablePageUrl(candidate.url) &&
          (respectAllowedPrefixes ? isAllowedByPrefix(candidate.url, allowedPrefixes) : true),
      ),
      {
        whitelist: request.url_whitelist_patterns,
        blacklist: request.url_blacklist_patterns,
      },
    );
    const nextUrls = documentCandidates.slice(0, remaining).map((candidate) => candidate.url);
    if (nextUrls.length === 0) break;

    await scrapeBatch(nextUrls, "document_links");
  }

  const documents = [...documentsByUrl.values()];
  const firecrawlCreditsUsed = batchJobs.reduce(
    (sum, job) => sum + (job.credits_used ?? 0),
    0,
  );

  await mkdir(pagesDir, { recursive: true });
  await mkdir(metadataDir, { recursive: true });

  const savedPages = await writePages({
    runDir,
    pagesDir,
    metadataDir,
    documents,
  });

  const manifest = {
    run_id: runId,
    provider: "firecrawl",
    mode: "map_then_batch_scrape",
    skip_map: request.skip_map === true,
    started_at: started.toISOString(),
    finished_at: new Date().toISOString(),
    seed_urls: seedUrls,
    allowed_prefixes: allowedPrefixes,
    requested_max_pages: maxPages,
    discovered_url_count: Math.max(filteredCandidates.length, scrapedUrls.size),
    scraped_url_count: scrapedUrls.size,
    saved_page_count: savedPages.length,
    urls: savedPages.map((page) => page.url),
    skipped_documents: Math.max(0, documents.length - savedPages.length),
    firecrawl: {
      batch_job_id: batchJobs[0]?.id ?? null,
      batch_job_ids: batchJobs.map((job) => job.id),
      batch_status_url: batchJobs[0]?.url ?? null,
      invalid_urls: batchJobs.flatMap((job) => job.invalid_urls),
      credits_used: firecrawlCreditsUsed,
      total: batchJobs.reduce((sum, job) => sum + (job.total ?? 0), 0),
      completed: batchJobs.reduce((sum, job) => sum + (job.completed ?? 0), 0),
      expires_at: batchJobs.at(-1)?.expires_at ?? null,
      batch_jobs: batchJobs,
    },
    map_errors: mapErrors,
    pages: savedPages,
  };
  const manifestPath = join(runDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await emit({
    event: "write_done",
    message: `Wrote ${savedPages.length} pages`,
    data: { pages_dir: pagesDir, page_count: savedPages.length },
  });

  const finished = new Date();
  const status: ApiStatus = {
    ok: true,
    step: "scrape",
    run_id: runId,
    started_at: started.toISOString(),
    finished_at: finished.toISOString(),
    message: `Scraped ${savedPages.length} pages with Firecrawl`,
    outputs: {
      output_dir: runDir,
      pages_dir: pagesDir,
      manifest_path: manifestPath,
      page_count: savedPages.length,
      urls: savedPages.map((page) => page.url),
      provider: "firecrawl",
      firecrawl_batch_job_id: batchJobs[0]?.id ?? null,
      firecrawl_batch_job_ids: batchJobs.map((job) => job.id),
      firecrawl_credits_used: firecrawlCreditsUsed,
    },
    logs: {
      summary: `Discovered ${Math.max(filteredCandidates.length, scrapedUrls.size)} URLs, requested ${scrapedUrls.size}, saved ${savedPages.length}.`,
      map_errors: JSON.stringify(mapErrors),
    },
  };

  await emit({
    event: "done",
    message: status.message ?? "Scrape finished",
    data: status.outputs,
  });

  return status;
}

async function waitForBatchScrape(
  client: FirecrawlClient,
  jobId: string,
  opts: {
    pollIntervalMs: number;
    timeoutMs: number;
    runId: string;
    emit: (event: Omit<FirecrawlProgressEvent, "run_id">) => Promise<void>;
  },
) {
  const documentsByUrl = new Map<string, FirecrawlDocument>();
  let finalStatus: FirecrawlBatchStatusResponse | null = null;
  const startedAt = Date.now();

  while (true) {
    if (Date.now() - startedAt > opts.timeoutMs) {
      throw new Error(`Firecrawl batch scrape timed out after ${opts.timeoutMs}ms`);
    }

    const status = await client.getBatchScrapeStatus(jobId);
    collectDocuments(documentsByUrl, status.data ?? []);

    const normalizedStatus = status.status?.toLowerCase();
    await opts.emit({
      event: "batch_progress",
      message: normalizedStatus,
      data: {
        status: status.status,
        total: status.total ?? null,
        completed: status.completed ?? null,
        credits_used: status.creditsUsed ?? null,
        collected_documents: documentsByUrl.size,
      },
    });

    if (normalizedStatus === "completed") {
      finalStatus = status;
      break;
    }

    if (normalizedStatus === "failed") {
      throw new Error(status.error ?? "Firecrawl batch scrape failed");
    }

    await sleep(opts.pollIntervalMs);
  }

  let nextUrl = finalStatus.next ?? null;
  while (nextUrl) {
    const nextStatus = await client.getBatchScrapeStatus(nextUrl);
    collectDocuments(documentsByUrl, nextStatus.data ?? []);
    nextUrl = nextStatus.next ?? null;
  }

  return {
    finalStatus,
    documents: [...documentsByUrl.values()],
  };
}

function collectDocuments(target: Map<string, FirecrawlDocument>, documents: FirecrawlDocument[]) {
  for (const document of documents) {
    const sourceUrl = document.metadata?.sourceURL ?? document.metadata?.url;
    if (!sourceUrl) continue;
    const canonicalUrl = canonicalizeUrl(sourceUrl);
    if (!canonicalUrl) continue;
    target.set(canonicalUrl, document);
  }
}

function discoverDocumentLinkCandidates(documents: FirecrawlDocument[]) {
  const candidates: UrlCandidate[] = [];

  for (const document of documents) {
    const baseUrl = document.metadata?.sourceURL ?? document.metadata?.url ?? "";

    for (const rawUrl of document.links ?? []) {
      addDocumentCandidate(candidates, rawUrl, baseUrl);
    }

    for (const rawUrl of extractUrlsFromText(document.markdown ?? "")) {
      addDocumentCandidate(candidates, rawUrl, baseUrl);
    }

    for (const rawUrl of extractUrlsFromText(document.html ?? "")) {
      addDocumentCandidate(candidates, rawUrl, baseUrl);
    }

    for (const rawUrl of extractUrlsFromText(document.rawHtml ?? "")) {
      addDocumentCandidate(candidates, rawUrl, baseUrl);
    }
  }

  return candidates;
}

function extractUrlsFromText(text: string) {
  const urls = new Set<string>();
  const markdownLinkRe = /!?\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  const hrefRe = /\bhref\s*=\s*["']([^"']+)["']/gi;
  const absoluteUrlRe = /https?:\/\/[^\s<>"')]+/gi;

  for (const match of text.matchAll(markdownLinkRe)) {
    if (match[1]) urls.add(match[1]);
  }
  for (const match of text.matchAll(hrefRe)) {
    if (match[1]) urls.add(match[1]);
  }
  for (const match of text.matchAll(absoluteUrlRe)) {
    if (match[0]) urls.add(match[0]);
  }

  return [...urls];
}

function addDocumentCandidate(candidates: UrlCandidate[], rawUrl: string, baseUrl: string) {
  const resolvedUrl = resolveLinkUrl(rawUrl, baseUrl);
  if (!resolvedUrl) return;
  candidates.push({ url: resolvedUrl, source: "document" });
}

function resolveLinkUrl(rawUrl: string, baseUrl: string) {
  const cleaned = rawUrl.trim().replace(/^["']|["']$/g, "");
  if (!cleaned || cleaned.startsWith("mailto:") || cleaned.startsWith("tel:")) return null;

  try {
    const url = baseUrl ? new URL(cleaned, baseUrl) : new URL(cleaned);
    return canonicalizeUrl(url.toString());
  } catch {
    return null;
  }
}

function looksLikeScrapablePageUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return !/\.(?:avif|bmp|css|eot|gif|ico|jpe?g|js|json|map|mjs|mov|mp3|mp4|png|svg|ttf|wav|webm|webp|woff2?)$/i.test(
      pathname,
    );
  } catch {
    return false;
  }
}

async function writePages(opts: {
  runDir: string;
  pagesDir: string;
  metadataDir: string;
  documents: FirecrawlDocument[];
}) {
  const savedPages: SavedPage[] = [];

  for (const document of opts.documents) {
    const markdown = document.markdown?.trim();
    const sourceUrl = canonicalizeUrl(document.metadata?.sourceURL ?? document.metadata?.url ?? "");
    if (!markdown || !sourceUrl) continue;

    const index = savedPages.length + 1;
    const basename = `${String(index).padStart(5, "0")}`;
    const markdownPath = join(opts.pagesDir, `${basename}.md`);
    const metadataPath = join(opts.metadataDir, `${basename}.json`);

    await writeFile(markdownPath, `${markdown}\n`, "utf8");
    await writeFile(
      metadataPath,
      `${JSON.stringify(
        {
          url: sourceUrl,
          title: document.metadata?.title ?? null,
          description: document.metadata?.description ?? null,
          status_code: document.metadata?.statusCode ?? null,
          links: document.links ?? [],
          firecrawl_metadata: document.metadata ?? {},
          warning: document.warning ?? null,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    savedPages.push({
      index,
      url: sourceUrl,
      title: document.metadata?.title ?? null,
      description: document.metadata?.description ?? null,
      markdown_path: relative(opts.runDir, markdownPath),
      metadata_path: relative(opts.runDir, metadataPath),
      markdown_chars: markdown.length,
      status_code: document.metadata?.statusCode ?? null,
    });
  }

  return savedPages;
}

function normalizeUrlList(urls: string[] | undefined) {
  if (!Array.isArray(urls)) return [];
  return [...new Set(urls.map((url) => canonicalizeUrl(url)).filter((url): url is string => Boolean(url)))];
}

function mapSeedUrls(seedUrls: string[]) {
  const byOrigin = new Map<string, string>();
  for (const seedUrl of seedUrls) {
    try {
      const url = new URL(seedUrl);
      const origin = `${url.origin}/`;
      if (!byOrigin.has(origin)) byOrigin.set(origin, seedUrl);
    } catch {
      // Seeds were normalized earlier; keep this defensive.
    }
  }
  return byOrigin.size > 0 ? [...byOrigin.values()] : seedUrls;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function firecrawlTimeoutMs(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 60_000;
  return n < 1000 ? Math.trunc(n * 1000) : Math.trunc(n);
}

function safeFirecrawlOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const protectedKeys = new Set([
    "urls",
    "url",
    "maxConcurrency",
    "ignoreInvalidURLs",
    "formats",
    "onlyMainContent",
    "removeBase64Images",
    "blockAds",
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, overrideValue] of Object.entries(value as Record<string, unknown>)) {
    if (!protectedKeys.has(key)) out[key] = overrideValue;
  }
  return out;
}

function makeRunId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `fc-${timestamp}-${randomUUID()}`;
}

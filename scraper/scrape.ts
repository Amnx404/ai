import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, relative, resolve } from "path";

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
  outputRoot?: string;
  pollIntervalMs?: number;
  firecrawl?: FirecrawlClientOptions;
  onProgress?: (event: FirecrawlProgressEvent) => void | Promise<void>;
};

export async function runFirecrawlScrape(
  request: ScrapeRequest,
  opts: RunFirecrawlScrapeOptions = {},
): Promise<ApiStatus> {
  const started = new Date();
  const runId = makeRunId();
  const outputRoot = resolve(opts.outputRoot ?? process.env.SCRAPER_OUTPUT_DIR ?? ".temp/firecrawl-runs");
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

  for (const seedUrl of seedUrls) {
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

  await emit({
    event: "batch_start",
    message: `Scraping ${urlsToScrape.length} URLs with Firecrawl`,
    data: { url_count: urlsToScrape.length },
  });

  const batch = await client.startBatchScrape({
    ...safeFirecrawlOverrides(request.firecrawl_scrape_options),
    ...safeFirecrawlOverrides(request.firecrawl_batch_options),
    urls: urlsToScrape,
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
    started_at: started.toISOString(),
    finished_at: new Date().toISOString(),
    seed_urls: seedUrls,
    allowed_prefixes: allowedPrefixes,
    requested_max_pages: maxPages,
    discovered_url_count: filteredCandidates.length,
    scraped_url_count: urlsToScrape.length,
    saved_page_count: savedPages.length,
    urls: savedPages.map((page) => page.url),
    skipped_documents: Math.max(0, documents.length - savedPages.length),
    firecrawl: {
      batch_job_id: batch.id,
      batch_status_url: batch.url ?? null,
      invalid_urls: batch.invalidURLs ?? [],
      credits_used: finalStatus.creditsUsed ?? null,
      total: finalStatus.total ?? null,
      completed: finalStatus.completed ?? null,
      expires_at: finalStatus.expiresAt ?? null,
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
      firecrawl_batch_job_id: batch.id,
      firecrawl_credits_used: finalStatus.creditsUsed ?? null,
    },
    logs: {
      summary: `Discovered ${filteredCandidates.length} URLs, requested ${urlsToScrape.length}, saved ${savedPages.length}.`,
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
    if (!markdown || !sourceUrl || document.metadata?.error) continue;

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

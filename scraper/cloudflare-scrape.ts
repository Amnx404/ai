import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, relative, resolve } from "path";

import {
  CloudflareApiError,
  CloudflareBrowserRunClient,
  type CloudflareClientOptions,
  sleep,
} from "./cloudflare-client.js";
import type {
  ApiStatus,
  CloudflareCrawlRecord,
  CloudflareCrawlStatusResponse,
  FirecrawlProgressEvent,
  SavedPage,
  ScrapeRequest,
} from "./types.js";
import { discoverStaticPages } from "./static-discovery.js";
import {
  applyRegexFilters,
  canonicalizeUrl,
  dedupeCandidates,
  isAllowedByPrefix,
  normalizeAllowedPrefixes,
  type UrlCandidate,
} from "./url-scope.js";

type RunCloudflareScrapeOptions = {
  runId?: string;
  outputRoot?: string;
  pollIntervalMs?: number;
  cloudflare?: CloudflareClientOptions;
  onProgress?: (event: FirecrawlProgressEvent) => void | Promise<void>;
};

type CloudflareRenderMode = "auto" | "static" | "browser";
type CloudflareDiscoveryMode = "crawl" | "static";

type CloudflareCrawlJobSummary = {
  id: string;
  seed_url: string;
  render: boolean;
  reason: "primary" | "auto_dynamic_fallback";
  status: string | null;
  total: number | null;
  finished: number | null;
  browser_seconds_used: number | null;
  stalled: boolean;
  partial_failure: boolean;
};

type WaitForCrawlResult = {
  status: CloudflareCrawlStatusResponse;
  stalled: boolean;
  partialFailure: boolean;
};

export async function runCloudflareScrape(
  request: ScrapeRequest,
  opts: RunCloudflareScrapeOptions = {},
): Promise<ApiStatus> {
  const started = new Date();
  const runId = opts.runId ?? makeRunId();
  const outputRoot = resolve(opts.outputRoot ?? process.env.SCRAPER_OUTPUT_DIR ?? ".temp/scraper-runs");
  const runDir = join(outputRoot, runId);
  const pagesDir = join(runDir, "pages");
  const metadataDir = join(runDir, "metadata");
  const pollIntervalMs = opts.pollIntervalMs ?? Number(process.env.CLOUDFLARE_CRAWL_POLL_INTERVAL_MS ?? 5000);
  const jobTimeoutMs = Number(process.env.CLOUDFLARE_CRAWL_JOB_TIMEOUT_MS ?? 30 * 60 * 1000);
  const stallTimeoutMs = cloudflareStallTimeoutMs(request);

  const emit = async (event: Omit<FirecrawlProgressEvent, "run_id">) => {
    await opts.onProgress?.({ ...event, run_id: runId });
  };

  await emit({ event: "start", message: "Starting Cloudflare Browser Run crawl" });

  const seedUrls = normalizeUrlList(request.seed_urls);
  if (seedUrls.length === 0) {
    throw new Error("Scrape request must include at least one valid seed URL");
  }

  const respectAllowedPrefixes = request.respect_allowed_prefixes !== false;
  const allowedPrefixes = respectAllowedPrefixes
    ? normalizeAllowedPrefixes(request.allowed_prefixes ?? [], seedUrls)
    : [];
  const maxPages = clampInteger(request.max_pages, 10, 1, 100_000);
  const maxDepth = request.max_depth == null ? 100_000 : clampInteger(request.max_depth, 1, 0, 100_000);
  const renderMode = cloudflareRenderMode(request);
  const discoveryMode = cloudflareDiscoveryMode(request);
  const crawlPassRetries = cloudflareJobRetries(request);
  const perSeedLimit = cloudflarePerSeedLimit(request);
  const seedDelayMs = cloudflareSeedDelayMs(request);
  const client = new CloudflareBrowserRunClient(opts.cloudflare);

  if (discoveryMode === "static") {
    return runStaticDiscoveryMarkdownScrape({
      request,
      runId,
      runDir,
      pagesDir,
      metadataDir,
      started,
      seedUrls,
      allowedPrefixes,
      respectAllowedPrefixes,
      maxPages,
      maxDepth,
      seedDelayMs,
      client,
      emit,
    });
  }

  const recordsByUrl = new Map<string, CloudflareCrawlRecord>();
  const crawlJobs: CloudflareCrawlJobSummary[] = [];
  const delayBetweenSeeds = async () => {
    if (seedDelayMs <= 0) return;
    await emit({
      event: "crawl_delay",
      message: `Waiting ${seedDelayMs}ms before the next Cloudflare seed`,
      data: { delay_ms: seedDelayMs },
    });
    await sleep(seedDelayMs);
  };

  for (const seedUrl of seedUrls) {
    const remaining = maxPages - recordsByUrl.size;
    if (remaining <= 0) break;
    const seedPageLimit = perSeedLimit == null ? remaining : Math.min(remaining, perSeedLimit);

    const runCrawlPass = async (render: boolean, reason: CloudflareCrawlJobSummary["reason"]) => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= crawlPassRetries; attempt += 1) {
        try {
          return await runCrawlPassOnce(render, reason, attempt + 1);
        } catch (error) {
          lastError = error;
          if (attempt >= crawlPassRetries || !isRetryableCrawlPassError(error)) {
            throw error;
          }

          await emit({
            event: "crawl_retry",
            message: `Retrying Cloudflare crawl for ${seedUrl}`,
            data: {
              seed_url: seedUrl,
              render,
              reason,
              attempt: attempt + 2,
              max_attempts: crawlPassRetries + 1,
              error: error instanceof Error ? error.message : String(error),
            },
          });
          await sleep(1000 * (attempt + 1));
        }
      }

      throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Cloudflare crawl pass failed"));
    };

    const runCrawlPassOnce = async (
      render: boolean,
      reason: CloudflareCrawlJobSummary["reason"],
      attempt: number,
    ) => {
      const body = cloudflareCrawlBody({
        request,
        seedUrl,
        allowedPrefixes,
        respectAllowedPrefixes,
        maxPages: seedPageLimit,
        maxDepth,
        render,
      });

      await emit({
        event: "crawl_start",
        message: `Starting Cloudflare ${render ? "rendered" : "static"} crawl for ${seedUrl}`,
        data: { seed_url: seedUrl, limit: seedPageLimit, depth: maxDepth, render, reason, attempt },
      });

      const start = await client.startCrawl(body);
      const jobId = typeof start.result === "string" ? start.result.trim() : "";
      if (!start.success || !jobId) {
        throw new Error(cloudflareResponseError(start) ?? "Cloudflare Browser Run did not return a crawl job id");
      }

      const waitResult = await waitForCrawl(client, jobId, {
        seedUrl,
        pollIntervalMs,
        timeoutMs: jobTimeoutMs,
        stallTimeoutMs,
        emit,
      });

      const records = await collectCompletedRecords(client, jobId, {
        emit,
        seedUrl,
      });

      crawlJobs.push({
        id: jobId,
        seed_url: seedUrl,
        render,
        reason,
        status: waitResult.stalled ? "stalled" : waitResult.status.result?.status ?? null,
        total: numberOrNull(waitResult.status.result?.total),
        finished: numberOrNull(waitResult.status.result?.finished),
        browser_seconds_used: numberOrNull(waitResult.status.result?.browserSecondsUsed),
        stalled: waitResult.stalled,
        partial_failure: waitResult.partialFailure,
      });

      return records;
    };

    let firstPassRecords: CloudflareCrawlRecord[];
    try {
      firstPassRecords = await runCrawlPass(renderMode === "browser", "primary");
    } catch (error) {
      await emit({
        event: "crawl_seed_failed",
        message: `Skipping ${seedUrl}; Cloudflare crawl failed`,
        data: {
          seed_url: seedUrl,
          render: renderMode === "browser",
          reason: "primary",
          error: error instanceof Error ? error.message : String(error),
        },
      });
      await delayBetweenSeeds();
      continue;
    }
    const seedRecordsByUrl = new Map<string, CloudflareCrawlRecord>();
    collectCloudflareRecords(seedRecordsByUrl, firstPassRecords, seedPageLimit);

    if (
      renderMode === "auto" &&
      shouldRetryWithRenderedCrawl(firstPassRecords, {
        respectAllowedPrefixes,
        allowedPrefixes,
        whitelist: request.url_whitelist_patterns,
        blacklist: request.url_blacklist_patterns,
        maxPages: seedPageLimit,
      })
    ) {
      await emit({
        event: "crawl_render_retry",
        message: `Static crawl looked incomplete; retrying ${seedUrl} with browser rendering`,
        data: { seed_url: seedUrl },
      });

      try {
        const renderedRecords = await runCrawlPass(true, "auto_dynamic_fallback");
        collectCloudflareRecords(seedRecordsByUrl, renderedRecords, seedPageLimit);
      } catch (error) {
        await emit({
          event: "crawl_seed_failed",
          message: `Rendered retry failed for ${seedUrl}; keeping static records`,
          data: {
            seed_url: seedUrl,
            render: true,
            reason: "auto_dynamic_fallback",
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    for (const record of seedRecordsByUrl.values()) {
      const sourceUrl = canonicalizeUrl(record.metadata?.url ?? record.url ?? "");
      if (!sourceUrl) continue;
      recordsByUrl.set(sourceUrl, record);
      if (recordsByUrl.size >= maxPages) break;
    }
    await delayBetweenSeeds();
  }

  const filteredRecords = filterRecords([...recordsByUrl.values()], {
    respectAllowedPrefixes,
    allowedPrefixes,
    whitelist: request.url_whitelist_patterns,
    blacklist: request.url_blacklist_patterns,
    maxPages,
  });

  if (filteredRecords.length === 0) {
    throw new Error("Cloudflare Browser Run crawl found no completed Markdown pages inside the allowed prefixes");
  }

  await mkdir(pagesDir, { recursive: true });
  await mkdir(metadataDir, { recursive: true });

  const savedPages = await writePages({
    runDir,
    pagesDir,
    metadataDir,
    records: filteredRecords,
  });

  const browserSecondsUsed = crawlJobs.reduce((sum, job) => sum + (job.browser_seconds_used ?? 0), 0);
  const manifest = {
    run_id: runId,
    provider: "cloudflare",
    mode: "browser_run_crawl",
    started_at: started.toISOString(),
    finished_at: new Date().toISOString(),
    seed_urls: seedUrls,
    allowed_prefixes: allowedPrefixes,
    requested_max_pages: maxPages,
    requested_per_seed_limit: perSeedLimit,
    requested_depth: maxDepth,
    discovered_url_count: recordsByUrl.size,
    saved_page_count: savedPages.length,
    urls: savedPages.map((page) => page.url),
    cloudflare: {
      crawl_job_ids: crawlJobs.map((job) => job.id),
      browser_seconds_used: browserSecondsUsed,
      crawl_jobs: crawlJobs,
      stalled_crawl_job_ids: crawlJobs.filter((job) => job.stalled).map((job) => job.id),
      render_mode: renderMode,
      auto_render_retried: crawlJobs.some((job) => job.reason === "auto_dynamic_fallback"),
      crawl_purposes: cloudflareCrawlPurposes(request),
    },
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
    message: `Scraped ${savedPages.length} pages with Cloudflare Browser Run`,
    outputs: {
      output_dir: runDir,
      pages_dir: pagesDir,
      manifest_path: manifestPath,
      page_count: savedPages.length,
      urls: savedPages.map((page) => page.url),
      provider: "cloudflare",
      cloudflare_crawl_job_ids: crawlJobs.map((job) => job.id),
      cloudflare_browser_seconds_used: browserSecondsUsed,
      cloudflare_render_mode: renderMode,
      cloudflare_per_seed_limit: perSeedLimit,
      cloudflare_stalled_crawl_job_ids: crawlJobs.filter((job) => job.stalled).map((job) => job.id),
      cloudflare_auto_render_retried: crawlJobs.some((job) => job.reason === "auto_dynamic_fallback"),
    },
    logs: {
      summary: `Cloudflare crawled ${recordsByUrl.size} records, saved ${savedPages.length} pages.`,
    },
  };

  await emit({
    event: "done",
    message: status.message ?? "Scrape finished",
    data: status.outputs,
  });

  return status;
}

async function runStaticDiscoveryMarkdownScrape(opts: {
  request: ScrapeRequest;
  runId: string;
  runDir: string;
  pagesDir: string;
  metadataDir: string;
  started: Date;
  seedUrls: string[];
  allowedPrefixes: string[];
  respectAllowedPrefixes: boolean;
  maxPages: number;
  maxDepth: number;
  seedDelayMs: number;
  client: CloudflareBrowserRunClient;
  emit: (event: Omit<FirecrawlProgressEvent, "run_id">) => Promise<void>;
}): Promise<ApiStatus> {
  await opts.emit({
    event: "discover_start",
    message: "Starting local static discovery for Cloudflare markdown fetch",
    data: {
      seed_count: opts.seedUrls.length,
      max_pages: opts.maxPages,
      max_depth: opts.maxDepth,
    },
  });

  const discovery = await discoverStaticPages({
    seedUrls: opts.seedUrls,
    allowedPrefixes: opts.allowedPrefixes,
    respectAllowedPrefixes: opts.respectAllowedPrefixes,
    maxPages: opts.maxPages,
    maxDepth: opts.maxDepth,
    whitelist: opts.request.url_whitelist_patterns,
    blacklist: opts.request.url_blacklist_patterns,
    userAgent: opts.request.user_agent,
    timeoutMs: cloudflareDiscoveryTimeoutMs(opts.request),
    delayMs: cloudflareDiscoveryDelayMs(opts.request),
    onProgress: opts.emit,
  });

  const records: CloudflareCrawlRecord[] = [];
  const markdownFailures: Array<{ url: string; error: string }> = [];
  const markdownOptions = cloudflareMarkdownOptions(opts.request);

  for (const page of discovery.pages) {
    if (records.length >= opts.maxPages) break;
    if (!page.html?.trim()) continue;

    await opts.emit({
      event: "markdown_start",
      message: `Converting ${page.url} to markdown with Cloudflare`,
      data: {
        url: page.url,
        depth: page.depth,
        markdown_requests: records.length + markdownFailures.length + 1,
      },
    });

    try {
      const markdown = await extractMarkdownWithRetry({
        client: opts.client,
        body: {
          ...markdownOptions,
          ...(page.markdownSource === "url" ? { url: page.url } : { html: page.html }),
        },
        request: opts.request,
        url: page.url,
        depth: page.depth,
        emit: opts.emit,
      });

      records.push({
        url: page.url,
        markdown,
        metadata: {
          url: page.url,
          title: page.title ?? undefined,
          status: page.statusCode ?? undefined,
          depth: page.depth,
          content_type: page.contentType ?? undefined,
          links: page.links,
          source: "static-discovery",
        },
      });

      await opts.emit({
        event: "markdown_done",
        message: `Converted ${records.length} pages with Cloudflare markdown`,
        data: {
          url: page.url,
          depth: page.depth,
          markdown_chars: markdown.length,
          converted_pages: records.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      markdownFailures.push({ url: page.url, error: message });
      await opts.emit({
        event: "markdown_failed",
        message: `Cloudflare markdown conversion failed for ${page.url}`,
        data: {
          url: page.url,
          depth: page.depth,
          error: message,
        },
      });
    }

    if (opts.seedDelayMs > 0 && records.length < opts.maxPages) {
      await opts.emit({
        event: "crawl_delay",
        message: `Waiting ${opts.seedDelayMs}ms before the next Cloudflare markdown request`,
        data: { delay_ms: opts.seedDelayMs },
      });
      await sleep(opts.seedDelayMs);
    }
  }

  const filteredRecords = filterRecords(records, {
    respectAllowedPrefixes: opts.respectAllowedPrefixes,
    allowedPrefixes: opts.allowedPrefixes,
    whitelist: opts.request.url_whitelist_patterns,
    blacklist: opts.request.url_blacklist_patterns,
    maxPages: opts.maxPages,
  });

  if (filteredRecords.length === 0) {
    throw new Error("Static discovery found no Markdown pages inside the allowed prefixes");
  }

  await mkdir(opts.pagesDir, { recursive: true });
  await mkdir(opts.metadataDir, { recursive: true });

  const savedPages = await writePages({
    runDir: opts.runDir,
    pagesDir: opts.pagesDir,
    metadataDir: opts.metadataDir,
    records: filteredRecords,
  });

  const manifest = {
    run_id: opts.runId,
    provider: "cloudflare",
    mode: "static_discovery_markdown",
    started_at: opts.started.toISOString(),
    finished_at: new Date().toISOString(),
    seed_urls: opts.seedUrls,
    allowed_prefixes: opts.allowedPrefixes,
    requested_max_pages: opts.maxPages,
    requested_depth: opts.maxDepth,
    discovered_url_count: discovery.discoveredUrlCount,
    fetched_page_count: discovery.pages.length,
    failed_discovery_url_count: discovery.failedUrlCount,
    queued_url_count: discovery.queuedUrlCount,
    markdown_failure_count: markdownFailures.length,
    saved_page_count: savedPages.length,
    urls: savedPages.map((page) => page.url),
    cloudflare: {
      discovery_mode: "static",
      markdown_requests: records.length + markdownFailures.length,
      markdown_failures: markdownFailures.slice(0, 100),
    },
    pages: savedPages,
  };
  const manifestPath = join(opts.runDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  await opts.emit({
    event: "write_done",
    message: `Wrote ${savedPages.length} pages`,
    data: { pages_dir: opts.pagesDir, page_count: savedPages.length },
  });

  const finished = new Date();
  const status: ApiStatus = {
    ok: true,
    step: "scrape",
    run_id: opts.runId,
    started_at: opts.started.toISOString(),
    finished_at: finished.toISOString(),
    message: `Scraped ${savedPages.length} pages with static discovery and Cloudflare markdown`,
    outputs: {
      output_dir: opts.runDir,
      pages_dir: opts.pagesDir,
      manifest_path: manifestPath,
      page_count: savedPages.length,
      urls: savedPages.map((page) => page.url),
      provider: "cloudflare",
      cloudflare_discovery_mode: "static",
      cloudflare_markdown_requests: records.length + markdownFailures.length,
      cloudflare_markdown_failure_count: markdownFailures.length,
    },
    logs: {
      summary: `Static discovery found ${discovery.discoveredUrlCount} URLs, fetched ${discovery.pages.length} pages, saved ${savedPages.length} pages.`,
    },
  };

  await opts.emit({
    event: "done",
    message: status.message ?? "Scrape finished",
    data: status.outputs,
  });

  return status;
}

async function extractMarkdownWithRetry(opts: {
  client: CloudflareBrowserRunClient;
  body: Record<string, unknown>;
  request: ScrapeRequest;
  url: string;
  depth: number;
  emit: (event: Omit<FirecrawlProgressEvent, "run_id">) => Promise<void>;
}) {
  const retryLimit = cloudflareMarkdownRetries(opts.request);
  const retryDelayMs = cloudflareMarkdownRetryDelayMs(opts.request);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retryLimit; attempt += 1) {
    try {
      const markdownResponse = await opts.client.extractMarkdown(opts.body);
      const markdown = typeof markdownResponse.result === "string" ? markdownResponse.result.trim() : "";
      if (!markdownResponse.success || !markdown) {
        throw new Error(cloudflareResponseError(markdownResponse) ?? "Cloudflare markdown endpoint returned no markdown");
      }
      return markdown;
    } catch (error) {
      lastError = error;
      if (attempt >= retryLimit || !isRetryableMarkdownError(error)) break;

      const backoffMs = retryDelayMs * (attempt + 1);
      await opts.emit({
        event: "crawl_retry",
        message: `Retrying Cloudflare markdown for ${opts.url}`,
        data: {
          url: opts.url,
          depth: opts.depth,
          attempt: attempt + 2,
          max_attempts: retryLimit + 1,
          retry_delay_ms: backoffMs,
          error: error instanceof Error ? error.message : String(error),
        },
      });
      await sleep(backoffMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "Cloudflare markdown failed"));
}

async function waitForCrawl(
  client: CloudflareBrowserRunClient,
  jobId: string,
  opts: {
    seedUrl: string;
    pollIntervalMs: number;
    timeoutMs: number;
    stallTimeoutMs: number | null;
    emit: (event: Omit<FirecrawlProgressEvent, "run_id">) => Promise<void>;
  },
): Promise<WaitForCrawlResult> {
  const startedAt = Date.now();
  let lastProgressKey = "";
  let lastProgressAt = startedAt;

  while (true) {
    if (Date.now() - startedAt > opts.timeoutMs) {
      throw new Error(`Cloudflare Browser Run crawl timed out after ${opts.timeoutMs}ms`);
    }

    const status = await client.getCrawl(jobId, { limit: 1 });
    const normalizedStatus = status.result?.status?.toLowerCase() ?? "";
    const total = numberOrNull(status.result?.total);
    const finished = numberOrNull(status.result?.finished);
    const browserSecondsUsed = numberOrNull(status.result?.browserSecondsUsed);
    const progressKey = [normalizedStatus, total ?? "", finished ?? "", browserSecondsUsed ?? ""].join(":");
    if (progressKey !== lastProgressKey) {
      lastProgressKey = progressKey;
      lastProgressAt = Date.now();
    }

    await opts.emit({
      event: "crawl_progress",
      message: normalizedStatus || "unknown",
      data: {
        seed_url: opts.seedUrl,
        job_id: jobId,
        status: status.result?.status ?? null,
        total,
        finished,
        browser_seconds_used: browserSecondsUsed,
      },
    });

    if (normalizedStatus === "completed") return { status, stalled: false, partialFailure: false };
    if (normalizedStatus && normalizedStatus !== "running") {
      if ((finished ?? 0) > 0) {
        await opts.emit({
          event: "crawl_partial",
          message: `Cloudflare crawl ended as ${normalizedStatus}; collecting completed records`,
          data: {
            seed_url: opts.seedUrl,
            job_id: jobId,
            status: status.result?.status ?? null,
            total,
            finished,
            browser_seconds_used: browserSecondsUsed,
          },
        });
        return { status, stalled: false, partialFailure: true };
      }
      throw new Error(formatCrawlFailure(jobId, opts.seedUrl, status));
    }

    if (
      opts.stallTimeoutMs != null &&
      opts.stallTimeoutMs > 0 &&
      Date.now() - lastProgressAt >= opts.stallTimeoutMs
    ) {
      await opts.emit({
        event: "crawl_stalled",
        message: `Cloudflare crawl stopped making progress for ${opts.seedUrl}; collecting completed records`,
        data: {
          seed_url: opts.seedUrl,
          job_id: jobId,
          status: status.result?.status ?? null,
          total,
          finished,
          browser_seconds_used: browserSecondsUsed,
          stalled_for_ms: Date.now() - lastProgressAt,
        },
      });
      return { status, stalled: true, partialFailure: false };
    }

    await sleep(opts.pollIntervalMs);
  }
}

function formatCrawlFailure(jobId: string, seedUrl: string, status: CloudflareCrawlStatusResponse) {
  const result = status.result ?? {};
  const details = {
    job_id: jobId,
    seed_url: seedUrl,
    status: result.status ?? null,
    total: result.total ?? null,
    finished: result.finished ?? null,
    browser_seconds_used: result.browserSecondsUsed ?? null,
    errors: status.errors ?? [],
    messages: status.messages ?? [],
  };

  return `Cloudflare Browser Run crawl ended with status: ${result.status ?? "unknown"} ${JSON.stringify(details)}`;
}

function isRetryableCrawlPassError(error: unknown) {
  if (error instanceof CloudflareApiError) return error.retryable;
  if (!(error instanceof Error)) return true;
  return (
    error.message.includes("Cloudflare Browser Run crawl ended with status: errored") ||
    error.message.includes("Cloudflare Browser Run request failed") ||
    error.message.includes("timed out")
  );
}

async function collectCompletedRecords(
  client: CloudflareBrowserRunClient,
  jobId: string,
  opts: {
    seedUrl: string;
    emit: (event: Omit<FirecrawlProgressEvent, "run_id">) => Promise<void>;
  },
) {
  const records: CloudflareCrawlRecord[] = [];
  let cursor: string | number | null | undefined = null;
  const pageLimit = 100;

  do {
    const status: CloudflareCrawlStatusResponse = await client.getCrawl(jobId, {
      status: "completed",
      limit: pageLimit,
      cursor,
    });
    const pageRecords = status.result?.records ?? [];
    records.push(...pageRecords);
    cursor = status.result?.cursor ?? null;

    await opts.emit({
      event: "crawl_results",
      message: `Collected ${records.length} completed Cloudflare crawl records`,
      data: {
        seed_url: opts.seedUrl,
        job_id: jobId,
        collected_records: records.length,
        cursor: cursor ?? null,
      },
    });
  } while (cursor != null && cursor !== "");

  return records;
}

function collectCloudflareRecords(
  target: Map<string, CloudflareCrawlRecord>,
  records: CloudflareCrawlRecord[],
  maxPages: number,
) {
  for (const record of records) {
    const sourceUrl = canonicalizeUrl(record.metadata?.url ?? record.url ?? "");
    if (!sourceUrl) continue;
    target.set(sourceUrl, record);
    if (target.size >= maxPages) break;
  }
}

function shouldRetryWithRenderedCrawl(
  records: CloudflareCrawlRecord[],
  opts: {
    respectAllowedPrefixes: boolean;
    allowedPrefixes: string[];
    whitelist?: string[];
    blacklist?: string[];
    maxPages: number;
  },
) {
  const filtered = filterRecords(records, opts);
  if (filtered.length === 0) return true;

  const shellCount = filtered.filter(looksLikeDynamicShellRecord).length;
  if (shellCount === 0) return false;

  const shellRatio = shellCount / filtered.length;
  if (shellRatio >= 0.5) return true;

  const averageMarkdownChars =
    filtered.reduce((sum, record) => sum + (record.markdown?.trim().length ?? 0), 0) / filtered.length;
  return filtered.length <= Math.min(2, opts.maxPages) && averageMarkdownChars < 1200;
}

function looksLikeDynamicShellRecord(record: CloudflareCrawlRecord) {
  const markdown = record.markdown?.trim() ?? "";
  const title = record.metadata?.title?.trim() ?? "";
  const combined = `${title}\n${markdown}`.toLowerCase();
  const wordCount = (markdown.match(/\b[\w-]{3,}\b/g) ?? []).length;

  if (markdown.length < 80 && wordCount < 12) return true;

  const dynamicSignals = [
    "enable javascript",
    "requires javascript",
    "javascript is disabled",
    "turn on javascript",
    "loading...",
    "loading…",
    "please wait",
    "root div",
    "__next",
    "__nuxt",
    "vite",
    "webpack",
    "single page app",
    "client-side",
  ];

  if (dynamicSignals.some((signal) => combined.includes(signal))) return true;
  return false;
}

function cloudflareCrawlBody({
  request,
  seedUrl,
  allowedPrefixes,
  respectAllowedPrefixes,
  maxPages,
  maxDepth,
  render,
}: {
  request: ScrapeRequest;
  seedUrl: string;
  allowedPrefixes: string[];
  respectAllowedPrefixes: boolean;
  maxPages: number;
  maxDepth: number;
  render: boolean;
}) {
  const overrides = objectRecord(request.cloudflare_crawl_options);
  const overrideOptions = objectRecord(overrides.options);
  const protectedTopLevel = new Set(["url", "limit", "depth", "formats", "options"]);
  const safeOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([key]) => !protectedTopLevel.has(key)),
  );

  const includePatterns =
    stringArray(overrideOptions.includePatterns).length > 0
      ? stringArray(overrideOptions.includePatterns)
      : respectAllowedPrefixes
        ? allowedPrefixesToWildcardPatterns(allowedPrefixes)
        : [];
  const excludePatterns = Array.from(
    new Set([...defaultExcludePatterns(allowedPrefixes), ...stringArray(overrideOptions.excludePatterns)]),
  );

  return {
    ...safeOverrides,
    url: seedUrl,
    limit: maxPages,
    depth: maxDepth,
    formats: ["markdown"],
    render,
    maxAge: numberOverride(overrides.maxAge) ?? numberEnv("CLOUDFLARE_CRAWL_MAX_AGE") ?? 86_400,
    source: typeof overrides.source === "string" ? overrides.source : "all",
    crawlPurposes: cloudflareCrawlPurposes(request),
    options: {
      ...overrideOptions,
      includeExternalLinks:
        typeof overrideOptions.includeExternalLinks === "boolean"
          ? overrideOptions.includeExternalLinks
          : hasExternalAllowedOrigin(seedUrl, allowedPrefixes),
      includeSubdomains:
        typeof overrideOptions.includeSubdomains === "boolean"
          ? overrideOptions.includeSubdomains
          : hasRelatedAllowedSubdomain(seedUrl, allowedPrefixes),
      ...(includePatterns.length ? { includePatterns } : {}),
      ...(excludePatterns.length ? { excludePatterns } : {}),
    },
    ...(render
      ? {
          rejectResourceTypes: stringArray(overrides.rejectResourceTypes).length
            ? stringArray(overrides.rejectResourceTypes)
            : ["image", "media", "font", "stylesheet"],
        }
      : {}),
  };
}

function filterRecords(
  records: CloudflareCrawlRecord[],
  opts: {
    respectAllowedPrefixes: boolean;
    allowedPrefixes: string[];
    whitelist?: string[];
    blacklist?: string[];
    maxPages: number;
  },
) {
  const candidates: UrlCandidate[] = records
    .map((record) => {
      const url = canonicalizeUrl(record.metadata?.url ?? record.url ?? "");
      return url ? { url, source: "cloudflare" } : null;
    })
    .filter((candidate): candidate is UrlCandidate => Boolean(candidate))
    .filter((candidate) =>
      opts.respectAllowedPrefixes ? isAllowedByPrefix(candidate.url, opts.allowedPrefixes) : true,
    );
  const allowedUrls = new Set(
    applyRegexFilters(dedupeCandidates(candidates), {
      whitelist: opts.whitelist,
      blacklist: opts.blacklist,
    })
      .slice(0, opts.maxPages)
      .map((candidate) => candidate.url),
  );

  return records.filter((record) => {
    const url = canonicalizeUrl(record.metadata?.url ?? record.url ?? "");
    return Boolean(url && allowedUrls.has(url) && record.markdown?.trim());
  });
}

async function writePages(opts: {
  runDir: string;
  pagesDir: string;
  metadataDir: string;
  records: CloudflareCrawlRecord[];
}) {
  const savedPages: SavedPage[] = [];

  for (const record of opts.records) {
    const markdown = record.markdown?.trim();
    const sourceUrl = canonicalizeUrl(record.metadata?.url ?? record.url ?? "");
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
          title: record.metadata?.title ?? null,
          description: record.metadata?.description ?? null,
          status_code: record.metadata?.status ?? null,
          links: Array.isArray(record.metadata?.links)
            ? record.metadata.links.filter((link): link is string => typeof link === "string")
            : [],
          cloudflare_metadata: record.metadata ?? {},
          warning: null,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    savedPages.push({
      index,
      url: sourceUrl,
      title: record.metadata?.title ?? null,
      description: record.metadata?.description ?? null,
      markdown_path: relative(opts.runDir, markdownPath),
      metadata_path: relative(opts.runDir, metadataPath),
      markdown_chars: markdown.length,
      status_code: record.metadata?.status ?? null,
    });
  }

  return savedPages;
}

function cloudflareRenderMode(request: ScrapeRequest): CloudflareRenderMode {
  if (typeof request.cloudflare_render === "boolean") {
    return request.cloudflare_render ? "browser" : "static";
  }

  const explicit = normalizeCloudflareRenderMode(request.cloudflare_render_mode);
  if (explicit) return explicit;

  const envMode = normalizeCloudflareRenderMode(process.env.CLOUDFLARE_CRAWL_RENDER_MODE);
  if (envMode) return envMode;

  const legacyEnv = process.env.CLOUDFLARE_CRAWL_RENDER?.trim().toLowerCase();
  if (legacyEnv === "true") return "browser";
  if (legacyEnv === "false") return "static";
  if (legacyEnv === "auto") return "auto";

  return "auto";
}

function cloudflareDiscoveryMode(request: ScrapeRequest): CloudflareDiscoveryMode {
  const explicit = normalizeCloudflareDiscoveryMode(request.cloudflare_discovery_mode);
  if (explicit) return explicit;

  const envMode = normalizeCloudflareDiscoveryMode(process.env.CLOUDFLARE_DISCOVERY_MODE);
  if (envMode) return envMode;

  return "crawl";
}

function normalizeCloudflareDiscoveryMode(value: unknown): CloudflareDiscoveryMode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "crawl" || normalized === "browser-run") return "crawl";
  if (normalized === "static" || normalized === "local" || normalized === "bfs") return "static";
  return null;
}

function normalizeCloudflareRenderMode(value: unknown): CloudflareRenderMode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") return "auto";
  if (normalized === "static" || normalized === "false") return "static";
  if (normalized === "browser" || normalized === "render" || normalized === "rendered" || normalized === "true") {
    return "browser";
  }
  return null;
}

function cloudflareJobRetries(request: ScrapeRequest) {
  return clampInteger(
    request.cloudflare_job_retries ?? process.env.CLOUDFLARE_CRAWL_JOB_RETRIES,
    2,
    0,
    5,
  );
}

function cloudflarePerSeedLimit(request: ScrapeRequest) {
  const raw = request.cloudflare_per_seed_limit ?? process.env.CLOUDFLARE_CRAWL_PER_SEED_LIMIT;
  if (raw == null || raw === "") return null;
  return clampInteger(raw, 1, 1, 100_000);
}

function cloudflareStallTimeoutMs(request: ScrapeRequest) {
  const raw = request.cloudflare_stall_timeout_ms ?? process.env.CLOUDFLARE_CRAWL_STALL_TIMEOUT_MS;
  if (raw == null || raw === "") return 2 * 60 * 1000;
  const timeout = clampInteger(raw, 0, 0, 30 * 60 * 1000);
  return timeout > 0 ? timeout : null;
}

function cloudflareSeedDelayMs(request: ScrapeRequest) {
  const raw = request.delay ?? process.env.CLOUDFLARE_CRAWL_SEED_DELAY_SECONDS ?? 0;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds * 1000) : 0;
}

function cloudflareDiscoveryDelayMs(request: ScrapeRequest) {
  const raw = request.cloudflare_discovery_delay_seconds ?? process.env.CLOUDFLARE_DISCOVERY_DELAY_SECONDS ?? 0;
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds * 1000) : 0;
}

function cloudflareDiscoveryTimeoutMs(request: ScrapeRequest) {
  return clampInteger(
    request.cloudflare_discovery_timeout_ms ?? process.env.CLOUDFLARE_DISCOVERY_TIMEOUT_MS,
    15_000,
    1_000,
    120_000,
  );
}

function cloudflareMarkdownRetries(request: ScrapeRequest) {
  return clampInteger(
    request.cloudflare_markdown_retries ?? process.env.CLOUDFLARE_MARKDOWN_RETRIES,
    3,
    0,
    10,
  );
}

function cloudflareMarkdownRetryDelayMs(request: ScrapeRequest) {
  return clampInteger(
    request.cloudflare_markdown_retry_delay_ms ?? process.env.CLOUDFLARE_MARKDOWN_RETRY_DELAY_MS,
    10_000,
    1000,
    120_000,
  );
}

function isRetryableMarkdownError(error: unknown) {
  if (error instanceof CloudflareApiError) return error.retryable || error.status === 429;
  if (!(error instanceof Error)) return true;
  const message = error.message.toLowerCase();
  return message.includes("rate limit") || message.includes("timed out") || message.includes("request failed");
}

function cloudflareMarkdownOptions(request: ScrapeRequest) {
  const overrides = objectRecord(request.cloudflare_markdown_options);
  const protectedKeys = new Set(["url", "html"]);
  return Object.fromEntries(Object.entries(overrides).filter(([key]) => !protectedKeys.has(key)));
}

function cloudflareCrawlPurposes(request: ScrapeRequest) {
  if (Array.isArray(request.cloudflare_crawl_purposes) && request.cloudflare_crawl_purposes.length > 0) {
    return request.cloudflare_crawl_purposes;
  }
  const raw = process.env.CLOUDFLARE_CRAWL_PURPOSES?.trim();
  if (raw) {
    const values = raw
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is "search" | "ai-input" | "ai-train" =>
        value === "search" || value === "ai-input" || value === "ai-train",
      );
    if (values.length) return values;
  }
  return ["search", "ai-input"];
}

function allowedPrefixesToWildcardPatterns(prefixes: string[]) {
  return Array.from(
    new Set(
      prefixes
        .map((prefix) => canonicalizeUrl(prefix))
        .filter((prefix): prefix is string => Boolean(prefix))
        .map((prefix) => `${prefix.replace(/\/+$/, "")}**`),
    ),
  );
}

function defaultExcludePatterns(allowedPrefixes: string[]) {
  const patterns = [
    "**/*.avif",
    "**/*.bmp",
    "**/*.css",
    "**/*.eot",
    "**/*.gif",
    "**/*.ico",
    "**/*.jpeg",
    "**/*.jpg",
    "**/*.js",
    "**/*.map",
    "**/*.mjs",
    "**/*.mov",
    "**/*.mp3",
    "**/*.mp4",
    "**/*.png",
    "**/*.svg",
    "**/*.ttf",
    "**/*.wav",
    "**/*.webm",
    "**/*.webp",
    "**/*.woff",
    "**/*.woff2",
  ];

  if (allowedPrefixes.some((prefix) => prefix.includes("github.com/"))) {
    patterns.push(
      "**/issues**",
      "**/pulls**",
      "**/actions**",
      "**/projects**",
      "**/security**",
      "**/pulse**",
      "**/graphs**",
      "**/network**",
      "**/stargazers**",
      "**/watchers**",
      "**/forks**",
      "**/releases**",
      "**/tags**",
      "**/branches**",
      "**/commits**",
      "**/commit**",
      "**/compare**",
      "**/search**",
      "**/activity**",
    );
  }

  return patterns;
}

function hasExternalAllowedOrigin(seedUrl: string, allowedPrefixes: string[]) {
  try {
    const seedOrigin = new URL(seedUrl).origin;
    return allowedPrefixes.some((prefix) => {
      try {
        return new URL(prefix).origin !== seedOrigin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function hasRelatedAllowedSubdomain(seedUrl: string, allowedPrefixes: string[]) {
  try {
    const seedHost = new URL(seedUrl).hostname;
    return allowedPrefixes.some((prefix) => {
      try {
        const host = new URL(prefix).hostname;
        return host !== seedHost && (host.endsWith(`.${seedHost}`) || seedHost.endsWith(`.${host}`));
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function normalizeUrlList(urls: string[] | undefined) {
  if (!Array.isArray(urls)) return [];
  return [...new Set(urls.map((url) => canonicalizeUrl(url)).filter((url): url is string => Boolean(url)))];
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberOverride(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function numberEnv(key: string) {
  return numberOverride(process.env[key]);
}

function numberOrNull(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function cloudflareResponseError(value: { errors?: Array<{ message?: string }> }) {
  const message = value.errors
    ?.map((error) => error.message?.trim())
    .filter(Boolean)
    .join("; ");
  return message || null;
}

function makeRunId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `cf-${timestamp}-${randomUUID()}`;
}

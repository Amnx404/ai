import { env } from "~/env.js";

export type ScrapeRequest = {
  seed_urls: string[];
  allowed_prefixes: string[];
  respect_allowed_prefixes?: boolean;
  max_pages?: number;
  delay?: number;
  user_agent?: string;
  page_fetcher?: "selenium" | "requests" | null;
  use_selenium?: boolean;
  selenium_page_load_timeout?: number;
  selenium_render_wait?: number;
  parallel_workers?: number;
  retry_limit?: number;
  max_depth?: number | null;
  url_whitelist_patterns?: string[];
  url_blacklist_patterns?: string[];
};

export type PrepareRequest = {
  run_id: string;
  input_pages_dir?: string | null;
  output_subdir?: string;
  min_chars?: number;
  keep_binary?: boolean;
  finetune?: boolean;
  finetune_concurrency?: number;
  finetune_max_input_chars?: number;
  openrouter_api_key?: string | null;
  finetune_model?: string | null;
  openrouter_model?: string | null;
  finetune_prompt?: string | null;
};

export type UploadRequest = {
  run_id: string;
  ingestion_dir?: string | null;
  live_prefix: string;
  staging_namespace?: string | null;
  vector_dim?: number;
  text_source?: "markdown" | "fine";
  embed_model?: string;
  batch_size?: number;
  embed_batch_size?: number;
  embed_workers?: number;
  pool_threads?: number;
  max_records?: number | null;
  delete_previous_live?: boolean;
  include_sidecar_metadata?: boolean;
};

export type ApiStatus = {
  ok: boolean;
  step: "scrape" | "prepare" | "upload" | "status";
  run_id: string;
  // New fields returned by /upload (top-level)
  live_namespace?: string | null;
  previous_live_namespace?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  message?: string | null;
  outputs?: Record<string, unknown>;
  logs?: Record<string, string>;
};

function baseUrl() {
  const raw = env.SCRAPER_PIPELINE_BASE_URL?.trim();
  if (!raw) {
    throw new Error("SCRAPER_PIPELINE_BASE_URL is not set");
  }
  return raw.replace(/\/+$/, "");
}

async function postJson<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Scraper pipeline error ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as TRes;
}

async function getJson<TRes>(path: string): Promise<TRes> {
  const res = await fetch(`${baseUrl()}${path}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Scraper pipeline error ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as TRes;
}

export async function scraperScrape(req: ScrapeRequest): Promise<ApiStatus> {
  return postJson<ScrapeRequest, ApiStatus>("/scrape", req);
}

export async function scraperPrepare(req: PrepareRequest): Promise<ApiStatus> {
  return postJson<PrepareRequest, ApiStatus>("/prepare", req);
}

export async function scraperUpload(req: UploadRequest): Promise<ApiStatus> {
  return postJson<UploadRequest, ApiStatus>("/upload", req);
}

export async function scraperRunStatus(runId: string): Promise<ApiStatus> {
  return getJson<ApiStatus>(`/runs/${encodeURIComponent(runId)}`);
}

export async function waitForRunFinished(runId: string, opts?: { timeoutMs?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 10 * 60 * 1000;
  const start = Date.now();
  while (true) {
    const status = await scraperRunStatus(runId);
    if (status.finished_at) return status;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Scraper pipeline run timed out after ${timeoutMs}ms (run_id=${runId})`);
    }
    // Poll with a short delay.
    await new Promise((r) => setTimeout(r, 1200));
  }
}


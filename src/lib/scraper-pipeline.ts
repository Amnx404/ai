import { env } from "~/env.js";

export type ScrapeRequest = {
  scrape_provider?: "firecrawl" | "cloudflare" | null;
  seed_urls: string[];
  allowed_prefixes: string[];
  respect_allowed_prefixes?: boolean;
  max_pages?: number;
  delay?: number;
  scrape_markdown_split_max_chars?: number | null;
  user_agent?: string;
  page_fetcher?: "selenium" | "requests" | null;
  use_selenium?: boolean;
  selenium_page_load_timeout?: number;
  selenium_render_wait?: number;
  parallel_workers?: number;
  retry_limit?: number;
  max_depth?: number | null;
  skip_map?: boolean;
  url_whitelist_patterns?: string[];
  url_blacklist_patterns?: string[];
  source_groups?: Array<Record<string, unknown>>;
  source_group_ids?: string[];
  source_group_mode?: "all" | "core" | "live";
  firecrawl_scrape_options?: Record<string, unknown>;
  firecrawl_batch_options?: Record<string, unknown>;
  cloudflare_crawl_options?: Record<string, unknown>;
  cloudflare_markdown_options?: Record<string, unknown>;
  cloudflare_render?: boolean;
  cloudflare_render_mode?: "auto" | "static" | "browser";
  cloudflare_discovery_mode?: "crawl" | "static";
  cloudflare_static_discovery_scope?: "seed" | "allowed_prefixes";
  cloudflare_job_retries?: number;
  cloudflare_per_seed_limit?: number | null;
  cloudflare_stall_timeout_ms?: number | null;
  cloudflare_discovery_timeout_ms?: number | null;
  cloudflare_discovery_delay_seconds?: number | null;
  cloudflare_markdown_retries?: number | null;
  cloudflare_markdown_retry_delay_ms?: number | null;
  cloudflare_markdown_timeout_ms?: number | null;
  cloudflare_crawl_purposes?: Array<"search" | "ai-input" | "ai-train">;
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
  site_id?: string | null;
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

export type PipelineRunRequest = {
  scrape: ScrapeRequest;
  prepare: PrepareRequest;
  upload: UploadRequest;
  callback_url?: string | null;
};

export type PipelineEnqueueResponse = {
  ok: boolean;
  run_id: string;
  procrastinate_job_id: number;
  message?: string | null;
};

export type RunStatusResponse = {
  ok: true;
  run_id: string;
  state_path: string;
  state?: Record<string, unknown> | null;
  pipeline?: Record<string, unknown> | null;
  current_step?: string | null;
  pipeline_status?: string | null;
  step_responses?: {
    scrape?: ApiStatus | null;
    prepare?: ApiStatus | null;
    upload?: ApiStatus | null;
  } | null;
  scrape?: Record<string, unknown> | null;
  prepare?: Record<string, unknown> | null;
  upload?: Record<string, unknown> | null;
  paths?: Record<string, unknown> | null;
};

export type StopPipelineResponse = {
  ok: true;
  run_id: string;
  cancel_file: string;
  procrastinate_job_id?: number | null;
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

export async function scraperEnqueueRun(req: PipelineRunRequest): Promise<PipelineEnqueueResponse> {
  return postJson<PipelineRunRequest, PipelineEnqueueResponse>("/runs", req);
}

export async function scraperRunStatus(runId: string): Promise<RunStatusResponse> {
  return getJson<RunStatusResponse>(`/runs/${encodeURIComponent(runId)}`);
}

export async function scraperStopRun(runId: string): Promise<StopPipelineResponse> {
  return postJson<Record<string, never>, StopPipelineResponse>(
    `/runs/${encodeURIComponent(runId)}/stop`,
    {},
  );
}

export async function waitForRunFinished(runId: string, opts?: { timeoutMs?: number }) {
  const timeoutMs = opts?.timeoutMs ?? 10 * 60 * 1000;
  const start = Date.now();
  while (true) {
    const status = await scraperRunStatus(runId);
    if (status.pipeline_status === "succeeded" || status.pipeline_status === "failed" || status.pipeline_status === "aborted") {
      return status;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Scraper pipeline run timed out after ${timeoutMs}ms (run_id=${runId})`);
    }
    // Poll with a short delay.
    await new Promise((r) => setTimeout(r, 1200));
  }
}

export type ScrapeRequest = {
  scrape_provider?: "firecrawl" | "cloudflare" | null;
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
  cloudflare_job_retries?: number;
  cloudflare_per_seed_limit?: number | null;
  cloudflare_stall_timeout_ms?: number | null;
  cloudflare_crawl_purposes?: Array<"search" | "ai-input" | "ai-train">;
  [key: string]: unknown;
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
  live_namespace?: string | null;
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

export type FirecrawlMapLink = {
  url: string;
  title?: string;
  description?: string;
};

export type FirecrawlDocument = {
  markdown?: string;
  html?: string;
  rawHtml?: string;
  links?: string[];
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
    url?: string;
    statusCode?: number;
    error?: string;
    [key: string]: unknown;
  };
  warning?: string;
  [key: string]: unknown;
};

export type FirecrawlMapResponse = {
  success: boolean;
  links?: FirecrawlMapLink[];
  error?: string;
};

export type FirecrawlBatchStartResponse = {
  success: boolean;
  id: string;
  url?: string;
  invalidURLs?: string[];
  error?: string;
};

export type FirecrawlBatchStatusResponse = {
  status: string;
  total?: number;
  completed?: number;
  creditsUsed?: number;
  expiresAt?: string;
  next?: string | null;
  data?: FirecrawlDocument[];
  error?: string;
};

export type FirecrawlProgressEvent = {
  event:
    | "start"
    | "map_start"
    | "map_done"
    | "map_failed"
    | "batch_start"
    | "batch_progress"
    | "crawl_start"
    | "crawl_progress"
    | "crawl_results"
    | "crawl_retry"
    | "crawl_delay"
    | "crawl_render_retry"
    | "crawl_partial"
    | "crawl_seed_failed"
    | "crawl_stalled"
    | "discover_start"
    | "discover_page"
    | "discover_failed"
    | "discover_done"
    | "markdown_start"
    | "markdown_done"
    | "markdown_failed"
    | "write_done"
    | "done";
  run_id: string;
  message?: string;
  data?: Record<string, unknown>;
};

export type SavedPage = {
  index: number;
  url: string;
  title: string | null;
  description: string | null;
  markdown_path: string;
  metadata_path: string;
  markdown_chars: number;
  status_code: number | null;
};

export type CloudflareCrawlStartResponse = {
  success: boolean;
  result?: string;
  errors?: Array<{ message?: string }>;
  messages?: unknown[];
};

export type CloudflareCrawlRecord = {
  url?: string;
  status?: string;
  markdown?: string;
  html?: string;
  metadata?: {
    status?: number;
    title?: string;
    url?: string;
    description?: string;
    links?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type CloudflareCrawlStatusResponse = {
  success: boolean;
  result?: {
    id?: string;
    status?: string;
    browserSecondsUsed?: number;
    total?: number;
    finished?: number;
    records?: CloudflareCrawlRecord[];
    cursor?: string | number | null;
    [key: string]: unknown;
  };
  errors?: Array<{ message?: string }>;
  messages?: unknown[];
};

export type CloudflareMarkdownResponse = {
  success: boolean;
  result?: string;
  errors?: Array<{ message?: string }>;
  messages?: unknown[];
};

export type CloudflareLinksResponse = {
  success: boolean;
  result?: string[];
  errors?: Array<{ message?: string }>;
  messages?: unknown[];
};

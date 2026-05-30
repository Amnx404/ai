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
  firecrawl_scrape_options?: Record<string, unknown>;
  firecrawl_batch_options?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ApiStatus = {
  ok: boolean;
  step: "scrape" | "prepare" | "upload" | "status";
  run_id: string;
  started_at?: string | null;
  finished_at?: string | null;
  message?: string | null;
  outputs?: Record<string, unknown>;
  logs?: Record<string, string>;
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

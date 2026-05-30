import type {
  FirecrawlBatchStartResponse,
  FirecrawlBatchStatusResponse,
  FirecrawlMapResponse,
} from "./types.js";

export type FirecrawlClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  maxRetries?: number;
  requestTimeoutMs?: number;
};

export class FirecrawlApiError extends Error {
  readonly status: number | null;
  readonly body: unknown;
  readonly retryable: boolean;

  constructor(message: string, opts: { status?: number | null; body?: unknown; retryable?: boolean }) {
    super(message);
    this.name = "FirecrawlApiError";
    this.status = opts.status ?? null;
    this.body = opts.body;
    this.retryable = Boolean(opts.retryable);
  }
}

export class FirecrawlClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly requestTimeoutMs: number;

  constructor(opts: FirecrawlClientOptions = {}) {
    const apiKey = opts.apiKey ?? process.env.FIRECRAWL_API_KEY ?? "";
    if (!apiKey.trim()) {
      throw new Error("FIRECRAWL_API_KEY is not set");
    }

    this.apiKey = apiKey.trim();
    this.baseUrl = (opts.baseUrl ?? process.env.FIRECRAWL_BASE_URL ?? "https://api.firecrawl.dev")
      .trim()
      .replace(/\/+$/, "");
    this.maxRetries = opts.maxRetries ?? 3;
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 90_000;
  }

  map(body: {
    url: string;
    sitemap?: "skip" | "include" | "only";
    includeSubdomains?: boolean;
    ignoreQueryParameters?: boolean;
    ignoreCache?: boolean;
    limit?: number;
    timeout?: number;
  }) {
    return this.post<FirecrawlMapResponse>("/v2/map", body);
  }

  startBatchScrape(body: Record<string, unknown>) {
    return this.post<FirecrawlBatchStartResponse>("/v2/batch/scrape", body);
  }

  getBatchScrapeStatus(idOrUrl: string) {
    const path = idOrUrl.startsWith("http")
      ? idOrUrl
      : `/v2/batch/scrape/${encodeURIComponent(idOrUrl)}`;
    return this.get<FirecrawlBatchStatusResponse>(path);
  }

  startCrawl(body: Record<string, unknown>) {
    return this.post<{ success: boolean; id: string; url?: string; error?: string }>(
      "/v2/crawl",
      body,
    );
  }

  getCrawlStatus(idOrUrl: string) {
    const path = idOrUrl.startsWith("http")
      ? idOrUrl
      : `/v2/crawl/${encodeURIComponent(idOrUrl)}`;
    return this.get<FirecrawlBatchStatusResponse>(path);
  }

  private get<T>(pathOrUrl: string) {
    return this.request<T>(pathOrUrl, { method: "GET" });
  }

  private post<T>(pathOrUrl: string, body: unknown) {
    return this.request<T>(pathOrUrl, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  private async request<T>(pathOrUrl: string, init: RequestInit): Promise<T> {
    const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${this.baseUrl}${pathOrUrl}`;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const res = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
          },
        });

        const text = await res.text();
        const body = parseMaybeJson(text);

        if (!res.ok) {
          const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
          const message = firecrawlErrorMessage(body, res.status, res.statusText);
          const error = new FirecrawlApiError(message, { status: res.status, body, retryable });

          if (retryable && attempt < this.maxRetries) {
            await sleep(retryDelayMs(attempt, res.headers.get("retry-after")));
            continue;
          }

          throw error;
        }

        return body as T;
      } catch (error) {
        lastError = error;
        if (error instanceof FirecrawlApiError) throw error;
        if (attempt < this.maxRetries) {
          await sleep(retryDelayMs(attempt, null));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new FirecrawlApiError("Firecrawl request failed", {
      body: lastError instanceof Error ? lastError.message : lastError,
      retryable: true,
    });
  }
}

function parseMaybeJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function firecrawlErrorMessage(body: unknown, status: number, statusText: string) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error.trim();
  }
  if (typeof body === "string" && body.trim()) return body.trim();
  return `Firecrawl error ${status} ${statusText}`;
}

function retryDelayMs(attempt: number, retryAfter: string | null) {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }

  return Math.min(20_000, 750 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

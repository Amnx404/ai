import type {
  CloudflareCrawlStartResponse,
  CloudflareCrawlStatusResponse,
  CloudflareLinksResponse,
  CloudflareMarkdownResponse,
} from "./types.js";

export type CloudflareClientOptions = {
  apiToken?: string;
  accountId?: string;
  baseUrl?: string;
  maxRetries?: number;
  requestTimeoutMs?: number;
};

export class CloudflareApiError extends Error {
  readonly status: number | null;
  readonly body: unknown;
  readonly retryable: boolean;

  constructor(message: string, opts: { status?: number | null; body?: unknown; retryable?: boolean }) {
    super(message);
    this.name = "CloudflareApiError";
    this.status = opts.status ?? null;
    this.body = opts.body;
    this.retryable = Boolean(opts.retryable);
  }
}

export class CloudflareBrowserRunClient {
  private readonly apiToken: string;
  private readonly accountId: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly requestTimeoutMs: number;

  constructor(opts: CloudflareClientOptions = {}) {
    const apiToken = opts.apiToken ?? process.env.CLOUDFLARE_API_TOKEN ?? "";
    if (!apiToken.trim()) {
      throw new Error("CLOUDFLARE_API_TOKEN is not set");
    }

    const accountId = opts.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
    if (!accountId.trim()) {
      throw new Error("CLOUDFLARE_ACCOUNT_ID is not set");
    }

    this.apiToken = apiToken.trim();
    this.accountId = accountId.trim();
    this.baseUrl = (opts.baseUrl ?? process.env.CLOUDFLARE_API_BASE_URL ?? "https://api.cloudflare.com/client/v4")
      .trim()
      .replace(/\/+$/, "");
    this.maxRetries = opts.maxRetries ?? numberEnv("CLOUDFLARE_REQUEST_MAX_RETRIES", 1);
    this.requestTimeoutMs = opts.requestTimeoutMs ?? numberEnv("CLOUDFLARE_REQUEST_TIMEOUT_MS", 45_000);
  }

  startCrawl(body: Record<string, unknown>) {
    return this.post<CloudflareCrawlStartResponse>("/browser-rendering/crawl", body);
  }

  extractMarkdown(body: Record<string, unknown>) {
    return this.post<CloudflareMarkdownResponse>("/browser-rendering/markdown", body);
  }

  extractLinks(body: Record<string, unknown>) {
    return this.post<CloudflareLinksResponse>("/browser-rendering/links", body);
  }

  getCrawl(jobId: string, params: Record<string, string | number | boolean | null | undefined> = {}) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value == null || value === "") continue;
      search.set(key, String(value));
    }
    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return this.get<CloudflareCrawlStatusResponse>(
      `/browser-rendering/crawl/${encodeURIComponent(jobId)}${suffix}`,
    );
  }

  cancelCrawl(jobId: string) {
    return this.request<unknown>(`/browser-rendering/crawl/${encodeURIComponent(jobId)}`, {
      method: "DELETE",
    });
  }

  private get<T>(path: string) {
    return this.request<T>(path, { method: "GET" });
  }

  private post<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  private async request<T>(accountPath: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/accounts/${encodeURIComponent(this.accountId)}${accountPath}`;
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const res = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
          },
        });

        const text = await res.text();
        const body = parseMaybeJson(text);

        if (!res.ok) {
          const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
          const error = new CloudflareApiError(cloudflareErrorMessage(body, res.status, res.statusText), {
            status: res.status,
            body,
            retryable,
          });

          if (retryable && attempt < this.maxRetries) {
            await sleep(retryDelayMs(attempt, res.headers.get("retry-after")));
            continue;
          }

          throw error;
        }

        return body as T;
      } catch (error) {
        lastError = error;
        if (error instanceof CloudflareApiError) throw error;
        if (attempt < this.maxRetries) {
          await sleep(retryDelayMs(attempt, null));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new CloudflareApiError("Cloudflare Browser Run request failed", {
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

function cloudflareErrorMessage(body: unknown, status: number, statusText: string) {
  if (body && typeof body === "object" && "errors" in body) {
    const errors = (body as { errors?: Array<{ message?: unknown }> }).errors ?? [];
    const message = errors
      .map((error) => (typeof error.message === "string" ? error.message.trim() : ""))
      .filter(Boolean)
      .join("; ");
    if (message) return message;
  }
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) return error.trim();
  }
  if (typeof body === "string" && body.trim()) return body.trim();
  return `Cloudflare Browser Run error ${status} ${statusText}`;
}

function retryDelayMs(attempt: number, retryAfter: string | null) {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  }

  return Math.min(20_000, 750 * 2 ** attempt) + Math.floor(Math.random() * 250);
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import {
  applyRegexFilters,
  canonicalizeUrl,
  dedupeCandidates,
  isAllowedByPrefix,
  type UrlCandidate,
} from "./url-scope.js";

export type StaticDiscoveryPage = {
  url: string;
  depth: number;
  html: string | null;
  title: string | null;
  statusCode: number | null;
  contentType: string | null;
  links: string[];
  error?: string;
};

export type StaticDiscoveryResult = {
  pages: StaticDiscoveryPage[];
  discoveredUrlCount: number;
  failedUrlCount: number;
  queuedUrlCount: number;
};

export type StaticDiscoveryProgress =
  | {
      event: "discover_start";
      message?: string;
      data?: Record<string, unknown>;
    }
  | {
      event: "discover_page" | "discover_failed" | "discover_done";
      message?: string;
      data?: Record<string, unknown>;
    };

export async function discoverStaticPages(opts: {
  seedUrls: string[];
  allowedPrefixes: string[];
  respectAllowedPrefixes: boolean;
  maxPages: number;
  maxDepth: number;
  whitelist?: string[];
  blacklist?: string[];
  userAgent?: string;
  timeoutMs?: number;
  delayMs?: number;
  onProgress?: (event: StaticDiscoveryProgress) => void | Promise<void>;
}): Promise<StaticDiscoveryResult> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const delayMs = Math.max(0, opts.delayMs ?? 0);
  const queue: Array<{ url: string; depth: number }> = [];
  const known = new Map<string, number>();
  const visited = new Set<string>();
  const pages: StaticDiscoveryPage[] = [];
  const maxKnownUrls = Math.max(opts.maxPages * 4, opts.maxPages + opts.seedUrls.length);
  const assetTextCache = new Map<string, Promise<string | null>>();

  for (const seedUrl of opts.seedUrls) {
    const url = canonicalizeUrl(seedUrl);
    if (!url || known.has(url)) continue;
    if (!urlAllowed(url, opts)) continue;
    known.set(url, 0);
    queue.push({ url, depth: 0 });
  }

  await opts.onProgress?.({
    event: "discover_start",
    message: `Discovering static links from ${queue.length} seed URLs`,
    data: {
      seed_count: queue.length,
      max_pages: opts.maxPages,
      max_depth: opts.maxDepth,
    },
  });

  while (queue.length > 0 && fetchablePageCount(pages) < opts.maxPages) {
    const item = queue.shift();
    if (!item || visited.has(item.url)) continue;
    visited.add(item.url);

    try {
      const fetched = await fetchHtml(item.url, {
        timeoutMs,
        userAgent: opts.userAgent,
      });
      const pageUrl = canonicalizeUrl(fetched.url) ?? item.url;
      if (!urlAllowed(pageUrl, opts)) {
        throw new Error(`Redirected outside allowed URL scope: ${pageUrl}`);
      }
      if (pageUrl !== item.url) {
        known.set(pageUrl, item.depth);
        visited.add(pageUrl);
      }

      const rawLinks = extractDocumentLinks(fetched.html, pageUrl);
      if (rawLinks.length <= 5) {
        rawLinks.push(
          ...(await extractSparsePageAssetLinks(fetched.html, pageUrl, {
            timeoutMs,
            userAgent: opts.userAgent,
            cache: assetTextCache,
          })),
        );
      }
      const links = filterLinks(rawLinks, opts);

      pages.push({
        url: pageUrl,
        depth: item.depth,
        html: fetched.html,
        title: extractTitle(fetched.html),
        statusCode: fetched.statusCode,
        contentType: fetched.contentType,
        links,
      });

      if (item.depth < opts.maxDepth) {
        for (const link of links) {
          if (known.size >= maxKnownUrls) break;
          if (known.has(link) || visited.has(link)) continue;
          known.set(link, item.depth + 1);
          queue.push({ url: link, depth: item.depth + 1 });
        }
      }

      await opts.onProgress?.({
        event: "discover_page",
        message: `Discovered ${links.length} links on ${pageUrl}`,
        data: {
          url: pageUrl,
          requested_url: item.url !== pageUrl ? item.url : undefined,
          depth: item.depth,
          status_code: fetched.statusCode,
          links: links.length,
          queued: queue.length,
          discovered: known.size,
          pages: pages.length,
          fetchable_pages: fetchablePageCount(pages),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pages.push({
        url: item.url,
        depth: item.depth,
        html: null,
        title: null,
        statusCode: null,
        contentType: null,
        links: [],
        error: message,
      });
      await opts.onProgress?.({
        event: "discover_failed",
        message: `Static discovery failed for ${item.url}`,
        data: {
          url: item.url,
          depth: item.depth,
          error: message,
          queued: queue.length,
          discovered: known.size,
          pages: pages.length,
          fetchable_pages: fetchablePageCount(pages),
        },
      });
    }

    if (delayMs > 0 && queue.length > 0 && fetchablePageCount(pages) < opts.maxPages) {
      await sleep(delayMs);
    }
  }

  const failedUrlCount = pages.filter((page) => page.error).length;
  await opts.onProgress?.({
    event: "discover_done",
    message: `Static discovery found ${pages.length - failedUrlCount} fetchable pages`,
    data: {
      discovered_url_count: known.size,
      fetched_page_count: pages.length,
      fetchable_page_count: pages.length - failedUrlCount,
      failed_url_count: failedUrlCount,
      queued_url_count: queue.length,
    },
  });

  return {
    pages,
    discoveredUrlCount: known.size,
    failedUrlCount,
    queuedUrlCount: queue.length,
  };
}

function fetchablePageCount(pages: StaticDiscoveryPage[]) {
  return pages.filter((page) => page.html?.trim() && !page.error).length;
}

async function extractSparsePageAssetLinks(
  html: string,
  pageUrl: string,
  opts: {
    timeoutMs: number;
    userAgent?: string;
    cache: Map<string, Promise<string | null>>;
  },
) {
  const links: string[] = [];
  const pending = extractDiscoveryAssetUrls(html, pageUrl);
  const seen = new Set<string>();

  while (pending.length > 0 && seen.size < 20) {
    const assetUrl = pending.shift();
    if (!assetUrl || seen.has(assetUrl)) continue;
    seen.add(assetUrl);

    const text = await fetchDiscoveryAssetText(assetUrl, opts);
    if (!text) continue;

    links.push(...extractQuotedUrls(text, assetUrl));
    for (const nestedAssetUrl of extractDiscoveryAssetUrlsFromText(text, assetUrl)) {
      if (!seen.has(nestedAssetUrl)) pending.push(nestedAssetUrl);
    }
  }

  return links;
}

function extractDiscoveryAssetUrls(html: string, pageUrl: string) {
  const urls = new Set<string>();
  const scriptRe = /<script\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html))) {
    const src = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    const absolute = resolveDocumentUrl(src, pageUrl);
    if (absolute && isDiscoveryAssetUrl(absolute, pageUrl)) urls.add(absolute);
  }
  return [...urls];
}

function extractDiscoveryAssetUrlsFromText(text: string, baseUrl: string) {
  return extractQuotedUrls(text, baseUrl).filter((url) => isDiscoveryAssetUrl(url, baseUrl));
}

function extractQuotedUrls(text: string, baseUrl: string) {
  const urls = new Set<string>();
  const re = /["'`]((?:https?:\/\/|\/)[^"'`<>\s]+)["'`]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const raw = match[1]?.trim();
    if (!raw || !looksLikeUsefulDiscoveredUrl(raw)) continue;
    const absolute = resolveDocumentUrl(raw, baseUrl);
    if (absolute) urls.add(absolute);
  }
  return [...urls];
}

function looksLikeUsefulDiscoveredUrl(raw: string) {
  if (/^https?:\/\//i.test(raw)) return true;
  if (!raw.startsWith("/")) return false;
  if (raw.startsWith("//")) return false;
  if (raw.length < 4) return false;

  try {
    const url = new URL(raw, "https://example.test");
    const pathname = url.pathname;
    if (/^\/(?:assets?|static|fonts?|icons?|images?|img|logos?|var|script|style|styles)(?:\/|$)/i.test(pathname)) {
      return /\.(?:json)$/i.test(pathname);
    }
    if (/\.(?:css|js|mjs|map|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp4|mov|avi)$/i.test(pathname)) {
      return false;
    }
    return /[a-z]/i.test(pathname);
  } catch {
    return false;
  }
}

function isDiscoveryAssetUrl(assetUrl: string, pageUrl: string) {
  try {
    const asset = new URL(assetUrl);
    const page = new URL(pageUrl);
    return asset.origin === page.origin && /\.(?:js|mjs|json)$/i.test(asset.pathname);
  } catch {
    return false;
  }
}

function fetchDiscoveryAssetText(
  assetUrl: string,
  opts: {
    timeoutMs: number;
    userAgent?: string;
    cache: Map<string, Promise<string | null>>;
  },
) {
  const cached = opts.cache.get(assetUrl);
  if (cached) return cached;

  const promise = fetchDiscoveryAssetTextUncached(assetUrl, opts);
  opts.cache.set(assetUrl, promise);
  return promise;
}

async function fetchDiscoveryAssetTextUncached(
  assetUrl: string,
  opts: { timeoutMs: number; userAgent?: string },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const res = await fetch(assetUrl, {
      signal: controller.signal,
      headers: {
        Accept: "text/javascript,application/javascript,application/json,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent": opts.userAgent?.trim() || "website-knowledge-scraper/1.0",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
    if (
      contentType &&
      !contentType.includes("javascript") &&
      !contentType.includes("application/json") &&
      !contentType.includes("text/plain")
    ) {
      return null;
    }
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function urlAllowed(
  url: string,
  opts: {
    allowedPrefixes: string[];
    respectAllowedPrefixes: boolean;
    whitelist?: string[];
    blacklist?: string[];
  },
) {
  if (opts.respectAllowedPrefixes && !isAllowedByPrefix(url, opts.allowedPrefixes)) return false;
  if (isLikelyNonHtmlUrl(url)) return false;
  return applyRegexFilters([{ url, source: "static-discovery" }], {
    whitelist: opts.whitelist,
    blacklist: opts.blacklist,
  }).length > 0;
}

function filterLinks(
  urls: string[],
  opts: {
    allowedPrefixes: string[];
    respectAllowedPrefixes: boolean;
    whitelist?: string[];
    blacklist?: string[];
  },
) {
  const candidates: UrlCandidate[] = urls
    .map((url) => canonicalizeUrl(url))
    .filter((url): url is string => Boolean(url))
    .filter((url) => !isLikelyNonHtmlUrl(url))
    .map((url) => ({ url, source: "static-discovery" }));
  const scoped = dedupeCandidates(candidates).filter((candidate) =>
    opts.respectAllowedPrefixes ? isAllowedByPrefix(candidate.url, opts.allowedPrefixes) : true,
  );
  return applyRegexFilters(scoped, {
    whitelist: opts.whitelist,
    blacklist: opts.blacklist,
  }).map((candidate) => candidate.url);
}

async function fetchHtml(url: string, opts: { timeoutMs: number; userAgent?: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": opts.userAgent?.trim() || "website-knowledge-scraper/1.0",
      },
      redirect: "follow",
    });
    const contentType = res.headers.get("content-type");
    const html = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    if (contentType && !isTextLikeContentType(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
    return {
      url: res.url,
      html,
      statusCode: res.status,
      contentType,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isTextLikeContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("text/html") ||
    normalized.includes("application/xhtml+xml") ||
    normalized.includes("text/plain") ||
    normalized.includes("application/xml")
  );
}

function extractDocumentLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const re = /<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const href = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    const absolute = resolveDocumentUrl(href, baseUrl);
    if (absolute) links.add(absolute);
  }
  return [...links];
}

function resolveDocumentUrl(href: string, baseUrl: string) {
  if (!href) return null;
  const lowered = href.trim().toLowerCase();
  if (
    lowered.startsWith("mailto:") ||
    lowered.startsWith("tel:") ||
    lowered.startsWith("javascript:") ||
    lowered.startsWith("data:")
  ) {
    return null;
  }

  try {
    const url = new URL(href, baseUrl);
    url.hash = "";
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isLikelyNonHtmlUrl(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(?:7z|avif|bmp|css|csv|doc|docx|eot|gif|gz|ico|jpeg|jpg|js|json|map|mjs|mov|mp3|mp4|odp|ods|odt|pdf|png|ppt|pptx|rar|svg|tar|tgz|ttf|wav|webm|webp|woff|woff2|xls|xlsx|xml|zip)$/.test(
      pathname,
    );
  } catch {
    return false;
  }
}

function extractTitle(html: string) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return null;
  return decodeHtmlEntities(stripTags(match[1])).replace(/\s+/g, " ").trim() || null;
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  markdownSource?: "html" | "url";
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
  parallelWorkers?: number;
  onProgress?: (event: StaticDiscoveryProgress) => void | Promise<void>;
}): Promise<StaticDiscoveryResult> {
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const delayMs = Math.max(0, opts.delayMs ?? 0);
  const parallelWorkers = clampInteger(opts.parallelWorkers, 1, 1, 32);
  const queue: Array<{ url: string; depth: number }> = [];
  const known = new Map<string, number>();
  const visited = new Set<string>();
  const pages: StaticDiscoveryPage[] = [];
  const maxKnownUrls = Math.max(opts.maxPages * 4, opts.maxPages + opts.seedUrls.length);
  const assetTextCache = new Map<string, Promise<string | null>>();
  const sourceFallbackCache = new Map<string, Promise<string[]>>();

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
      parallel_workers: parallelWorkers,
    },
  });

  const takeNextItem = () => {
    while (queue.length > 0 && fetchablePageCount(pages) < opts.maxPages) {
      const item = queue.shift();
      if (!item || visited.has(item.url)) continue;
      visited.add(item.url);
      return item;
    }
    return null;
  };

  const processItem = async (item: { url: string; depth: number }) => {
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

      const documentLinks = extractDocumentLinks(fetched.html, pageUrl);
      const assetLinks =
        documentLinks.length <= 5
          ? await extractSparsePageAssetLinks(fetched.html, pageUrl, {
              timeoutMs,
              userAgent: opts.userAgent,
              cache: assetTextCache,
            })
          : [];
      const useUrlMarkdown = assetLinks.length > 0 && looksLikeSparseDynamicShell(fetched.html);
      const rawLinks = [...documentLinks, ...assetLinks];
      const links = filterLinks(rawLinks, opts);

      pages.push({
        url: pageUrl,
        depth: item.depth,
        html: fetched.html,
        title: extractTitle(fetched.html),
        statusCode: fetched.statusCode,
        contentType: fetched.contentType,
        links,
        markdownSource: useUrlMarkdown ? "url" : "html",
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
      const fallbackLinks =
        item.depth < opts.maxDepth
          ? filterLinks(
              await discoverSourceFallbackLinks(item.url, {
                timeoutMs,
                userAgent: opts.userAgent,
                cache: sourceFallbackCache,
              }),
              opts,
            )
          : [];

      for (const link of fallbackLinks) {
        if (known.size >= maxKnownUrls) break;
        if (known.has(link) || visited.has(link)) continue;
        known.set(link, item.depth + 1);
        queue.push({ url: link, depth: item.depth + 1 });
      }

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
          fallback_links: fallbackLinks.length,
        },
      });
    }
  };

  await new Promise<void>((resolve, reject) => {
    let active = 0;
    let settled = false;

    const pump = () => {
      if (settled) return;

      try {
        while (active < parallelWorkers && fetchablePageCount(pages) < opts.maxPages) {
          const item = takeNextItem();
          if (!item) break;

          active += 1;
          void processItem(item)
            .then(async () => {
              if (delayMs > 0 && queue.length > 0 && fetchablePageCount(pages) < opts.maxPages) {
                await sleep(delayMs);
              }
            })
            .then(
              () => {
                active -= 1;
                pump();
              },
              (error) => {
                settled = true;
                reject(error);
              },
            );
        }

        if (active === 0 && (queue.length === 0 || fetchablePageCount(pages) >= opts.maxPages)) {
          settled = true;
          resolve();
        }
      } catch (error) {
        settled = true;
        reject(error);
      }
    };

    pump();
  });

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

function looksLikeSparseDynamicShell(html: string) {
  const text = stripTags(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

  return text.length < 500;
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

function discoverSourceFallbackLinks(
  pageUrl: string,
  opts: {
    timeoutMs: number;
    userAgent?: string;
    cache: Map<string, Promise<string[]>>;
  },
) {
  const fallbackKey = readTheDocsProjectKey(pageUrl);
  if (!fallbackKey) return Promise.resolve([]);

  const cached = opts.cache.get(fallbackKey);
  if (cached) return cached;

  const promise = discoverReadTheDocsSourceLinks(fallbackKey, opts);
  opts.cache.set(fallbackKey, promise);
  return promise;
}

function readTheDocsProjectKey(pageUrl: string) {
  try {
    const url = new URL(pageUrl);
    const match = url.hostname.match(/^([a-z0-9-]+)\.readthedocs\.io$/i);
    if (!match?.[1]) return null;
    const version = url.pathname.match(/^\/[a-z]{2}\/([^/]+)/i)?.[1] ?? "";
    return `${match[1]}:${version || "default"}`;
  } catch {
    return null;
  }
}

async function discoverReadTheDocsSourceLinks(
  fallbackKey: string,
  opts: { timeoutMs: number; userAgent?: string },
) {
  const [slug, rawVersion] = fallbackKey.split(":");
  if (!slug) return [];

  const project = await fetchJson<Record<string, unknown>>(
    `https://readthedocs.org/api/v3/projects/${encodeURIComponent(slug)}/`,
    opts,
  );
  if (!project) return [];

  const versionSlug =
    rawVersion && rawVersion !== "default"
      ? rawVersion
      : typeof project.default_version === "string" && project.default_version.trim()
        ? project.default_version.trim()
        : "";
  const version =
    versionSlug.length > 0
      ? await fetchJson<Record<string, unknown>>(
          `https://readthedocs.org/api/v3/projects/${encodeURIComponent(slug)}/versions/${encodeURIComponent(
            versionSlug,
          )}/`,
          opts,
        )
      : null;

  const vcsUrl = stringAtPath(version, ["urls", "vcs"]) ?? stringAtPath(project, ["urls", "vcs"]);
  const repositoryUrl = stringAtPath(project, ["repository", "url"]);
  const source = parseGitHubSource(vcsUrl) ?? parseGitHubSource(repositoryUrl);
  if (!source) return [];

  const tree = await fetchJson<{ tree?: Array<{ path?: unknown; type?: unknown }> }>(
    `https://api.github.com/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(
      source.repo,
    )}/git/trees/${encodeURIComponent(source.ref)}?recursive=1`,
    opts,
  );
  const files = tree?.tree ?? [];
  return files.flatMap((item) => {
    const path = typeof item.path === "string" ? item.path : "";
    if (item.type !== "blob" || !isUsefulDocsSourcePath(path)) return [];
    return `${source.rawBase}${path.split("/").map(encodeURIComponent).join("/")}`;
  });
}

async function fetchJson<T>(url: string, opts: { timeoutMs: number; userAgent?: string }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": opts.userAgent?.trim() || "website-knowledge-scraper/1.0",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseGitHubSource(rawUrl: string | null) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl.replace(/\.git$/, ""));
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const [owner, repo] = parts;
    if (!owner || !repo) return null;
    const treeIndex = parts.indexOf("tree");
    const ref =
      treeIndex >= 0 && parts[treeIndex + 1]
        ? parts.slice(treeIndex + 1).join("/")
        : "main";
    return {
      owner,
      repo,
      ref,
      rawBase: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/`,
    };
  } catch {
    return null;
  }
}

function stringAtPath(value: unknown, path: string[]) {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function isUsefulDocsSourcePath(path: string) {
  if (!/\.(?:md|rst|txt)$/i.test(path)) return false;
  if (/^(?:\.github|_templates|extensions)\//.test(path)) return false;
  if (/^LICENSE/i.test(path)) return false;
  return true;
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
    normalized.includes("text/markdown") ||
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

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
}

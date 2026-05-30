import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { runFirecrawlScrape } from "./scrape.js";

const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = init?.method ?? "GET";

  if (method === "POST" && url.endsWith("/v2/map")) {
    return jsonResponse({
      success: true,
      links: [
        { url: "https://example.com/docs", title: "Docs" },
        { url: "https://example.com/docs/getting-started", title: "Getting Started" },
        { url: "https://example.com/blog/off-scope", title: "Off Scope" },
      ],
    });
  }

  if (method === "POST" && url.endsWith("/v2/batch/scrape")) {
    const body = JSON.parse(String(init?.body ?? "{}")) as { urls?: string[] };
    const urls = body.urls ?? [];

    if (
      urls.length !== 2 ||
      urls.some((candidate) => !candidate.startsWith("https://example.com/docs"))
    ) {
      return jsonResponse(
        {
          success: false,
          error: `Unexpected scoped URLs: ${urls.join(", ")}`,
        },
        400,
      );
    }

    return jsonResponse({ success: true, id: "batch_mock_123", invalidURLs: [] });
  }

  if (method === "GET" && url.endsWith("/v2/batch/scrape/batch_mock_123")) {
    return jsonResponse({
      status: "completed",
      total: 2,
      completed: 2,
      creditsUsed: 2,
      data: [
        {
          markdown: "# Docs\n\nWelcome to the docs.",
          metadata: {
            title: "Docs",
            sourceURL: "https://example.com/docs",
            statusCode: 200,
          },
        },
        {
          markdown: "# Getting Started\n\nInstall the widget.",
          metadata: {
            title: "Getting Started",
            sourceURL: "https://example.com/docs/getting-started",
            statusCode: 200,
          },
        },
      ],
    });
  }

  return jsonResponse({ success: false, error: `Unhandled fetch ${method} ${url}` }, 500);
}) as typeof fetch;

try {
  process.env.FIRECRAWL_API_KEY = "fc-smoke-test";
  process.env.FIRECRAWL_BASE_URL = "https://api.firecrawl.test";

  const outputRoot = await mkdtemp(join(tmpdir(), "firecrawl-smoke-"));
  const status = await runFirecrawlScrape(
    {
      seed_urls: ["https://example.com/docs"],
      allowed_prefixes: ["https://example.com/docs"],
      max_pages: 10,
      parallel_workers: 2,
      respect_allowed_prefixes: true,
    },
    {
      outputRoot,
      pollIntervalMs: 1,
    },
  );

  if (!status.ok) throw new Error("Smoke scrape returned ok=false");
  if (status.outputs?.page_count !== 2) {
    throw new Error(`Expected 2 saved pages, got ${String(status.outputs?.page_count)}`);
  }

  const manifestPath = status.outputs.manifest_path;
  if (typeof manifestPath !== "string") throw new Error("Missing manifest path");

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    urls?: string[];
  };
  if (manifest.urls?.includes("https://example.com/blog/off-scope")) {
    throw new Error("Allowed-prefix filtering failed");
  }

  await rm(outputRoot, { recursive: true, force: true });
  console.log("Firecrawl scraper smoke test passed");
} finally {
  globalThis.fetch = originalFetch;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

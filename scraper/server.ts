import { createServer, type IncomingMessage, type ServerResponse } from "http";

import { CloudflareApiError } from "./cloudflare-client.js";
import { FirecrawlApiError } from "./firecrawl-client.js";
import { loadDotEnv } from "./load-env.js";
import { enqueuePipelineRun, getPipelineRunStatus, stopPipelineRun } from "./pipeline.js";
import { runPrepare } from "./prepare.js";
import { runScrape } from "./scrape.js";
import { runUpload } from "./upload.js";
import type { PipelineRunRequest, PrepareRequest, ScrapeRequest, UploadRequest } from "./types.js";

loadDotEnv();

const port = Number(process.env.SCRAPER_PORT ?? 8787);
const host = process.env.SCRAPER_HOST ?? "0.0.0.0";

const server = createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (error) {
    sendJson(res, statusFromError(error), {
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected scraper error",
    });
  }
});

server.listen(port, host, () => {
  console.log(`[scraper] listening on http://${host}:${port}`);
});

async function route(req: IncomingMessage, res: ServerResponse) {
  const method = req.method ?? "GET";
  const pathname = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`).pathname;

  if (method === "OPTIONS") {
    writeCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (method === "GET" && pathname === "/health") {
    sendJson(res, 200, { ok: true, service: "scraper" });
    return;
  }

  if (method === "POST" && pathname === "/scrape") {
    const body = (await readJson(req)) as ScrapeRequest;
    const status = await runScrape(body);
    sendJson(res, 200, status);
    return;
  }

  if (method === "POST" && pathname === "/prepare") {
    const body = (await readJson(req)) as PrepareRequest;
    const status = await runPrepare(body);
    sendJson(res, 200, status);
    return;
  }

  if (method === "POST" && pathname === "/upload") {
    const body = (await readJson(req)) as UploadRequest;
    const status = await runUpload(body);
    sendJson(res, 200, status);
    return;
  }

  if (method === "POST" && pathname === "/runs") {
    const body = (await readJson(req)) as PipelineRunRequest;
    sendJson(res, 200, enqueuePipelineRun(body));
    return;
  }

  const runStatusMatch = pathname.match(/^\/runs\/([^/]+)$/);
  if (method === "GET" && runStatusMatch?.[1]) {
    sendJson(res, 200, getPipelineRunStatus(decodeURIComponent(runStatusMatch[1])));
    return;
  }

  const runStopMatch = pathname.match(/^\/runs\/([^/]+)\/stop$/);
  if (method === "POST" && runStopMatch?.[1]) {
    await readJson(req);
    sendJson(res, 200, stopPipelineRun(decodeURIComponent(runStopMatch[1])));
    return;
  }

  if (method === "POST" && pathname === "/scrape/stream") {
    const body = (await readJson(req)) as ScrapeRequest;
    writeCorsHeaders(res);
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const status = await runScrape(body, {
        onProgress: (event) => writeEvent(event.event, event),
      });
      writeEvent("result", status);
    } catch (error) {
      writeEvent("error", {
        ok: false,
        error: error instanceof Error ? error.message : "Scrape failed",
      });
    } finally {
      res.end();
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  writeCorsHeaders(res);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(`${JSON.stringify(body)}\n`);
}

function writeCorsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function statusFromError(error: unknown) {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    if (Number.isInteger(status) && status >= 400 && status <= 599) return status;
  }
  if (error instanceof FirecrawlApiError && error.status) return error.status >= 500 ? 502 : error.status;
  if (error instanceof CloudflareApiError && error.status) return error.status >= 500 ? 502 : error.status;
  return 500;
}

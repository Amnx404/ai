import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { basename, join, resolve } from "path";

import type { ApiStatus, PrepareRequest } from "./types.js";

type PageMetadata = {
  url?: string | null;
  title?: string | null;
  description?: string | null;
  [key: string]: unknown;
};

type PreparedChunk = {
  id: string;
  run_id: string;
  page_index: number;
  chunk_index: number;
  url: string;
  title: string | null;
  description: string | null;
  text: string;
  source_path: string;
  chars: number;
};

const DEFAULT_CHUNK_CHARS = 1800;
const DEFAULT_CHUNK_OVERLAP = 220;

export async function runPrepare(request: PrepareRequest): Promise<ApiStatus> {
  const started = new Date();
  const runId = requireRunId(request.run_id);
  const outputRoot = resolve(process.env.SCRAPER_OUTPUT_DIR ?? ".temp/scraper-runs");
  const runDir = join(outputRoot, runId);
  const pagesDir = request.input_pages_dir ? resolve(request.input_pages_dir) : join(runDir, "pages");
  const metadataDir = join(runDir, "metadata");
  const ingestionDir = join(runDir, request.output_subdir?.trim() || "ingestion");
  const minChars = clampInteger(request.min_chars, 80, 0, 50_000);

  await mkdir(ingestionDir, { recursive: true });

  const pageFiles = (await readdir(pagesDir))
    .filter((name) => name.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));

  const chunks: PreparedChunk[] = [];
  let preparedPages = 0;
  let skippedPages = 0;

  for (const [pageOffset, filename] of pageFiles.entries()) {
    const pageIndex = pageOffset + 1;
    const sourcePath = join(pagesDir, filename);
    const markdown = (await readFile(sourcePath, "utf8")).trim();
    if (markdown.length < minChars) {
      skippedPages += 1;
      continue;
    }

    const metadata = await readMetadata(join(metadataDir, `${basename(filename, ".md")}.json`));
    const cleaned = await maybeCleanMarkdown(markdown, request, metadata);
    const text = cleaned.trim();
    if (text.length < minChars) {
      skippedPages += 1;
      continue;
    }

    preparedPages += 1;
    const pageChunks = chunkText(text, DEFAULT_CHUNK_CHARS, DEFAULT_CHUNK_OVERLAP);
    for (const [chunkOffset, chunk] of pageChunks.entries()) {
      chunks.push({
        id: `${runId}:${String(pageIndex).padStart(5, "0")}:${String(chunkOffset + 1).padStart(3, "0")}`,
        run_id: runId,
        page_index: pageIndex,
        chunk_index: chunkOffset + 1,
        url: metadata.url?.trim() || "",
        title: metadata.title?.trim() || null,
        description: metadata.description?.trim() || null,
        text: chunk,
        source_path: sourcePath,
        chars: chunk.length,
      });
    }
  }

  const chunksPath = join(ingestionDir, "chunks.jsonl");
  await writeFile(chunksPath, `${chunks.map((chunk) => JSON.stringify(chunk)).join("\n")}\n`, "utf8");

  const manifestPath = join(ingestionDir, "manifest.json");
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        run_id: runId,
        provider: "local-prepare",
        pages_dir: pagesDir,
        page_count: pageFiles.length,
        prepared_page_count: preparedPages,
        skipped_page_count: skippedPages,
        chunk_count: chunks.length,
        chunks_path: chunksPath,
        finetune: Boolean(request.finetune),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const finished = new Date();
  return {
    ok: true,
    step: "prepare",
    run_id: runId,
    started_at: started.toISOString(),
    finished_at: finished.toISOString(),
    message: `Prepared ${chunks.length} chunks from ${preparedPages} pages`,
    outputs: {
      ingestion_dir: ingestionDir,
      chunks_path: chunksPath,
      manifest_path: manifestPath,
      chunk_count: chunks.length,
      page_count: preparedPages,
      skipped_page_count: skippedPages,
    },
    logs: {
      summary: `Prepared ${chunks.length} chunks from ${preparedPages} pages; skipped ${skippedPages}.`,
    },
  };
}

async function readMetadata(path: string): Promise<PageMetadata> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as PageMetadata;
  } catch {
    return {};
  }
}

async function maybeCleanMarkdown(markdown: string, request: PrepareRequest, metadata: PageMetadata) {
  if (!request.finetune) return markdown;

  const apiKey = request.openrouter_api_key ?? process.env.OPENROUTER_API_KEY ?? "";
  const model = request.finetune_model ?? request.openrouter_model ?? process.env.SCRAPER_FINETUNE_MODEL ?? process.env.OPENROUTER_MODEL ?? "";
  const prompt = request.finetune_prompt ?? process.env.FINETUNE_PROMPT ?? "";
  if (!apiKey.trim() || !model.trim() || !prompt.trim()) return markdown;

  const maxInputChars = clampInteger(request.finetune_max_input_chars, 120_000, 500, 500_000);
  const sourceHint = [metadata.title, metadata.url].filter(Boolean).join("\n");
  const content = `${prompt.trim()}\n\nSource:\n${sourceHint}\n\nMarkdown:\n${markdown.slice(0, maxInputChars)}`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3001",
        "X-Title": "Website Knowledge Scraper",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        temperature: 0,
      }),
    });

    if (!res.ok) return markdown;
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    return body.choices?.[0]?.message?.content?.trim() || markdown;
  } catch {
    return markdown;
  }
}

function chunkText(text: string, maxChars: number, overlapChars: number) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const hardEnd = Math.min(normalized.length, cursor + maxChars);
    let end = hardEnd;
    const paragraphBreak = normalized.lastIndexOf("\n\n", hardEnd);
    const sentenceBreak = normalized.lastIndexOf(". ", hardEnd);
    const softBreak = Math.max(paragraphBreak, sentenceBreak);
    if (softBreak > cursor + Math.floor(maxChars * 0.45)) end = softBreak + (softBreak === sentenceBreak ? 1 : 0);

    const chunk = normalized.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
    cursor = Math.max(0, end - overlapChars);
  }

  return chunks;
}

function requireRunId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("prepare.run_id is required");
  }
  return value.trim();
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

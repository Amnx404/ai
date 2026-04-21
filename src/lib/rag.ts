import { type Site } from "@prisma/client";

import { chatCompletion, streamChat } from "~/lib/openrouter";
import { embedText } from "~/lib/pinecone-embed";
import { queryPinecone, resolvePineconeTarget, type RetrievedChunk } from "~/lib/pinecone";
import { env } from "~/env.js";

const SEARCH_QUERY_LIMIT = 2;
const TOP_K = 10;
const SCORE_THRESHOLD = 0.05;
const MAX_CONTEXT_MESSAGES = 6;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; url: string; score?: number }>;
}

export interface Source {
  title: string;
  url: string;
  score: number;
}

function buildQueryPlannerPrompt(
  messages: ChatMessage[],
  allowedTopics: string[]
): string {
  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  const lastUserMsg = [...recentMessages].reverse().find((m) => m.role === "user");
  const nowIso = new Date().toISOString();
  const topicsHint =
    allowedTopics.length > 0
      ? `The knowledge base covers: ${allowedTopics.join(", ")}.`
      : "";

  const recentSources = recentMessages
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.sources ?? [])
    .slice(-8);

  const sourcesHint =
    recentSources.length > 0
      ? `Previously used sources (you can reuse these if the user is following up):\n${recentSources
          .map((s) => `- ${s.title} (${s.url})`)
          .join("\n")}`
      : "";

  return `You are a search query planner. Given the conversation below, generate up to ${SEARCH_QUERY_LIMIT} search queries to retrieve relevant context from a knowledge base.

${topicsHint}

Current date/time (UTC): ${nowIso}

Guidelines:
- Return 1 query if that's sufficient. Only return 2 if it genuinely adds coverage.
- Do NOT generate near-duplicates. Each query must target a different angle (e.g. definition vs rules vs eligibility).
- Prefer richer queries with key entities, synonyms, and constraints from the conversation.
- If the user did NOT specify a timeframe, assume they want the latest info and include the current year (${new Date().getUTCFullYear()}) when it helps.
- If the user DID specify a timeframe (e.g. "in 2023", "last season"), respect it and do not force "latest".

${sourcesHint}

Return ONLY a JSON object: { "queries": ["query1", "query2"] }

Conversation:
${recentMessages.map((m) => `${m.role}: ${m.content}`).join("\n")}

Focus on: ${lastUserMsg?.content ?? ""}`;
}

async function planQueries(
  messages: ChatMessage[],
  allowedTopics: string[],
  model: string
): Promise<string[]> {
  try {
    const raw = await chatCompletion(
      model,
      [{ role: "user", content: buildQueryPlannerPrompt(messages, allowedTopics) }],
      0,
      true
    );
    const parsed = JSON.parse(raw) as { queries?: unknown };
    const queries = parsed.queries;
    if (Array.isArray(queries)) {
      const cleaned = queries
        .filter((q): q is string => typeof q === "string")
        .map((q) => q.trim())
        .filter(Boolean);

      // De-dupe (case-insensitive) and keep only a few strong queries.
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const q of cleaned) {
        const key = q.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(q);
        if (unique.length >= SEARCH_QUERY_LIMIT) break;
      }
      return unique;
    }
  } catch {
    // fallback: use last user message
  }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return lastUser ? [lastUser.content] : [];
}

function dedupeChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Set<string>();
  return chunks.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function isDomainGuardPassed(
  chunks: RetrievedChunk[],
  allowedTopics: string[]
): boolean {
  // We still include allowedTopics in the system prompt as a scope instruction,
  // but we do NOT hard-block answering when retrieval is empty.
  // Otherwise the widget becomes a "stuck bot" whenever Pinecone returns no matches.
  void allowedTopics;
  void chunks;
  return true;
}

function buildSystemPrompt(
  site: Pick<Site, "title" | "greeting" | "allowedTopics">,
  contextChunks: RetrievedChunk[]
): string {
  const stripMarkdown = (s: string) =>
    s
      // links: [text](url) -> text (url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      // emphasis/code markers
      .replace(/[*_`]+/g, "")
      // headings
      .replace(/^#{1,6}\s+/gm, "")
      // list markers
      .replace(/^\s*[-*]\s+/gm, "")
      // collapse whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const contextBlock =
    contextChunks.length > 0
      ? contextChunks
          .map(
            (c, i) =>
              `[${i + 1}] ${c.title ? `Title: ${stripMarkdown(c.title)}\n` : ""}${c.url ? `URL: ${c.url}\n` : ""}Content: ${stripMarkdown(c.text)}`
          )
          .join("\n\n")
      : "No relevant context found.";

  const scopeInstruction =
    site.allowedTopics.length > 0
      ? `You ONLY answer questions about: ${site.allowedTopics.join(", ")}. For out-of-scope questions, politely explain what you can help with.`
      : "Answer only based on the provided context. Do not use external knowledge.";

  return `You are a helpful assistant for ${site.title}.

${scopeInstruction}

RULES:
- Base your answers ONLY on the context provided below.
- If the context does not contain enough information, say so honestly.
- Do not fabricate facts, links, or information.
- Write in plain conversational text. Do NOT use Markdown (no headings, bullet lists, bold/italic, or code fences).
- Do NOT cite sources as numbers like [1] or (1).
- When you rely on information from a source, mention the page title with its URL naturally in the sentence (e.g. "According to the rules page..."), as shown below.
- URLs will be rendered as clickable links in the UI. To cite, use this exact format: [[link text|https://example.com/path]]
- Keep responses concise and helpful. End with a short, friendly follow-up question when appropriate.

CONTEXT:
${contextBlock}`;
}

export async function* ragStream(
  site: Site,
  messages: ChatMessage[]
): AsyncGenerator<
  | { type: "token"; content: string }
  | { type: "sources"; sources: Source[] }
  | { type: "out_of_scope"; reason?: string }
  | { type: "debug"; stage: string; data: Record<string, unknown> }
  | { type: "error"; message: string }
> {
  const { indexName, namespace, indexHostUrl } = resolvePineconeTarget(
    site,
    env.PINECONE_INDEX,
    env.PINECONE_INDEX_HOST,
  );
  yield {
    type: "debug",
    stage: "pinecone_target",
    data: { indexName, namespace, indexHostUrl: indexHostUrl ?? null },
  };

  // 1. Plan search queries
  const queries = await planQueries(messages, site.allowedTopics, site.modelId);
  yield {
    type: "debug",
    stage: "plan_queries",
    data: { queries, allowedTopics: site.allowedTopics, modelId: site.modelId },
  };

  if (queries.length === 0) {
    // Fall back to answering without retrieval
    yield {
      type: "debug",
      stage: "out_of_scope",
      data: { reason: "no_queries" },
    };
  }

  // 2. Embed + retrieve
  const allChunks: RetrievedChunk[] = [];
  const retrievalErrors: Array<{
    query: string;
    embeddingDims?: number;
    error: string;
  }> = [];
  for (const query of queries) {
    try {
      const embedding = await embedText(query);
      const chunks = await queryPinecone({
        indexName,
        namespace,
        indexHostUrl,
        queryEmbedding: embedding,
        topK: TOP_K,
        scoreThreshold: SCORE_THRESHOLD,
      });
      allChunks.push(...chunks);
    } catch (e) {
      retrievalErrors.push({
        query,
        // best-effort: embedText may have failed before returning dims
        error: e instanceof Error ? e.message : String(e),
      });
      yield {
        type: "debug",
        stage: "retrieval_error",
        data: {
          query,
          error: e instanceof Error ? e.message : String(e),
        },
      };
    }
  }

  // 3. Deduplicate + sort by score
  const chunks = dedupeChunks(allChunks).sort((a, b) => b.score - a.score).slice(0, 8);
  yield {
    type: "debug",
    stage: "retrieval",
    data: {
      queryCount: queries.length,
      retrievedChunkCount: allChunks.length,
      dedupedChunkCount: chunks.length,
      topK: TOP_K,
      scoreThreshold: SCORE_THRESHOLD,
      retrievalErrorCount: retrievalErrors.length,
    },
  };
  yield {
    type: "debug",
    stage: "retrieved_chunks",
    data: {
      chunks: chunks.map((c) => ({
        id: c.id,
        score: Math.round(c.score * 1000) / 1000,
        title: c.title ?? null,
        url: c.url ?? null,
        textPreview: c.text.slice(0, 800),
      })),
    },
  };

  // 4. Domain guard
  if (!isDomainGuardPassed(chunks, site.allowedTopics)) {
    yield {
      type: "debug",
      stage: "out_of_scope",
      data: { reason: "domain_guard_failed" },
    };
  }

  // 5. Build prompt
  const systemPrompt = buildSystemPrompt(site, chunks);
  yield {
    type: "debug",
    stage: "system_prompt",
    data: {
      systemPrompt,
      hasContext: chunks.length > 0,
      allowedTopics: site.allowedTopics,
    },
  };
  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.slice(-MAX_CONTEXT_MESSAGES).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  // 6. Stream response
  for await (const token of streamChat(site.modelId, chatMessages, site.temperature)) {
    yield { type: "token", content: token };
  }

  // 7. Emit sources
  const sources: Source[] = chunks
    .filter((c) => c.url ?? c.title)
    .slice(0, 5)
    .map((c) => ({
      title: c.title ?? c.url ?? "Source",
      url: c.url ?? "",
      score: Math.round(c.score * 100) / 100,
    }));

  if (sources.length > 0) {
    yield { type: "sources", sources };
  }
}

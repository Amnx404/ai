import { type Site } from "@prisma/client";

import { chatCompletion, embedText, streamChat } from "~/lib/openrouter";
import { getNamespace, queryPinecone, type RetrievedChunk } from "~/lib/pinecone";
import { env } from "~/env.js";

const SEARCH_QUERY_LIMIT = 3;
const TOP_K = 5;
const SCORE_THRESHOLD = 0.5;
const MAX_CONTEXT_MESSAGES = 6;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  const topicsHint =
    allowedTopics.length > 0
      ? `The knowledge base covers: ${allowedTopics.join(", ")}.`
      : "";

  return `You are a search query planner. Given the conversation below, generate up to ${SEARCH_QUERY_LIMIT} concise search queries to retrieve relevant context from a knowledge base.

${topicsHint}

Return ONLY a JSON object: { "queries": ["query1", "query2", ...] }

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
      return queries.filter((q): q is string => typeof q === "string").slice(0, SEARCH_QUERY_LIMIT);
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
  if (allowedTopics.length === 0) return true;
  if (chunks.length === 0) return false;
  return true; // topics filter happens at system prompt level
}

function buildSystemPrompt(
  site: Pick<Site, "title" | "greeting" | "allowedTopics">,
  contextChunks: RetrievedChunk[]
): string {
  const contextBlock =
    contextChunks.length > 0
      ? contextChunks
          .map(
            (c, i) =>
              `[${i + 1}] ${c.title ? `Title: ${c.title}\n` : ""}${c.url ? `URL: ${c.url}\n` : ""}Content: ${c.text}`
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
- At the end of your response, list source numbers you used as [1], [2], etc.
- Keep responses concise and helpful.

CONTEXT:
${contextBlock}`;
}

export async function* ragStream(
  site: Site,
  messages: ChatMessage[]
): AsyncGenerator<
  | { type: "token"; content: string }
  | { type: "sources"; sources: Source[] }
  | { type: "out_of_scope" }
  | { type: "error"; message: string }
> {
  const indexName = site.pineconeIndex ?? env.PINECONE_INDEX;
  const namespace =
    site.pineconeNs ?? getNamespace(site.id, site.liveVersion);

  // 1. Plan search queries
  const queries = await planQueries(messages, site.allowedTopics, site.modelId);

  if (queries.length === 0) {
    yield { type: "out_of_scope" };
    return;
  }

  // 2. Embed + retrieve
  const allChunks: RetrievedChunk[] = [];
  for (const query of queries) {
    try {
      const embedding = await embedText(query);
      const chunks = await queryPinecone({
        indexName,
        namespace,
        queryEmbedding: embedding,
        topK: TOP_K,
        scoreThreshold: SCORE_THRESHOLD,
      });
      allChunks.push(...chunks);
    } catch {
      // continue with other queries
    }
  }

  // 3. Deduplicate + sort by score
  const chunks = dedupeChunks(allChunks).sort((a, b) => b.score - a.score).slice(0, 8);

  // 4. Domain guard
  if (!isDomainGuardPassed(chunks, site.allowedTopics)) {
    yield { type: "out_of_scope" };
    return;
  }

  // 5. Build prompt
  const systemPrompt = buildSystemPrompt(site, chunks);
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

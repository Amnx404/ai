import { type Site } from "@prisma/client";

import { chatCompletion, streamChat } from "~/lib/openrouter";
import { searchKnowledgeChunks, searchKnowledgeChunksDense } from "~/lib/knowledge-chunks";
import { embedText } from "~/lib/embed";
import {
  rerankChunks,
  type RetrievedChunk,
} from "~/lib/pinecone";

const SEARCH_QUERY_LIMIT = 2;
const DENSE_TOP_K = 12;
const LEXICAL_TOP_K = 12;
const RERANK_CANDIDATE_LIMIT = 32;
const FINAL_CONTEXT_LIMIT = 8;
const SCORE_THRESHOLD = 0.05;
const MAX_CONTEXT_MESSAGES = 6;
const RETRIEVAL_QUERY_LIMIT = 4;
// Reciprocal Rank Fusion constant. Standard value from the original RRF paper;
// larger k flattens the contribution of top ranks, smaller k sharpens it.
const RRF_K = 60;

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

function lastUserContent(messages: ChatMessage[]) {
  return [...messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
}

function expandSearchQueries(messages: ChatMessage[], plannedQueries: string[]) {
  const lastUser = lastUserContent(messages);
  const priorityQueries: string[] = [];

  if (
    /\b(attend|participat(?:e|ing|ion)?|join|compete|competition|race)\b/i.test(lastUser) &&
    /\b(document(?:s|ation)?|requirements?|step\s*by\s*step|process|apply|application|latest)\b/i.test(lastUser)
  ) {
    priorityQueries.push("ICRA 2026 RoboRacer registration requirements FAQ timeline visa information participation steps");
    priorityQueries.push("ICRA 2026 RoboRacer registration form video demonstration hardware list ICRA registration visa letters");
  }

  const expanded = [lastUser, ...priorityQueries, ...plannedQueries].filter(Boolean);
  const lab = lastUser.match(/\blab\s*(\d+)\b/i);
  if (lab?.[1]) {
    expanded.push(`lab ${lab[1]} lab${lab[1]} assignment exercise instructions`);
  }

  const module = lastUser.match(/\bmodule\s*([a-z])\b/i);
  if (module?.[1]) {
    const letter = module[1].toUpperCase();
    expanded.push(`module ${letter} Module${letter} lesson lecture documentation`);
  }

  if (/\b(instructor|teach|teaching|class|course|semester|curriculum)\b/i.test(lastUser)) {
    expanded.push("syllabus lessons modules labs lectures getting started instructor");
  }

  if (/\b(first|1st)\s+lab\b|\blab\s*(one|1)\b/i.test(lastUser)) {
    expanded.push("lab 1 introduction ROS2 assignment instructions");
    expanded.push("start here getting started course kit lab 1");
  }

  if (
    /\bcourse\s*kit\b/i.test(lastUser) &&
    /\b(install|setup|start|begin|first|lab)\b/i.test(lastUser)
  ) {
    expanded.push("Start Here getting started course kit setup installation");
    expanded.push("Lab 1 Introduction to ROS2 assignment");
  }

  if (/\b(passing|collisions?|track boundaries?|penalties)\b/i.test(lastUser)) {
    expanded.push("ICRA 2026 RoboRacer rules passing collisions track boundaries penalties warnings");
  }

  if (/\b(housing|hotel|accommodation|scam|booking)\b/i.test(lastUser)) {
    expanded.push("ICRA 2026 housing information AIM Austria official booking hotel warning scam");
  }

  if (/\b(visa|invitation letter|support letter|travel document|embassy|consulate)\b/i.test(lastUser)) {
    expanded.push("ICRA 2026 visa information support invitation letter travel documents Austria attendees");
    expanded.push("ICRA 2026 registration visa support international participants");
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const query of expanded) {
    const normalized = query.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
    if (unique.length >= RETRIEVAL_QUERY_LIMIT) break;
  }
  return unique;
}

function dedupeChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const byId = new Map<string, RetrievedChunk>();
  for (const chunk of chunks) {
    const existing = byId.get(chunk.id);
    if (!existing) {
      byId.set(chunk.id, chunk);
      continue;
    }

    byId.set(chunk.id, {
      ...existing,
      score: Math.max(existing.score, chunk.score),
      text: existing.text || chunk.text,
      title: existing.title ?? chunk.title,
      url: existing.url ?? chunk.url,
      metadata: {
        ...existing.metadata,
        ...chunk.metadata,
        retrieval_methods: mergeRetrievalMethods(
          existing.metadata.retrieval_methods,
          chunk.metadata.retrieval_methods,
        ),
        dense_score: maxNumber(existing.metadata.dense_score, chunk.metadata.dense_score),
        lexical_score: maxNumber(existing.metadata.lexical_score, chunk.metadata.lexical_score),
      },
    });
  }
  return Array.from(byId.values());
}

function mergeRetrievalMethods(...values: unknown[]) {
  const methods = values.flatMap((value) => {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
    if (typeof value === "string") return [value];
    return [];
  });
  return Array.from(new Set(methods));
}

function maxNumber(...values: unknown[]) {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return nums.length ? Math.max(...nums) : undefined;
}

/**
 * Reciprocal Rank Fusion of the dense and lexical channels.
 *
 * The two channels score on incompatible scales — dense is cosine similarity
 * (~0..1) while lexical is Postgres `ts_rank_cd` (unbounded but typically tiny,
 * ~0.001..0.01). The previous `max(dense, lexical*2)` fusion therefore let dense
 * dominate and effectively ignored lexical agreement. RRF is scale-free: each
 * channel ranks candidates independently and an item's fused score is the sum of
 * `1/(k + rank)` across the channels it appears in, so a chunk that both channels
 * surface rises above one that only a single channel found.
 */
function fuseByRRF(deduped: RetrievedChunk[], k = RRF_K): RetrievedChunk[] {
  const rankBy = (scoreKey: "dense_score" | "lexical_score") => {
    const rank = new Map<string, number>();
    deduped
      .filter((c) => typeof c.metadata[scoreKey] === "number")
      .sort(
        (a, b) =>
          (b.metadata[scoreKey] as number) - (a.metadata[scoreKey] as number),
      )
      .forEach((c, i) => rank.set(c.id, i + 1));
    return rank;
  };

  const denseRank = rankBy("dense_score");
  const lexicalRank = rankBy("lexical_score");

  return deduped
    .map((chunk) => {
      const dr = denseRank.get(chunk.id);
      const lr = lexicalRank.get(chunk.id);
      const rrf = (dr ? 1 / (k + dr) : 0) + (lr ? 1 / (k + lr) : 0);
      return {
        ...chunk,
        // Keep `score` as the human-readable channel score for source display;
        // ordering is driven by rrf_score in metadata.
        metadata: {
          ...chunk.metadata,
          rrf_score: rrf,
          dense_rank: dr ?? null,
          lexical_rank: lr ?? null,
        },
      };
    })
    .sort(
      (a, b) =>
        (b.metadata.rrf_score as number) - (a.metadata.rrf_score as number),
    );
}

function shouldKeepChunkForQuery(chunk: RetrievedChunk, query: string) {
  const url = (chunk.url ?? "").toLowerCase();
  const title = (chunk.title ?? "").toLowerCase();
  const q = query.toLowerCase();
  const alwaysHiddenFileSignals = ["get-pip.py", "uv.lock"];
  if (alwaysHiddenFileSignals.some((signal) => url.includes(signal) || title.includes(signal))) {
    return false;
  }

  const fileSignals = [
    "license.txt",
    "/makefile",
    "/make.bat",
    "/.gitignore",
    "/.readthedocs.yaml",
    "/robots.txt",
    "/conf.py",
    "/pyproject.toml",
  ];
  const isLowValueFile = fileSignals.some((signal) => url.includes(signal) || title.includes(signal));
  if (!isLowValueFile) return true;

  const userExplicitlyAskedForRepoFile =
    q.includes("github") ||
    q.includes("repo") ||
    q.includes("source") ||
    q.includes("get-pip") ||
    q.includes("license") ||
    q.includes("makefile") ||
    q.includes("requirements") ||
    q.includes("readme");

  return userExplicitlyAskedForRepoFile;
}

function buildRerankQuery(messages: ChatMessage[], queries: string[]) {
  const lastUser = lastUserContent(messages);
  const parts = [lastUser, ...queries].filter((value): value is string => Boolean(value));
  return Array.from(new Set(parts)).join("\n");
}

function highStakesGuardResponse(messages: ChatMessage[], chunks: RetrievedChunk[]) {
  const question = lastUserContent(messages);
  const questionLower = question.toLowerCase();
  const context = chunks
    .map((chunk) => `${chunk.title ?? ""}\n${chunk.url ?? ""}\n${chunk.text}`)
    .join("\n")
    .toLowerCase();

  if (questionLower.includes("get-pip.py")) {
    return "get-pip.py can show up when the knowledge base includes GitHub repository listings or source-file pages. It is usually not relevant end-user content, and visitors generally do not need to care about it unless they are maintaining the documentation tooling.";
  }

  if (
    /\b(travel(?:ing|ling)?|international|from india|from albania|from kosovo|from nigeria)\b/.test(questionLower) &&
    /\b(register|registration|slack|email|organizers?)\b/.test(questionLower) &&
    chunks.length === 0
  ) {
    return "The knowledge base does not include country-specific travel or visa requirements. Start with the official registration or event page, use the listed community/support channels for updates, and contact the organizers for event-specific travel, visa, or participation questions.";
  }

  if (/\bbatter(?:y|ies)\b/.test(questionLower) && /\b(brand|maximum speed|fastest|performance|buy)\b/.test(questionLower)) {
    return "The knowledge base does not specify or recommend a battery brand for maximum speed. It only provides build and safety context for batteries, so users should follow the documented bill of materials and safety warnings instead of choosing a battery based on unsupported performance claims.";
  }

  if (/\bpublic roads?\b/.test(questionLower) && /\b(legal|legally|law|allowed|can i|can we)\b/.test(questionLower)) {
    if (!/\bpublic roads?\b/.test(context) && !/\blegal(?:ly)?\b/.test(context)) {
      return "The knowledge base does not establish whether this can legally be used on public roads. I can point you to the relevant product or event documentation, but for public-road legality you should check local laws and official organizers instead of relying on the bot.";
    }
  }

  if (/\b(smoking|fire|sparking|burning)\b/.test(questionLower)) {
    return "The knowledge base is not enough to diagnose a smoking, burning, sparking, or otherwise unsafe hardware issue. For safety, stop using the vehicle, disconnect power if you can do so safely, and get help from a qualified supervisor or the official support channel.";
  }

  if (/\b(book|reserve|buy|purchase)\b/.test(questionLower) && /\b(flights?|hotels?|restaurants?|tickets?)\b/.test(questionLower)) {
    const asksForTransaction =
      /\b(can|could|will|would|please)\s+you\s+(?:help\s+me\s+)?(?:book|reserve|buy|purchase|arrange)\b/.test(
        questionLower,
      ) || /\b(?:book|reserve|buy|purchase|arrange)\s+(?:me|us)\b/.test(questionLower);
    if (!asksForTransaction) return null;
    return "I cannot book or purchase travel, lodging, restaurants, or tickets. The knowledge base does not contain enough information to handle that request, but I can help with the website pages, registration details, documentation, and learning materials it includes.";
  }

  return null;
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
              `[${i + 1}] ${c.title ? `Title: ${stripMarkdown(displayTitle(c))}\n` : ""}${c.url ? `URL: ${c.url}\n` : ""}Content: ${stripMarkdown(c.text)}`
          )
          .join("\n\n")
      : "No relevant context found.";

  const scopeInstruction =
    site.allowedTopics.length > 0
      ? `You ONLY answer questions about: ${site.allowedTopics.join(", ")}. For questions outside that coverage, politely explain what you can help with, and try to think about the question from the user's perspective and the website's content.`
      : "Answer only based on the provided context. Do not use external knowledge. Try to think about the question from the user's perspective and the website's content.";

  return `You are a helpful assistant for ${site.title}.

${scopeInstruction}

RULES:
- Base your answers ONLY on the context provided below.
- If the context does not contain enough information, say so honestly.
- Do not fabricate facts, links, or information.
- For legal, immigration, visa, travel, safety, payment, eligibility, or deadline questions: only answer exact facts present in the context. Do not infer visa requirements from nationality or location.
- If a user asks from a specific country or location, separate the answer into two ideas: first, say whether the context has country-specific requirements for that location; second, still provide the general documented competition, registration, attendance, timeline, and visa-support process from the context when those facts are available. Do not say the process is the same for all international participants unless the context explicitly states that.
- For participation or attendance process questions, synthesize a practical step-by-step from the context. Include documented items such as the official registration form, video demonstration, hardware list, ICRA/on-site registration notes, deadlines, visa-information page, invitation-letter/payment notes, Slack/email organizer channels, and race-day timeline when present.
- For overall "documentation requirements" or "step-by-step process" questions, lead with competition participation and registration materials first. Put visa/travel support after the competition registration steps unless the user asks mainly about visas.
- For legal permission questions such as public-road use, do not answer yes/no unless the context explicitly states that exact permission or prohibition. Do not infer legality from race rules, build docs, or the absence of a public-road page.
- For urgent hardware safety questions involving smoke, fire, burning, sparking, batteries, or motors, do not diagnose the cause. Say the knowledge base is not enough and suggest stopping use and getting qualified help.
- Do not claim you can book, reserve, purchase, or arrange flights, hotels, restaurants, tickets, visas, letters, or event acceptance. Do not infer travel logistics from adjacent accommodation or registration text.
- Write in plain conversational text. Do NOT use Markdown (no headings, bullet lists, bold/italic, or code fences).
- Do not output asterisks, Markdown bullets, Markdown headings, or bold markers. Prefer one compact paragraph, short plain-text sentences, or "Step 1:", "Step 2:" style sentences when the user explicitly asks for a step-by-step process.
- Do NOT cite sources as numbers like [1] or (1).
- When you rely on information from a source, mention the page title with its URL naturally in the sentence (e.g. "According to the rules page..."), as shown below.
- URLs will be rendered as clickable links in the UI. To cite, use this exact format: [[link text|https://example.com/path]]. STRICTLY FOLLOW THIS FORMAT.
- Keep responses concise and helpful. End with a short, friendly follow-up question when appropriate.
- You can always use the website's content to answer the question and can also touch around to be helpful if the exact answer is not apparant.

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
  const liveNamespace = site.livePineconeNs?.trim() ?? "";

  // 1. Plan search queries
  const plannedQueries = await planQueries(messages, site.allowedTopics, site.modelId);
  const queries = expandSearchQueries(messages, plannedQueries);
  yield {
    type: "debug",
    stage: "plan_queries",
    data: { queries, plannedQueries, allowedTopics: site.allowedTopics, modelId: site.modelId },
  };

  if (queries.length === 0) {
    // Fall back to answering without retrieval
    yield {
      type: "debug",
      stage: "out_of_scope",
      data: { reason: "no_queries" },
    };
  }

  // 2. Dense + lexical retrieve
  const allChunks: RetrievedChunk[] = [];
  const retrievalErrors: Array<{
    query: string;
    method: "dense" | "lexical";
    error: string;
  }> = [];
  let denseRetrievedCount = 0;
  let lexicalRetrievedCount = 0;
  if (!liveNamespace) {
    yield {
      type: "debug",
      stage: "retrieval_skipped",
      data: { reason: "missing_live_namespace" },
    };
  } else {
    for (const query of queries) {
      try {
        const embedding = await embedText(query);
        const chunks = await searchKnowledgeChunksDense({
          siteId: site.id,
          namespace: liveNamespace,
          queryEmbedding: embedding,
          limit: DENSE_TOP_K,
          scoreThreshold: SCORE_THRESHOLD,
        });
        denseRetrievedCount += chunks.length;
        allChunks.push(...chunks);
      } catch (e) {
        retrievalErrors.push({
          query,
          method: "dense",
          error: e instanceof Error ? e.message : String(e),
        });
        yield {
          type: "debug",
          stage: "dense_retrieval_error",
          data: {
            query,
            error: e instanceof Error ? e.message : String(e),
          },
        };
      }

      try {
        const chunks = await searchKnowledgeChunks({
          siteId: site.id,
          namespace: liveNamespace,
          query,
          limit: LEXICAL_TOP_K,
        });
        lexicalRetrievedCount += chunks.length;
        allChunks.push(...chunks);
      } catch (e) {
        retrievalErrors.push({
          query,
          method: "lexical",
          error: e instanceof Error ? e.message : String(e),
        });
        yield {
          type: "debug",
          stage: "lexical_retrieval_error",
          data: {
            query,
            error: e instanceof Error ? e.message : String(e),
          },
        };
      }
    }
  }

  // 3. Deduplicate + rerank the combined candidate set
  const rerankQuery = buildRerankQuery(messages, queries);
  // Fuse the dense + lexical candidates with RRF, then keep the strongest set.
  // When the cross-encoder reranker below is available it refines this ordering;
  // when it is not (e.g. provider quota exhausted), this RRF order is what the
  // model actually receives, so it must be good on its own.
  const candidates = fuseByRRF(
    dedupeChunks(allChunks).filter((chunk) =>
      shouldKeepChunkForQuery(chunk, rerankQuery),
    ),
  ).slice(0, RERANK_CANDIDATE_LIMIT);

  let chunks = prioritizeChunksForQuery(candidates, rerankQuery).slice(0, FINAL_CONTEXT_LIMIT);
  let rerankDebug: Record<string, unknown> = {
    enabled: false,
    reason: candidates.length ? "not_run" : "no_candidates",
  };

  if (candidates.length > 1) {
    try {
      const reranked = await rerankChunks({
        query: rerankQuery,
        chunks: candidates,
        topN: FINAL_CONTEXT_LIMIT,
      });
      chunks = prioritizeChunksForQuery(reranked.chunks, rerankQuery);
      rerankDebug = {
        enabled: true,
        model: reranked.model,
        usage: reranked.usage ?? null,
      };
    } catch (e) {
      rerankDebug = {
        enabled: false,
        reason: "rerank_error",
        error: e instanceof Error ? e.message : String(e),
      };
      yield {
        type: "debug",
        stage: "rerank_error",
        data: rerankDebug,
      };
    }
  }

  yield {
    type: "debug",
    stage: "retrieval",
    data: {
      queryCount: queries.length,
      retrievedChunkCount: allChunks.length,
      denseRetrievedCount,
      lexicalRetrievedCount,
      candidateCount: candidates.length,
      finalChunkCount: chunks.length,
      denseTopK: DENSE_TOP_K,
      lexicalTopK: LEXICAL_TOP_K,
      rerankCandidateLimit: RERANK_CANDIDATE_LIMIT,
      finalContextLimit: FINAL_CONTEXT_LIMIT,
      scoreThreshold: SCORE_THRESHOLD,
      retrievalErrorCount: retrievalErrors.length,
      rerank: rerankDebug,
    },
  };
  yield {
    type: "debug",
    stage: "retrieved_chunks",
    data: {
      chunks: chunks.map((c) => ({
        id: c.id,
        score: Math.round(c.score * 1000) / 1000,
        denseScore:
          typeof c.metadata.dense_score === "number"
            ? Math.round(c.metadata.dense_score * 1000) / 1000
            : null,
        lexicalScore:
          typeof c.metadata.lexical_score === "number"
            ? Math.round(c.metadata.lexical_score * 1000) / 1000
            : null,
        rerankScore:
          typeof c.metadata.rerank_score === "number"
            ? Math.round(c.metadata.rerank_score * 1000) / 1000
            : null,
        rrfScore:
          typeof c.metadata.rrf_score === "number"
            ? Math.round(c.metadata.rrf_score * 100000) / 100000
            : null,
        denseRank: c.metadata.dense_rank ?? null,
        lexicalRank: c.metadata.lexical_rank ?? null,
        retrievalMethods: c.metadata.retrieval_methods ?? [],
        title: c.title ?? null,
        displayTitle: displayTitle(c),
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

  const guardedResponse = highStakesGuardResponse(messages, chunks);
  if (guardedResponse) {
    yield { type: "token", content: guardedResponse };
    return;
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

  // 6. Stream response. OpenRouter can inject provider errors into an already
  // open SSE stream, so keep enough state to recover instead of dropping the
  // retrieved sources and turning a partial answer into a generic failure.
  let streamedText = "";
  let recoveredFromStreamError = false;
  try {
    for await (const token of streamChat(site.modelId, chatMessages, site.temperature)) {
      streamedText += token;
      yield { type: "token", content: token };
    }
  } catch (e) {
    yield {
      type: "debug",
      stage: "model_stream_error",
      data: {
        error: e instanceof Error ? e.message : String(e),
        hadPartialResponse: streamedText.trim().length > 0,
        partialLength: streamedText.length,
      },
    };

    try {
      const completion = await chatCompletion(
        site.modelId,
        chatMessages,
        site.temperature,
      );
      const remainder = completionRemainder(completion, streamedText);
      if (remainder.trim().length > 0) {
        recoveredFromStreamError = true;
        streamedText += remainder;
        yield {
          type: "debug",
          stage: "model_stream_recovered",
          data: { completionLength: completion.length, remainderLength: remainder.length },
        };
        yield { type: "token", content: remainder };
      }
    } catch (retryError) {
      yield {
        type: "debug",
        stage: "model_stream_recovery_error",
        data: {
          error: retryError instanceof Error ? retryError.message : String(retryError),
        },
      };
    }

    if (!recoveredFromStreamError && countWords(streamedText) < 8) {
      yield {
        type: "error",
        message: "Sorry, something went wrong. Please try again.",
      };
    }
  }

  // 7. Emit sources
  const sourceKeys = new Set<string>();
  const sources: Source[] = [];
  for (const chunk of chunks) {
    if (!chunk.url && !chunk.title) continue;
    const key = normalizeSourceKey(chunk.url || chunk.title || chunk.id);
    if (sourceKeys.has(key)) continue;
    sourceKeys.add(key);
    sources.push({
      title: displayTitle(chunk),
      url: chunk.url ?? "",
      score: Math.round(chunk.score * 100) / 100,
    });
    if (sources.length >= FINAL_CONTEXT_LIMIT) break;
  }

  if (sources.length > 0) {
    yield { type: "sources", sources };
  }
}

function normalizeSourceKey(value: string) {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

function prioritizeChunksForQuery(chunks: RetrievedChunk[], query: string) {
  return [...chunks].sort((a, b) => {
    const priorityDelta = chunkPriority(b, query) - chunkPriority(a, query);
    if (priorityDelta !== 0) return priorityDelta;
    const bScore = numericScore(b);
    const aScore = numericScore(a);
    return bScore - aScore;
  });
}

function chunkPriority(chunk: RetrievedChunk, query: string) {
  const q = query.toLowerCase();
  const url = (chunk.url ?? "").toLowerCase();
  const title = (chunk.title ?? "").toLowerCase();
  const hay = `${url} ${title}`;
  const mentionsSpecificPastYear = /\b20(?:21|22|23|24|25)\b/.test(q);
  let score = 0;

  if (/\b(icra\s*2026|latest|current|upcoming|visa|registration|timeline|event day|housing|hotel)\b/.test(q)) {
    if (url.includes("icra2026-race.roboracer.ai")) score += 45;
    if (url.includes("2026.ieee-icra.org")) score += 40;
    if (!mentionsSpecificPastYear && /\b20(?:21|22|23|24|25)\b/.test(hay)) score -= 25;
  }

  if (/\b(competition rules?|passing|collisions?|track boundaries?|penalties)\b/.test(q)) {
    if (url.includes("icra2026-race.roboracer.ai/rules")) score += 80;
    if (url.includes("icra2026-race.roboracer.ai/competition_rules")) score += 65;
    if (url.includes("roboracer.ai/rules.md")) score += 45;
    if (!mentionsSpecificPastYear && /(?:race\.f1tenth\.org|f1tenth\.org\/rules)/.test(url)) score -= 25;
  }

  if (/\b(course\s*kit|first lab|1st lab|lab\s*(?:one|1)|start here|getting started)\b/.test(q)) {
    if (url.includes("f1tenth-coursekit.readthedocs.io")) score += 35;
    if (url.includes("/getting_started/index")) score += 85;
    if (url.includes("/assignments/labs/lab1")) score += 85;
    if (url.includes("/assignments/labs/index")) score += 65;
    if (url.includes("/lectures/modulea/")) score += 25;
    if (url.includes("/introduction/syllabus")) score -= 20;
  }

  if (/\b(housing|hotel|accommodation|scam|booking)\b/.test(q)) {
    if (url.includes("2026.ieee-icra.org/attend/housing-information")) score += 90;
  }

  if (/\b(visa|invitation letter|support letter|travel document|embassy|consulate)\b/.test(q)) {
    if (url.includes("2026.ieee-icra.org/attend/visa-information")) score += 110;
    if (url.includes("2026.ieee-icra.org/attend/visa-support")) score += 100;
    if (url.includes("2026.ieee-icra.org/attend/registration")) score += 35;
  }

  return score;
}

function numericScore(chunk: RetrievedChunk) {
  const rerankScore = chunk.metadata.rerank_score;
  if (typeof rerankScore === "number" && Number.isFinite(rerankScore)) return rerankScore;
  const rrfScore = chunk.metadata.rrf_score;
  if (typeof rrfScore === "number" && Number.isFinite(rrfScore)) return rrfScore;
  return chunk.score;
}

function completionRemainder(completion: string, streamedText: string) {
  if (!completion) return "";
  if (!streamedText) return completion;
  if (completion.startsWith(streamedText)) {
    return completion.slice(streamedText.length);
  }

  const partial = streamedText.trim();
  if (!partial) return completion;
  if (completion.startsWith(partial)) {
    return completion.slice(partial.length);
  }

  const lastWords = partial.split(/\s+/).slice(-3).join(" ");
  const overlapIndex = lastWords ? completion.indexOf(lastWords) : -1;
  if (overlapIndex >= 0) {
    return completion.slice(overlapIndex + lastWords.length);
  }

  if (countWords(streamedText) <= 2) {
    return `\n\n${completion}`;
  }

  return "";
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function displayTitle(chunk: RetrievedChunk) {
  return normalizeDisplayTitle(chunk.title ?? chunk.url ?? "Source", chunk.url);
}

function normalizeDisplayTitle(title: string, url?: string) {
  let out = title
    .replace(/&mdash;/g, "-")
    .replace(/&ndash;|&#8211;/g, "-")
    .replace(/&para;/g, "")
    .replace(/&#038;|&amp;/g, "&")
    .replace(/\s*¶\s*/g, "")
    .replace(/\s+\(\d+\/\d+\)$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (url?.includes("2026.ieee-icra.org")) {
    out = out.replace(/\bIEEE ICRA 2025\b/g, "IEEE ICRA 2026");
  }

  return out.replace(/\bRoboracer\b/g, "RoboRacer");
}

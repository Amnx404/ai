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
- Route by the user's target before writing queries. Preserve any explicit product, event, year, version, page type, or country/location in the user's wording.
- If the user did NOT specify a timeframe, assume they want the latest info and include the current year (${new Date().getUTCFullYear()}) when it helps.
- If the user DID specify a timeframe (e.g. "in 2023", "last season"), respect it and do not force "latest".
- For "latest/current/upcoming" questions, make the query look for current official pages, not historical pages.
- If "latest/current/upcoming" could refer to multiple current events, versions, or programs, generate one query for the official index/listing page and one query for the user's concrete task.
- For participation, attendance, documentation, or step-by-step questions, split coverage between event/application requirements and practical logistics such as deadlines, FAQ, visa/travel support, and contact/support channels.
- Do not invent website-specific event names or domains that are not present in the conversation, prior sources, or coverage hint.

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
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return [];
  if (!shouldUseQueryPlanner(messages)) return [lastUser.content];

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
  return [lastUser.content];
}

function shouldUseQueryPlanner(messages: ChatMessage[]) {
  const recentMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  const lastUser = [...recentMessages].reverse().find((m) => m.role === "user");
  if (!lastUser) return false;

  const hasAssistantContext = recentMessages.some((m) => m.role === "assistant");
  if (!hasAssistantContext) return false;

  return /\b(that|this|those|it|they|them|there|above|earlier|previous|same|also|what about|how about|which one)\b/i.test(
    lastUser.content,
  );
}

function lastUserContent(messages: ChatMessage[]) {
  return [...messages].reverse().find((m) => m.role === "user")?.content.trim() ?? "";
}

function expandSearchQueries(
  messages: ChatMessage[],
  plannedQueries: string[],
  site: Pick<Site, "title" | "allowedTopics">,
) {
  const lastUser = lastUserContent(messages);
  const siteHint = buildSiteSearchHint(site);
  const currentYearHint = currentYearQueryHint(lastUser);
  const priorityQueries: string[] = [];
  const scoped = (...terms: string[]) =>
    [siteHint, lastUser, currentYearHint, ...terms].filter(Boolean).join(" ");

  if (
    /\b(attend|participat(?:e|ing|ion)?|join|compete|competition|race)\b/i.test(lastUser) &&
    /\b(document(?:s|ation)?|requirements?|step\s*by\s*step|process|apply|application|latest)\b/i.test(lastUser)
  ) {
    priorityQueries.push(
      scoped("latest current official registration application requirements eligibility timeline FAQ participation steps"),
    );
    priorityQueries.push(
      scoped("visa travel support invitation letter attendee documents international participants contact organizers"),
    );
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
    expanded.push(scoped("competition rules passing collisions track boundaries penalties warnings"));
  }

  if (/\b(housing|hotel|accommodation|scam|booking)\b/i.test(lastUser)) {
    expanded.push(scoped("official housing hotel accommodation booking warning scam travel"));
  }

  if (/\b(visa|invitation letter|support letter|travel document|embassy|consulate)\b/i.test(lastUser)) {
    expanded.push(scoped("visa information support invitation letter travel documents embassy consulate attendees"));
    expanded.push(scoped("registration visa support international participants official event"));
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

function buildSiteSearchHint(site: Pick<Site, "title" | "allowedTopics">) {
  return [site.title, ...site.allowedTopics]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function currentYearQueryHint(query: string) {
  if (/\b20\d{2}\b/.test(query)) return "";
  if (
    !/\b(latest|current|upcoming|next|newest|this year|competition|race|event|registration|register|apply|application|rules?|visa|travel|housing|hotel|accommodation)\b/i.test(
      query,
    )
  ) {
    return "";
  }
  return `current latest ${new Date().getUTCFullYear()}`;
}

function quickResponseForMessage(
  messages: ChatMessage[],
  hasKnowledgeBase: boolean,
) {
  const lastUser = lastUserContent(messages);
  const normalized = lastUser
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(hi|hello|hey|yo|sup|what's up|whats up|hey what's up|hey whats up|good morning|good afternoon|good evening)$/.test(normalized)) {
    return "Hey! I can help answer questions about this site.";
  }

  const asksAboutAccess =
    /\b(do you|can you|are you able to|have you)\b.*\b(access|see|read|know|use)\b.*\b(latest|current|live|page|pages|website|site|knowledge)\b/i.test(
      lastUser,
    ) ||
    /\b(latest|current|live)\s+(page|pages|website|site|knowledge base)\b.*\?/i.test(lastUser);

  if (!asksAboutAccess) return null;

  if (!hasKnowledgeBase) {
    return "I do not see a published knowledge base for this widget yet. Add or refresh knowledge first, then I can answer from the indexed pages.";
  }

  return "I can search the site's indexed knowledge base, including pages that have been scraped and published. I do not live-browse the website on every message, so if a page changed after the last knowledge refresh, refresh the knowledge base first.";
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
    (/\b(travel(?:ing|ling)?|international|visa|embassy|consulate)\b/.test(questionLower) ||
      /\bfrom\s+[a-z][a-z .'’-]{1,40}\b/.test(questionLower)) &&
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
- When the context contains several events, years, product versions, or page families, identify the user's target from explicit words first, then latest/current/upcoming intent, then the most relevant official pages. Do not blend facts from a different event/year/version just because they are adjacent in search results.
- Treat source URL/domain/path as authoritative for routing. If a title appears to conflict with the URL/domain/path, keep that source separate from other similarly titled pages.
- If the user's target remains ambiguous after reading the context, say that multiple relevant sources were found, name the options briefly, and ask which one they mean. You may still give only the general steps that are clearly supported across the relevant sources.
- For "latest/current/upcoming" questions, avoid historical pages when current pages are present. If several current pages exist and none is clearly the user's target, do not pick one silently.
- For participation or attendance process questions, synthesize a practical step-by-step from the context. Include documented items such as official registration/application forms, required submissions, eligibility notes, fees/payment notes, deadlines, event or on-site registration notes, visa/travel-support pages, support/community channels, and event-day timeline when present.
- For overall "documentation requirements" or "step-by-step process" questions, lead with competition participation and registration materials first. Put visa/travel support after the competition registration steps unless the user asks mainly about visas.
- For legal permission questions such as public-road use, do not answer yes/no unless the context explicitly states that exact permission or prohibition. Do not infer legality from race rules, build docs, or the absence of a public-road page.
- For urgent hardware safety questions involving smoke, fire, burning, sparking, batteries, or motors, do not diagnose the cause. Say the knowledge base is not enough and suggest stopping use and getting qualified help.
- Do not claim you can book, reserve, purchase, or arrange flights, hotels, restaurants, tickets, visas, letters, or event acceptance. Do not infer travel logistics from adjacent accommodation or registration text.
- Write in plain conversational text. Do NOT use Markdown (no headings, bullet lists, bold/italic, or code fences).
- Do not output asterisks, Markdown bullets, Markdown headings, or bold markers. Prefer one compact paragraph, short plain-text sentences, or "Step 1:", "Step 2:" style sentences when the user explicitly asks for a step-by-step process.
- Do NOT cite sources as numbers like [1] or (1).
- When you rely on information from a source, mention the page title with its URL naturally in the sentence (e.g. "According to the rules page..."), as shown below.
- URLs will be rendered as clickable links in the UI. To cite, use this exact format: [[link text|https://example.com/path]]. STRICTLY FOLLOW THIS FORMAT.
- In citation link text, do not use the pipe character "|". Replace it with a colon or dash, for example [[IEEE ICRA 2026 - Visa Information|https://example.com/path]]. Do not wrap the URL in Markdown brackets.
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
  const quickResponse = quickResponseForMessage(messages, Boolean(liveNamespace));
  if (quickResponse) {
    yield {
      type: "debug",
      stage: "quick_response",
      data: { reason: "small_talk_or_knowledge_access" },
    };
    yield { type: "token", content: quickResponse };
    return;
  }

  // 1. Plan search queries
  const plannedQueries = await planQueries(messages, site.allowedTopics, site.modelId);
  const queries = expandSearchQueries(messages, plannedQueries, site);
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
    const retrievalResults = await Promise.all(
      queries.flatMap((query) => [
        (async (): Promise<{
          query: string;
          method: "dense";
          chunks: RetrievedChunk[];
          error?: string;
        }> => {
          try {
            const embedding = await embedText(query);
            const chunks = await searchKnowledgeChunksDense({
              siteId: site.id,
              namespace: liveNamespace,
              queryEmbedding: embedding,
              limit: DENSE_TOP_K,
              scoreThreshold: SCORE_THRESHOLD,
            });
            return { query, method: "dense", chunks };
          } catch (e) {
            return {
              query,
              method: "dense",
              chunks: [],
              error: e instanceof Error ? e.message : String(e),
            };
          }
        })(),
        (async (): Promise<{
          query: string;
          method: "lexical";
          chunks: RetrievedChunk[];
          error?: string;
        }> => {
          try {
            const chunks = await searchKnowledgeChunks({
              siteId: site.id,
              namespace: liveNamespace,
              query,
              limit: LEXICAL_TOP_K,
            });
            return { query, method: "lexical", chunks };
          } catch (e) {
            return {
              query,
              method: "lexical",
              chunks: [],
              error: e instanceof Error ? e.message : String(e),
            };
          }
        })(),
      ]),
    );

    for (const result of retrievalResults) {
      if (result.error) {
        retrievalErrors.push({
          query: result.query,
          method: result.method,
          error: result.error,
        });
        yield {
          type: "debug",
          stage: `${result.method}_retrieval_error`,
          data: {
            query: result.query,
            error: result.error,
          },
        };
        continue;
      }

      if (result.method === "dense") {
        denseRetrievedCount += result.chunks.length;
      } else {
        lexicalRetrievedCount += result.chunks.length;
      }
      allChunks.push(...result.chunks);
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

  let routed = routeChunksForQuery(prioritizeChunksForQuery(candidates, rerankQuery), rerankQuery);
  let chunks = routed.chunks.slice(0, FINAL_CONTEXT_LIMIT);
  let sourceRoutingDebug = routed.debug;
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
      routed = routeChunksForQuery(prioritizeChunksForQuery(reranked.chunks, rerankQuery), rerankQuery);
      chunks = routed.chunks.slice(0, FINAL_CONTEXT_LIMIT);
      sourceRoutingDebug = routed.debug;
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
      sourceRouting: sourceRoutingDebug,
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

type SourceRoute = {
  key: string;
  label: string;
  family: string;
  year: number;
};

function routeChunksForQuery(chunks: RetrievedChunk[], query: string) {
  const q = query.toLowerCase();
  if (!shouldRouteBySourceFamily(q) || chunks.length < 3) {
    return {
      chunks,
      debug: {
        enabled: false,
        reason: chunks.length < 3 ? "too_few_chunks" : "no_route_intent",
      },
    };
  }

  const groups = new Map<
    string,
    {
      route: SourceRoute;
      chunks: RetrievedChunk[];
      score: number;
    }
  >();

  for (const chunk of chunks) {
    const route = sourceRoute(chunk);
    if (!route) continue;
    const existing =
      groups.get(route.key) ??
      {
        route,
        chunks: [],
        score: routeScore(route, query),
      };
    existing.chunks.push(chunk);
    existing.score += 25 + numericScore(chunk) * 10 + Math.max(0, chunkPriority(chunk, query)) / 10;
    groups.set(route.key, existing);
  }

  const rankedGroups = Array.from(groups.values()).sort((a, b) => b.score - a.score);
  const top = rankedGroups[0];
  const second = rankedGroups[1];
  if (!top || !second) {
    return {
      chunks,
      debug: {
        enabled: false,
        reason: "single_or_no_source_family",
        groups: rankedGroups.map(sourceGroupDebug),
      },
    };
  }

  const explicitFamily = new RegExp(`\\b${escapeRegex(top.route.family)}\\b`, "i").test(query);
  const confident =
    explicitFamily ||
    top.chunks.length >= second.chunks.length + 2 ||
    top.score >= second.score * 1.45;

  if (!confident) {
    return {
      chunks,
      debug: {
        enabled: false,
        reason: "ambiguous_source_family",
        groups: rankedGroups.slice(0, 5).map(sourceGroupDebug),
      },
    };
  }

  const routedChunks = chunks.filter((chunk) => {
    const route = sourceRoute(chunk);
    return !route || route.key === top.route.key;
  });

  if (routedChunks.length < Math.min(2, chunks.length)) {
    return {
      chunks,
      debug: {
        enabled: false,
        reason: "routed_context_too_small",
        selected: sourceGroupDebug(top),
        groups: rankedGroups.slice(0, 5).map(sourceGroupDebug),
      },
    };
  }

  return {
    chunks: routedChunks,
    debug: {
      enabled: true,
      selected: sourceGroupDebug(top),
      removedChunkCount: chunks.length - routedChunks.length,
      groups: rankedGroups.slice(0, 5).map(sourceGroupDebug),
    },
  };
}

function shouldRouteBySourceFamily(query: string) {
  return /\b(latest|current|upcoming|next|newest|this year|attend|participat|join|compete|competition|race|event|registration|register|apply|application|documents?|documentation|requirements?|deadline|timeline|schedule|faq|visa|travel|invitation|support letter|rules?|housing|hotel|accommodation)\b/.test(
    query,
  );
}

function sourceGroupDebug(group: { route: SourceRoute; chunks: RetrievedChunk[]; score: number }) {
  return {
    key: group.route.key,
    label: group.route.label,
    chunkCount: group.chunks.length,
    score: Math.round(group.score * 100) / 100,
  };
}

function routeScore(route: SourceRoute, query: string) {
  const q = query.toLowerCase();
  const currentYear = new Date().getUTCFullYear();
  const queryYears = Array.from(new Set(q.match(/\b20\d{2}\b/g) ?? [])).map(Number);
  const asksForLatest = /\b(latest|current|upcoming|next|newest|this year)\b/.test(q);
  let score = 0;

  if (queryYears.includes(route.year)) score += 80;
  if (asksForLatest && queryYears.length === 0 && route.year === currentYear) score += 35;
  if (asksForLatest && queryYears.length === 0 && route.year < currentYear) score -= 35;
  if (new RegExp(`\\b${escapeRegex(route.family)}\\b`, "i").test(query)) score += 90;

  return score;
}

function sourceRoute(chunk: RetrievedChunk): SourceRoute | null {
  const fromUrl = sourceRouteFromText(sourceRouteUrlText(chunk.url));
  if (fromUrl) return fromUrl;
  return sourceRouteFromText(`${chunk.title ?? ""} ${chunk.text.slice(0, 400)}`);
}

function sourceRouteUrlText(rawUrl: string | undefined) {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl);
    return `${url.hostname} ${url.pathname}`;
  } catch {
    return rawUrl;
  }
}

function sourceRouteFromText(value: string): SourceRoute | null {
  const tokens = value
    .toLowerCase()
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!/^20\d{2}$/.test(token)) continue;
    const year = Number(token);
    const family = nearestRouteFamily(tokens, i);
    if (!family) continue;
    return {
      key: `${family}:${year}`,
      label: `${family.toUpperCase()} ${year}`,
      family,
      year,
    };
  }

  return null;
}

function nearestRouteFamily(tokens: string[], yearIndex: number) {
  const offsets = [-1, 1, -2, 2, -3, 3];
  for (const offset of offsets) {
    const token = tokens[yearIndex + offset];
    if (isRouteFamilyToken(token)) return token;
  }
  return null;
}

function isRouteFamilyToken(token: string | undefined) {
  if (!token || !/^[a-z][a-z0-9]{1,14}$/.test(token)) return false;
  const stopwords = new Set([
    "about",
    "accommodation",
    "ai",
    "application",
    "apply",
    "attend",
    "booking",
    "com",
    "competition",
    "current",
    "deadline",
    "documents",
    "edu",
    "eligibility",
    "en",
    "event",
    "faq",
    "html",
    "http",
    "https",
    "ieee",
    "index",
    "info",
    "latest",
    "net",
    "official",
    "org",
    "participants",
    "race",
    "races",
    "register",
    "registration",
    "requirements",
    "rules",
    "schedule",
    "support",
    "timeline",
    "travel",
    "visa",
    "www",
  ]);
  return !stopwords.has(token);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function chunkPriority(chunk: RetrievedChunk, query: string) {
  const q = query.toLowerCase();
  const url = (chunk.url ?? "").toLowerCase();
  const title = (chunk.title ?? "").toLowerCase();
  const text = chunk.text.toLowerCase().slice(0, 2_000);
  const hay = `${url} ${title}`;
  const bodyHay = `${hay} ${text}`;
  const currentYear = new Date().getUTCFullYear();
  const queryYears = Array.from(new Set(q.match(/\b20\d{2}\b/g) ?? []));
  const asksForLatest = /\b(latest|current|upcoming|next|newest|this year)\b/.test(q);
  const targetYears = queryYears.length > 0 ? queryYears : asksForLatest ? [String(currentYear)] : [];
  let score = 0;

  for (const year of targetYears) {
    if (hay.includes(year)) score += 50;
    else if (bodyHay.includes(year)) score += 15;
  }

  if (asksForLatest && queryYears.length === 0) {
    for (const year of hay.match(/\b20\d{2}\b/g) ?? []) {
      if (Number(year) < currentYear) score -= 20;
    }
  }

  score += keywordOverlapScore(q, hay, 3, 30);

  if (/\b(attend|participat|join|compete|competition|race|event|registration|register|apply|application|documents?|documentation|requirements?|deadline|timeline|schedule|faq)\b/.test(q)) {
    score += facetScore(hay, [
      "registration",
      "register",
      "apply",
      "application",
      "requirements",
      "eligibility",
      "timeline",
      "schedule",
      "deadline",
      "faq",
      "attend",
      "event",
    ], 14);
  }

  if (/\b(competition rules?|rules?|passing|collisions?|track boundaries?|penalties|warnings?)\b/.test(q)) {
    score += facetScore(hay, [
      "rules",
      "competition_rules",
      "competition-rules",
      "passing",
      "collision",
      "boundary",
      "penalty",
      "warning",
    ], 18);
  }

  if (/\b(course\s*kit|first lab|1st lab|lab\s*(?:one|1)|start here|getting started)\b/.test(q)) {
    score += facetScore(hay, [
      "course",
      "coursekit",
      "getting_started",
      "getting-started",
      "start",
      "lab1",
      "lab-1",
      "labs",
      "assignment",
      "module",
    ], 16);
  }

  if (/\b(housing|hotel|accommodation|scam|booking)\b/.test(q)) {
    score += facetScore(hay, [
      "housing",
      "hotel",
      "accommodation",
      "booking",
      "travel",
      "attend",
      "scam",
    ], 18);
  }

  if (/\b(visa|invitation letter|support letter|travel document|embassy|consulate)\b/.test(q)) {
    score += facetScore(hay, [
      "visa",
      "invitation",
      "support",
      "travel",
      "attend",
      "registration",
      "embassy",
      "consulate",
    ], 20);
  }

  return score;
}

function facetScore(haystack: string, terms: string[], weight: number) {
  return terms.reduce((total, term) => (haystack.includes(term) ? total + weight : total), 0);
}

function keywordOverlapScore(query: string, haystack: string, weight: number, cap: number) {
  const stopwords = new Set([
    "about",
    "after",
    "again",
    "could",
    "from",
    "have",
    "help",
    "into",
    "like",
    "need",
    "overall",
    "please",
    "should",
    "that",
    "their",
    "there",
    "this",
    "want",
    "what",
    "when",
    "where",
    "with",
    "would",
  ]);
  const tokens = Array.from(new Set(query.match(/\b[a-z0-9][a-z0-9_-]{3,}\b/g) ?? []))
    .filter((token) => !stopwords.has(token));
  const score = tokens.reduce((total, token) => (haystack.includes(token) ? total + weight : total), 0);
  return Math.min(score, cap);
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

  const urlYear = url?.match(/\b20\d{2}\b/)?.[0];
  const titleYear = out.match(/\b20\d{2}\b/)?.[0];
  if (urlYear && titleYear && urlYear !== titleYear) {
    out = out.replace(titleYear, urlYear);
  }

  return out.replace(/\bRoboracer\b/g, "RoboRacer");
}

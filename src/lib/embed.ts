// OpenRouter embeddings API — perplexity/pplx-embed-v1-0.6b, 1024 dims.
// Same model as the Cloudflare AI fallback so vectors are interchangeable.
// We already have OPENROUTER_API_KEY; no extra credentials needed.
import { env } from "~/env.js";

export const EMBED_DIMS = 1024;
const EMBED_MODEL = "perplexity/pplx-embed-v1-0.6b";
const OPENROUTER_EMBED_URL = "https://openrouter.ai/api/v1/embeddings";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const res = await fetch(OPENROUTER_EMBED_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenRouter embed ${res.status}: ${err}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v ?? [];
}

export async function embedTextsForIngest(texts: string[]): Promise<number[][]> {
  return embedTexts(texts);
}

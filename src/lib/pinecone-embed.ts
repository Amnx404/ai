import { getPinecone } from "~/lib/pinecone";
import { env } from "~/env.js";

// Pinecone index is 1024-dim in this project; use a 1024-d embedding model.
// You can override via env if needed.
const DEFAULT_MODEL = "llama-text-embed-v2";

export async function embedTexts(
  texts: string[],
  inputType: "query" | "passage" = "query",
): Promise<number[][]> {
  const pc = getPinecone();
  const model = env.PINECONE_EMBED_MODEL ?? DEFAULT_MODEL;

  const res = await pc.inference.embed(model, texts, {
    // Pinecone Inference API expects camelCase here.
    inputType,
    truncate: "END",
  });
  // `res.data` is an array of embeddings; each embedding has `values`.
  return res.data.map((e) => (e.values ?? []) as number[]);
}

export async function embedText(text: string): Promise<number[]> {
  const [v] = await embedTexts([text], "query");
  return v ?? [];
}

export async function embedTextsForIngest(texts: string[]): Promise<number[][]> {
  return embedTexts(texts, "passage");
}


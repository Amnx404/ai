import OpenAI from "openai";
import { env } from "~/env.js";

export function getOpenRouterClient() {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": env.NEXTAUTH_URL,
      "X-Title": "ALT EGO",
    },
  });
}

// Embed text using a lightweight model via OpenRouter (text-embedding-ada-002 via openai pass-through)
// For production, you may want to use a dedicated embedding endpoint.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getOpenRouterClient();
  const response = await client.embeddings.create({
    model: "openai/text-embedding-ada-002",
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const embeddings = await embedTexts([text]);
  return embeddings[0]!;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function* streamChat(
  model: string,
  messages: ChatMessage[],
  temperature = 0.3
): AsyncGenerator<string> {
  const client = getOpenRouterClient();
  const stream = await client.chat.completions.create({
    model,
    messages,
    temperature,
    stream: true,
  });

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}

export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  temperature = 0.3,
  jsonMode = false
): Promise<string> {
  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model,
    messages,
    temperature,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  });
  return response.choices[0]?.message?.content ?? "";
}

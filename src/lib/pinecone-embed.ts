// Embedding calls now go through Cloudflare AI (bge-large-en-v1.5, 1024 dims).
// This module keeps the same interface so call sites don't need to change.
export { embedText, embedTexts, embedTextsForIngest } from "~/lib/embed";

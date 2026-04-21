/**
 * Smoke test: run the full RAG pipeline for a site.
 *
 * Usage:
 *   npm run smoke:rag -- <siteId> "your question"
 *
 * Example:
 *   npm run smoke:rag -- cmo7xs6bi0005or8omiw0yzte "What are the rules of ICRA races?"
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const siteId = process.argv[2];
const question = process.argv.slice(3).join(" ").trim();

if (!siteId || !question) {
  console.error(
    'Usage: npm run smoke:rag -- <siteId> "your question"',
  );
  process.exit(1);
}

// Import after env is loaded (env.js reads process.env).
const [{ db }, { ragStream }] = await Promise.all([
  import("../src/server/db"),
  import("../src/lib/rag"),
]);

const site = await db.site.findFirst({
  where: { id: siteId, isActive: true },
});

if (!site) {
  console.error(`Site not found or inactive: ${siteId}`);
  process.exit(1);
}

let answer = "";
let sources: unknown[] | null = null;
const debug: unknown[] = [];

for await (const ev of ragStream(site, [{ role: "user", content: question }])) {
  if (ev.type === "token") {
    answer += ev.content;
  } else if (ev.type === "sources") {
    sources = ev.sources;
  } else if (ev.type === "debug") {
    debug.push(ev);
  }
}

console.log("\n--- Smoke RAG result ---");
console.log(`siteId: ${siteId}`);
console.log(`modelId: ${site.modelId}`);
console.log(`question: ${question}`);
console.log("\nanswer:\n");
console.log(answer || "(empty)");

console.log("\n--- retrieved sources (if any) ---");
console.log(JSON.stringify(sources ?? [], null, 2));

console.log("\n--- debug events ---");
console.log(JSON.stringify(debug, null, 2));

await db.$disconnect().catch(() => {});


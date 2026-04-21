/**
 * Smoke test: can we reach Pinecone for a given index + namespace?
 * Usage: npx tsx scripts/smoke-pinecone.ts [indexName] [namespace]
 * Defaults: roboracer-ai live-v-1
 */
import { Pinecone } from "@pinecone-database/pinecone";
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

const indexName = process.argv[2] ?? "roboracer-ai";
const namespace = process.argv[3] ?? "live-v-1";

loadDotEnv();
const apiKey = process.env.PINECONE_API_KEY;
if (!apiKey) {
  console.error("Missing PINECONE_API_KEY (set in env or .env)");
  process.exit(1);
}
const indexHostUrl = process.env.PINECONE_INDEX_HOST;

const pc = new Pinecone({ apiKey });
const ns = pc.index(indexName, indexHostUrl).namespace(namespace);

try {
  const listed = await ns.listPaginated({ limit: 5 });
  const ids = (listed.vectors ?? []).map((v) => v.id);
  console.log("OK — connected to Pinecone data plane for this target.");
  console.log(`  index:     ${indexName}`);
  console.log(`  host:      ${indexHostUrl ?? "(auto-resolved by SDK)"}`);
  console.log(`  namespace: ${namespace}`);
  console.log(`  sample vector ids (up to 5): ${ids.length ? ids.join(", ") : "(none — namespace empty or no matches)"}`);
} catch (err) {
  console.error("FAIL — could not list vectors in index/namespace.");
  console.error(err);
  process.exit(1);
}

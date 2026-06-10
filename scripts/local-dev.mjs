#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const requestedWebPort = parsePort(process.env.WEB_PORT, 3001);
const scraperHost = process.env.SCRAPER_HOST || "127.0.0.1";
const requestedScraperPort = parsePort(process.env.SCRAPER_PORT, 8787);
const webPort = await findAvailablePort(requestedWebPort);
const scraperPort = await findAvailablePort(requestedScraperPort);
const localAppUrl = `http://localhost:${webPort}`;
const localScraperUrl = `http://localhost:${scraperPort}`;

const baseEnv = {
  ...process.env,
  WEB_PORT: String(webPort),
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || localAppUrl,
  callback_URL: process.env.callback_URL || localAppUrl,
  SCRAPER_PIPELINE_BASE_URL: process.env.SCRAPER_PIPELINE_BASE_URL || localScraperUrl,
  SCRAPER_SCRAPE_PROVIDER: process.env.SCRAPER_SCRAPE_PROVIDER || "cloudflare",
  SCRAPER_HOST: scraperHost,
  SCRAPER_PORT: String(scraperPort),
};

console.log(`[local] web: ${localAppUrl}`);
console.log(`[local] scraper: ${baseEnv.SCRAPER_PIPELINE_BASE_URL}`);

const children = [
  start("web", ["run", "dev:web"], baseEnv),
  start("scraper", ["run", "scraper:dev"], baseEnv),
];

let shuttingDown = false;

for (const child of children) {
  child.proc.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    const reason = signal ? signal : `code ${code ?? 0}`;
    console.log(`[local] ${child.name} exited (${reason}); stopping other services`);
    stopAll();
    process.exit(code ?? 0);
  });
}

process.on("SIGINT", () => {
  shuttingDown = true;
  stopAll();
});

process.on("SIGTERM", () => {
  shuttingDown = true;
  stopAll();
});

function start(name, args, env) {
  const proc = spawn(npmCmd, args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout.on("data", (chunk) => writePrefixed(name, chunk));
  proc.stderr.on("data", (chunk) => writePrefixed(name, chunk));
  return { name, proc };
}

function writePrefixed(name, chunk) {
  for (const line of String(chunk).split(/\r?\n/)) {
    if (!line) continue;
    console.log(`[${name}] ${line}`);
  }
}

function stopAll() {
  for (const child of children) {
    if (child.proc.killed) continue;
    child.proc.kill("SIGTERM");
  }
}

function parsePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 50 && port < 65536; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No available port found starting at ${startPort}`);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

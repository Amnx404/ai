import { Prisma, PrismaClient } from "@prisma/client";

import { loadDotEnv } from "../scraper/load-env.js";

loadDotEnv();

const db = new PrismaClient();

const userEmail =
  argValue("email") ?? process.env.LOCAL_SEED_EMAIL?.trim() ?? "";
const siteName = argValue("name") ?? "RoboRacer Local";
const localPort = process.env.WEB_PORT?.trim() || "3001";

const sourceGroups = [
  {
    id: "roboracer-core",
    label: "RoboRacer core website",
    enabled: true,
    live: false,
    seed_urls: ["https://roboracer.ai/", "http://course.roboracer.ai/"],
    allowed_prefixes: ["https://roboracer.ai/", "http://course.roboracer.ai/"],
    max_depth: 4,
    max_pages: 100,
    refresh_interval_minutes: 10080,
    cloudflare_render_mode: "auto",
    cloudflare_discovery_mode: "crawl",
    cloudflare_per_seed_limit: 100,
    cloudflare_stall_timeout_ms: 60000,
  },
  {
    id: "f1tenth-build-learn-docs",
    label: "F1TENTH build and learn docs",
    enabled: true,
    live: false,
    seed_urls: [
      "https://f1tenth-coursekit.readthedocs.io/en/latest/",
      "https://f1tenth.readthedocs.io/en/foxy_test/",
      "https://ahmadamine998.github.io/ESE6150-Website/",
    ],
    allowed_prefixes: [
      "https://f1tenth-coursekit.readthedocs.io/",
      "https://f1tenth.readthedocs.io/en/foxy_test/",
      "https://ahmadamine998.github.io/ESE6150-Website/",
    ],
    max_depth: 7,
    max_pages: 300,
    refresh_interval_minutes: 10080,
    cloudflare_render_mode: "static",
    cloudflare_discovery_mode: "static",
    cloudflare_per_seed_limit: 100,
    cloudflare_stall_timeout_ms: 60000,
  },
  {
    id: "roboracer-live-events",
    label: "RoboRacer races and live event pages",
    enabled: true,
    live: true,
    seed_urls: [
      "https://autodrive-ecosystem.github.io/",
      "https://icra2026-race.roboracer.ai/registration.html",
      "https://iv2026-race.roboracer.ai/registration.html",
      "https://2026ifac-roboracer.com/en/registration.html",
      "https://events.vtsociety.org/vtc2026-fall/",
      "https://2025.iccas.org/",
      "https://cdc2025-race.roboracer.ai/",
      "https://techfest.org/competitions/Roboracer",
      "https://cdc2024-race.f1tenth.org/",
      "https://bu2024-race.f1tenth.org/",
      "https://korea-race24f1tenth.org/",
      "https://iros2024-race.f1tenth.org/",
      "https://itsc2024-race.f1tenth.org/",
      "https://sm2024-race.f1tenth.org/",
      "https://iv2024-race.f1tenth.org/",
      "https://cpsweek2024-race.f1tenth.org/index.html",
      "https://icra2024-race.f1tenth.org/",
      "https://icra2024-madgames.f1tenth.org/",
      "https://iros2023-race.f1tenth.org/",
      "https://iros2023-madgames.f1tenth.org/",
      "https://korea-race23.f1tenth.org/",
      "https://icra2023-race.f1tenth.org/",
      "https://cps2023-race.f1tenth.org/",
      "https://iv2023-race.f1tenth.org/",
      "https://korea-race.f1tenth.org/",
      "https://germany-race2022.f1tenth.org/",
      "https://icra2022-race.f1tenth.org/",
      "https://www.iros2021.org/",
      "https://linklab-uva.github.io/icra-autonomous-racing/",
    ],
    allowed_prefixes: [
      "https://autodrive-ecosystem.github.io/",
      "https://icra2026-race.roboracer.ai/registration.html",
      "https://iv2026-race.roboracer.ai/registration.html",
      "https://2026ifac-roboracer.com/en/registration.html",
      "https://events.vtsociety.org/vtc2026-fall/",
      "https://2025.iccas.org/",
      "https://cdc2025-race.roboracer.ai/",
      "https://techfest.org/competitions/Roboracer",
      "https://cdc2024-race.f1tenth.org/",
      "https://bu2024-race.f1tenth.org/",
      "https://korea-race24f1tenth.org/",
      "https://iros2024-race.f1tenth.org/",
      "https://itsc2024-race.f1tenth.org/",
      "https://sm2024-race.f1tenth.org/",
      "https://iv2024-race.f1tenth.org/",
      "https://cpsweek2024-race.f1tenth.org/index.html",
      "https://icra2024-race.f1tenth.org/",
      "https://icra2024-madgames.f1tenth.org/",
      "https://iros2023-race.f1tenth.org/",
      "https://iros2023-madgames.f1tenth.org/",
      "https://korea-race23.f1tenth.org/",
      "https://icra2023-race.f1tenth.org/",
      "https://cps2023-race.f1tenth.org/",
      "https://iv2023-race.f1tenth.org/",
      "https://korea-race.f1tenth.org/",
      "https://germany-race2022.f1tenth.org/",
      "https://icra2022-race.f1tenth.org/",
      "https://www.iros2021.org/",
      "https://linklab-uva.github.io/icra-autonomous-racing/",
    ],
    max_depth: 3,
    max_pages: 600,
    refresh_interval_minutes: 1440,
    delay: 7,
    cloudflare_render_mode: "static",
    cloudflare_discovery_mode: "static",
    cloudflare_per_seed_limit: 100,
    cloudflare_stall_timeout_ms: 60000,
  },
];

const scrapeConfig = {
  scrape_provider: "cloudflare",
  cloudflare_render_mode: "auto",
  cloudflare_discovery_mode: "crawl",
  cloudflare_per_seed_limit: 100,
  cloudflare_stall_timeout_ms: 60000,
  source_groups: sourceGroups,
  source_group_mode: "all",
  seed_urls: [
    "https://roboracer.ai/",
    "https://f1tenth-coursekit.readthedocs.io/en/latest/",
    "https://f1tenth.readthedocs.io/en/foxy_test/",
    "https://autodrive-ecosystem.github.io/",
  ],
  allowed_prefixes: [
    "https://roboracer.ai/",
    "https://f1tenth-coursekit.readthedocs.io/",
    "https://f1tenth.readthedocs.io/en/foxy_test/",
    "https://autodrive-ecosystem.github.io/",
  ],
  max_pages: 1000,
  max_depth: 7,
  delay: 0.5,
  parallel_workers: 7,
  respect_allowed_prefixes: true,
  skip_map: false,
  finetune: false,
  url_whitelist_patterns: [
    "^https://roboracer\\.ai/",
    "^http://course\\.roboracer\\.ai/",
    "^https://f1tenth-coursekit\\.readthedocs\\.io/",
    "^https://f1tenth\\.readthedocs\\.io/en/foxy_test/",
    "^https://ahmadamine998\\.github\\.io/ESE6150-Website/",
    "^https://autodrive-ecosystem\\.github\\.io/",
    "^https://(?:icra2026-race|iv2026-race)\\.roboracer\\.ai/",
    "^https://2026ifac-roboracer\\.com/",
    "^https://.*(?:f1tenth|roboracer).*",
  ],
  url_blacklist_patterns: [
    "\\.(png|jpe?g|svg|webp|gif|css|js|ico|pdf|zip|mp4|mp3|woff2?|ttf|eot)(?:$|\\?)",
    "github\\.com/.+/(?:issues|pulls|actions|projects|security|pulse|graphs|network|stargazers|watchers|forks|releases|tags|branches|commits|commit|compare|search|activity|custom-properties|labels|milestones)(?:$|[/?])",
    "mailto:",
    "tel:",
    "javascript:",
  ],
};

try {
  const user = await findOrCreateUser();
  const orgId = await ensureOrg(user.id, user.email ?? (userEmail || "local@roboracer.dev"));

  await db.user.update({
    where: { id: user.id },
    data: { plan: "MAX" },
  });

  const existing = await db.site.findFirst({
    where: { orgId, name: siteName },
  });

  const data = {
    orgId,
    name: siteName,
    primaryUrl: "https://roboracer.ai/",
    primaryColor: "#2563eb",
    title: "RoboRacer",
    greeting: "Ask me about RoboRacer, F1TENTH build docs, CourseKit labs, and races.",
    allowedDomains: [`localhost:${localPort}`, `127.0.0.1:${localPort}`, "roboracer.ai"],
    allowedTopics: ["RoboRacer", "F1TENTH", "autonomous racing", "robotics education"],
    modelId: "google/gemini-2.5-flash",
    temperature: 0.2,
    livePineconePrefix: "roboracer-local-live-v-",
    scrapeConfig: scrapeConfig as Prisma.InputJsonValue,
  };

  const site = existing
    ? await db.site.update({ where: { id: existing.id }, data })
    : await db.site.create({ data });

  console.log(`Seeded local RoboRacer site: ${site.name}`);
  console.log(`Site ID: ${site.id}`);
  console.log(`Open: http://localhost:${localPort}/sites/${site.id}?tab=knowledge`);
} finally {
  await db.$disconnect();
}

async function findOrCreateUser() {
  if (userEmail) {
    return db.user.upsert({
      where: { email: userEmail },
      update: {},
      create: { email: userEmail, emailVerified: new Date() },
    });
  }

  const existing = await db.user.findFirst({ orderBy: { createdAt: "desc" } });
  if (existing) return existing;

  return db.user.create({
    data: {
      email: "local@roboracer.dev",
      emailVerified: new Date(),
    },
  });
}

async function ensureOrg(userId: string, email: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { orgId: true },
  });
  if (user?.orgId) return user.orgId;

  const org = await db.organization.create({
    data: { name: email.split("@")[0] || "Local" },
  });
  await db.user.update({
    where: { id: userId },
    data: { orgId: org.id },
  });
  return org.id;
}

function argValue(name: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  const value = arg?.slice(prefix.length).trim();
  return value || undefined;
}

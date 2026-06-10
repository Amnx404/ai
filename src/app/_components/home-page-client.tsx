"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IBM_Plex_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleDashed,
  DatabaseZap,
  Globe2,
  LifeBuoy,
  LockKeyhole,
  MessageSquareText,
  MonitorCheck,
  PlayCircle,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";

import { BrandLogo } from "~/components/brand-logo";
import { api } from "~/trpc/react";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

const launchSteps = [
  {
    title: "Choose pages",
    body: "Start with the website, then add docs, course pages, GitHub-backed docs, and live page groups.",
    icon: Globe2,
  },
  {
    title: "Add knowledge",
    body: "Read static and dynamic pages, clean the content, and keep the active knowledge current.",
    icon: BookOpenCheck,
  },
  {
    title: "Preview and publish",
    body: "Test answers with citations, approve allowed domains, then install the widget where it belongs.",
    icon: MonitorCheck,
  },
];

const productAreas = [
  {
    title: "Knowledge settings",
    body: "Start pages, allowed link areas, depth, cadence, dynamic rendering, and knowledge groups live in one place.",
    icon: SearchCheck,
  },
  {
    title: "Knowledge index",
    body: "Indexed pages keep page URLs, reading history, and citation details attached.",
    icon: DatabaseZap,
  },
  {
    title: "Answer behavior",
    body: "Tune tone, refusal rules, topic boundaries, citations, reranking, and escalation behavior per widget.",
    icon: MessageSquareText,
  },
  {
    title: "Launch controls",
    body: "A widget cannot go live until knowledge, allowed domains, preview, and active status are lined up.",
    icon: ShieldCheck,
  },
];

const sampleSources = [
  {
    label: "Primary website",
    url: "https://example.com/",
    state: "Seed",
  },
  {
    label: "Help center",
    url: "https://help.example.com/",
    state: "Depth 3",
  },
  {
    label: "Product docs",
    url: "https://docs.example.com/",
    state: "Allowed",
  },
];

const readinessRows = [
  { label: "Preview only", state: "Ready", icon: CheckCircle2 },
  { label: "Knowledge", state: "Needs content", icon: CircleDashed },
  { label: "Allowed domains", state: "2 domains", icon: LockKeyhole },
  { label: "Install snippet", state: "After publishing", icon: PlayCircle },
];

const sourceModes = [
  {
    title: "Static pages",
    body: "Fast fetch for docs, race pages, and server-rendered content.",
    icon: BookOpenCheck,
  },
  {
    title: "Dynamic pages",
    body: "Rendered capture when links or markdown only appear after hydration.",
    icon: PlayCircle,
  },
  {
    title: "Scheduled groups",
    body: "Depth-limited updates for pages that change on a schedule.",
    icon: LifeBuoy,
  },
];

function normalizeHttps(raw: string) {
  const s = raw.trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function deriveSiteNameFromHost(host: string) {
  const clean = host.replace(/^www\./i, "").toLowerCase();
  const parts = clean.split(".").filter(Boolean);
  const core = parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? clean);
  const spaced = core.replace(/[-_]+/g, " ").trim();
  return spaced
    .split(/\s+/)
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : ""))
    .join(" ")
    .slice(0, 100);
}

export function HomePageClient({
  initialAuthenticated,
}: {
  initialAuthenticated: boolean;
}) {
  const router = useRouter();
  const [onboardUrl, setOnboardUrl] = useState("");
  const [onboardError, setOnboardError] = useState("");
  const autoStartOnce = useRef(false);

  const createSite = api.sites.create.useMutation({
    onSuccess: (site) => {
      setOnboardError("");
      setOnboardUrl("");
      sessionStorage.removeItem("ae:onboardUrl");
      router.push(`/sites/${site.id}?view=setup&setup=1&tab=branding`);
      router.refresh();
    },
    onError: (error) => {
      setOnboardError(error.message);
    },
  });

  const startFromUrl = (raw: string) => {
    const normalized = normalizeHttps(raw);
    let parsed: URL;

    try {
      parsed = new URL(normalized);
    } catch {
      setOnboardError("Enter a valid public URL, like docs.example.com.");
      return;
    }

    if (parsed.protocol !== "https:" || !parsed.hostname.includes(".")) {
      setOnboardError("Use a public https URL, like https://docs.example.com.");
      return;
    }

    const primaryUrl = parsed.toString();
    const host = parsed.host;
    const name = deriveSiteNameFromHost(host);
    setOnboardError("");

    if (!initialAuthenticated) {
      sessionStorage.setItem("ae:onboardUrl", primaryUrl);
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent("/?onboard=1")}`);
      return;
    }

    createSite.mutate({
      name,
      primaryUrl,
      allowedDomains: [host],
    });
  };

  useEffect(() => {
    if (autoStartOnce.current) return;
    if (!initialAuthenticated) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (!params.get("onboard")) return;

    const pending = sessionStorage.getItem("ae:onboardUrl") ?? "";
    if (!pending) return;

    autoStartOnce.current = true;
    startFromUrl(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAuthenticated]);

  return (
    <main className={`${GeistSans.variable} ${ibmPlexMono.variable} min-h-screen bg-white text-gray-950`}>
      <header className="border-b border-gray-200 bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-h-10 min-w-0 items-center gap-3 rounded-lg"
          >
            <BrandLogo size="sm" />
            <span className="truncate font-mono text-xs font-bold uppercase tracking-[0.22em] text-gray-950">
              ALT EGO LABS
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/contact"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-950 sm:inline-flex"
            >
              Support
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 sm:px-4"
            >
              {initialAuthenticated ? "Dashboard" : "Sign in"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)] lg:px-8 lg:py-20">
          <div className="flex flex-col justify-center">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Knowledge-backed widgets
              </span>
              <span className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                Static and dynamic pages
              </span>
            </div>

            <h1 className="max-w-4xl text-4xl font-bold tracking-normal text-gray-950 sm:text-5xl lg:text-6xl">
              Website assistants that stay tied to your knowledge.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
              Create one widget per website, choose the pages you trust, review the indexed knowledge, and ship a citation-backed assistant only when it is ready.
            </p>

            <form
              className="mt-8 max-w-2xl rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault();
                startFromUrl(onboardUrl);
              }}
            >
              <label htmlFor="homepage-url" className="mb-2 block text-sm font-semibold text-gray-900">
                Start with a public website URL
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
                  <input
                    id="homepage-url"
                    value={onboardUrl}
                    onChange={(event) => {
                      setOnboardUrl(event.target.value);
                      if (onboardError) setOnboardError("");
                    }}
                    placeholder="https://docs.example.com"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm font-medium text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5"
                    inputMode="url"
                    autoComplete="url"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!onboardUrl.trim() || createSite.isPending}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {createSite.isPending ? "Creating..." : "Create widget"}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {onboardError ? (
                <p className="mt-2 text-sm font-medium text-red-600">{onboardError}</p>
              ) : (
                <p className="mt-2 text-xs font-medium text-gray-500">
                  We create the widget, prefill the first allowed domain, and send you to setup.
                </p>
              )}
            </form>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {launchSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <Icon className="h-5 w-5 text-gray-700" aria-hidden />
                    <h2 className="mt-3 text-sm font-semibold text-gray-950">{step.title}</h2>
                    <p className="mt-1 text-xs leading-5 text-gray-600">{step.body}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-950">Website knowledge setup</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">Example workspace preview</p>
                </div>
                <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  Needs knowledge
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Knowledge groups
                  </h2>
                  <span className="text-xs font-semibold text-gray-500">3 groups</span>
                </div>
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {sampleSources.map((source) => (
                    <div key={source.url} className="grid gap-2 px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-950">{source.label}</p>
                        <p className="truncate text-xs font-medium text-gray-500">{source.url}</p>
                      </div>
                      <span className="w-fit rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                        {source.state}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Launch readiness
                </h2>
                <div className="grid gap-2">
                  {readinessRows.map((row) => {
                    const Icon = row.icon;
                    const isReady = row.state === "Ready" || row.state.includes("domains");
                    return (
                      <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-700">
                          <Icon className={`h-4 w-4 shrink-0 ${isReady ? "text-emerald-600" : "text-amber-600"}`} aria-hidden />
                          <span className="truncate">{row.label}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-gray-500">{row.state}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-gray-600" aria-hidden />
                  <p className="text-sm font-semibold text-gray-950">Answer preview</p>
                </div>
                <div className="space-y-3">
                  <p className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
                    Which setup pages explain the product plans?
                  </p>
                  <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm leading-6 text-blue-950">
                    I found the relevant documentation pages. The answer should cite those pages before the widget goes live.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500">What the console manages</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-950">Clear ownership from page to answer.</h2>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            Open console
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {productAreas.map((area) => {
            const Icon = area.icon;
            return (
              <article key={area.title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold text-gray-950">{area.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{area.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold text-gray-500">Built for messy sites</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-950">Handle static docs and dynamic pages without changing products.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Some pages can be fetched as plain HTML. Others need a rendered browser pass. The setup keeps both modes visible so teams can pick cheaper static reads where they work and dynamic rendering where the page needs it.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {sourceModes.map((mode) => {
              const Icon = mode.icon;
              return (
                <div key={mode.title} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <Icon className="h-5 w-5 text-gray-700" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold text-gray-950">{mode.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-600">{mode.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-gray-500">
              ALT EGO LABS
            </span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-semibold text-gray-600">
            <Link href="/dashboard" className="rounded-lg px-3 py-2 hover:bg-gray-100 hover:text-gray-950">
              Dashboard
            </Link>
            <Link href="/sites" className="rounded-lg px-3 py-2 hover:bg-gray-100 hover:text-gray-950">
              Widgets
            </Link>
            <Link href="/contact" className="rounded-lg px-3 py-2 hover:bg-gray-100 hover:text-gray-950">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

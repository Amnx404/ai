import Link from "next/link";
import { getServerSession } from "next-auth";
import { IBM_Plex_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import {
  ArrowRight,
  Bug,
  CreditCard,
  DatabaseZap,
  ExternalLink,
  LifeBuoy,
  Mail,
  MessageSquareText,
  Send,
} from "lucide-react";

import { BrandLogo } from "~/components/brand-logo";
import { authOptions } from "~/server/auth";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});

const supportTopics = [
  {
    title: "Knowledge setup",
    body: "Allowed link areas, dynamic pages, knowledge groups, update cadence, or pages that render but do not store cleanly.",
    icon: DatabaseZap,
  },
  {
    title: "Widget behavior",
    body: "Preview mode, allowed domains, answer quality, citations, escalation copy, or install snippet issues.",
    icon: MessageSquareText,
  },
  {
    title: "Billing and access",
    body: "Beta limits, active widget capacity, production setup, or moving from local testing to a hosted launch.",
    icon: CreditCard,
  },
  {
    title: "Bug reports",
    body: "Broken states, confusing UI, auth issues, page-reading failures, or mismatches between indexed pages and answers.",
    icon: Bug,
  },
];

export default async function PublicContactPage() {
  const session = await getServerSession(authOptions);
  const consoleLabel = session?.user ? "Dashboard" : "Sign in";
  const consoleHref = session?.user ? "/dashboard" : "/auth/signin?callbackUrl=%2Fdashboard";
  const email = "hello@altegolabs.com";
  const subject = "ALT EGO LABS - Support request";
  const body = [
    "Hi ALT EGO team,",
    "",
    "Website URL:",
    "What I expected:",
    "What happened:",
    "Relevant reading run, page URL, or widget key:",
    "",
    "Thanks!",
  ].join("\n");

  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <main className={`${GeistSans.variable} ${ibmPlexMono.variable} min-h-screen bg-white text-gray-950`}>
      <header className="border-b border-gray-200 bg-white">
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
          <Link
            href={consoleHref}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 sm:px-4"
          >
            {consoleLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </header>

      <section className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1fr] lg:px-8 lg:py-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
              Product support
            </span>
            <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-normal text-gray-950 sm:text-5xl">
              Get help with knowledge setup, answer quality, or widget launch.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600">
              Send the website URL and the exact point where the flow got confusing. The more specific the page, reading run, or widget state, the faster we can reproduce it.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={mailto}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
              >
                <Mail className="h-4 w-4" aria-hidden />
                Email support
              </a>
              <a
                href={gmail}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm transition-colors hover:bg-gray-50"
              >
                <Send className="h-4 w-4" aria-hidden />
                Open Gmail
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-950">Include this if you have it</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                "Website or docs URL",
                "Widget key or reading run ID",
                "Problem page that failed",
                "Question the widget answered poorly",
                "Expected answer or source",
                "Browser/device if it is visual",
              ].map((item) => (
                <div key={item} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
              For launch issues, mention whether the widget is in Preview only, Ready draft, or Live widget mode.
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-500">Common requests</p>
          <h2 className="mt-2 text-2xl font-bold text-gray-950">Route the issue to the right part of the product.</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {supportTopics.map((topic) => {
            const Icon = topic.icon;
            return (
              <article key={topic.title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold text-gray-950">{topic.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{topic.body}</p>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href={consoleHref}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            {consoleLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/sites"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            Widgets
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </main>
  );
}

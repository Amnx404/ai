import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MailCheck,
  RefreshCw,
  Terminal,
} from "lucide-react";

import { BrandLogo } from "~/components/brand-logo";

export default function VerifyPage() {
  const isLocalDev = process.env.NODE_ENV === "development";
  const headline = isLocalDev ? "Check the app terminal." : "Check your email.";
  const intro = isLocalDev
    ? "Use the newest [DEV] magic link printed by the app server and open it in this browser. If this is your first time, your workspace is created after the link succeeds."
    : "Use the newest email from Alt Ego Labs and open the sign-in link in this browser. If this is your first time, your workspace is created after the link succeeds.";
  const steps = [
    {
      title: isLocalDev ? "Find the newest dev link" : "Open the newest email",
      body: isLocalDev
        ? "Search the terminal running the app on port 3002 for [DEV] Magic link."
        : "Older magic links stop working after a newer one is sent.",
      icon: isLocalDev ? Terminal : MailCheck,
    },
    {
      title: "Use it within 24 hours",
      body: "Expired links are rejected so your account stays protected.",
      icon: Clock3,
    },
    {
      title: "Continue automatically",
      body: "After sign-in, you continue back to the setup or dashboard flow.",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
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
            href="/contact"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            Support
          </Link>
        </div>
      </header>

      <main className="border-b border-gray-200 bg-gray-50">
        <div className="mx-auto grid max-w-4xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1fr] lg:px-8 lg:py-16">
          <section>
            <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
              <MailCheck className="h-3.5 w-3.5" aria-hidden />
              {isLocalDev ? "Magic link printed" : "Magic link sent"}
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-normal text-gray-950 sm:text-5xl">
              {headline}
            </h1>
            <p className="mt-4 text-base leading-7 text-gray-600">{intro}</p>
            {isLocalDev ? (
              <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-950">
                <div className="flex gap-3">
                  <Terminal className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <p>
                    In local dev, Resend is bypassed. Copy the full URL from the
                    newest{" "}
                    <code className="font-mono font-semibold">
                      [DEV] Magic link
                    </code>{" "}
                    log line.
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3">
              {steps.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-gray-700 ring-1 ring-gray-200">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-gray-950">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-gray-600">
                        {item.body}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid gap-2">
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Send a fresh link
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to home
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

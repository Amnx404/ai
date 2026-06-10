"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Globe2,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { BrandLogo } from "~/components/brand-logo";

type AuthErrorState = {
  title: string;
  body: string;
  actionLabel: string;
};

function safeCallbackUrl(value: string | null) {
  if (!value) return "/dashboard";
  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const url = new URL(value);
    if (
      typeof window !== "undefined" &&
      url.origin === window.location.origin
    ) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // ignore
  }

  return "/dashboard";
}

function authErrorState(error: string | null): AuthErrorState | null {
  if (!error) return null;
  if (error === "undefined") return null;
  if (error === "Verification") {
    return {
      title: "Sign-in link expired",
      body: "That magic link is invalid or has expired. Send yourself a fresh one and use the newest email from Alt Ego Labs.",
      actionLabel: "Send a fresh link",
    };
  }
  if (error === "EmailSignin") {
    return {
      title: "Could not send email",
      body: "We could not send the sign-in email. Check the address and try again.",
      actionLabel: "Try again",
    };
  }
  if (error === "AccessDenied") {
    return {
      title: "Access denied",
      body: "Access was denied for this sign-in attempt.",
      actionLabel: "Try again",
    };
  }
  return {
    title: "Sign-in failed",
    body: "Something went wrong with sign-in. Send yourself a fresh magic link.",
    actionLabel: "Try again",
  };
}

function isOnboardingCallback(callbackUrl: string) {
  try {
    const url = new URL(callbackUrl, "https://app.local");
    return url.searchParams.has("onboard");
  } catch {
    return callbackUrl.includes("onboard=1");
  }
}

function hostFromUrl(value: string) {
  if (!value) return "";
  try {
    return new URL(value).host.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInShell />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInShell({
  children,
  isLocalDev = false,
}: {
  children?: React.ReactNode;
  isLocalDev?: boolean;
}) {
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
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.7fr)] lg:gap-8 lg:px-8 lg:py-16">
          <section className="flex flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Email-only access
            </span>
            <h1 className="mt-5 max-w-2xl text-3xl font-bold tracking-normal text-gray-950 sm:text-5xl">
              Sign in with a secure magic link.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base sm:leading-7">
              {isLocalDev
                ? "No password setup required. Enter your email, copy the newest [DEV] Magic link from the app terminal, and we will create your workspace automatically if it is your first time here."
                : "No password setup required. Enter your email, open the newest message from Alt Ego Labs, and we will create your workspace automatically if it is your first time here."}
            </p>

            <div className="mt-8 hidden gap-3 sm:grid sm:grid-cols-3">
              {[
                {
                  title: isLocalDev ? "One terminal link" : "One email",
                  body: isLocalDev
                    ? "The newest [DEV] Magic link is printed by the app server."
                    : "The sign-in link expires after 24 hours.",
                  icon: Mail,
                },
                {
                  title: "Workspace ready",
                  body: "New users get an org as soon as they sign in.",
                  icon: Globe2,
                },
                {
                  title: "Safe callback",
                  body: "You return to the setup page you started from.",
                  icon: ShieldCheck,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <Icon className="h-5 w-5 text-gray-700" aria-hidden />
                    <p className="mt-3 text-sm font-semibold text-gray-950">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-600">
                      {item.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-950">
                Continue to console
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Use the same email whenever you return.
              </p>
            </div>
            {children}
            <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600">
              New here? Sending a link is enough. Your workspace is created on
              first successful sign-in.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function SignInForm() {
  const isLocalDev = process.env.NODE_ENV === "development";
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(
    () => safeCallbackUrl(searchParams.get("callbackUrl")),
    [searchParams],
  );
  const initialError = useMemo(
    () => authErrorState(searchParams.get("error")),
    [searchParams],
  );
  const isOnboarding = useMemo(
    () => isOnboardingCallback(callbackUrl),
    [callbackUrl],
  );
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<AuthErrorState | null>(initialError);
  const [pendingOnboardUrl, setPendingOnboardUrl] = useState("");
  const pendingHost = useMemo(
    () => hostFromUrl(pendingOnboardUrl),
    [pendingOnboardUrl],
  );

  useEffect(() => {
    if (!isOnboarding) return;
    setPendingOnboardUrl(sessionStorage.getItem("ae:onboardUrl") ?? "");
  }, [isOnboarding]);

  async function sendMagicLink(rawEmail: string) {
    const normalizedEmail = rawEmail.trim().toLowerCase();
    if (!normalizedEmail) return;
    setLoading(true);
    setError(null);
    const result = await signIn("email", {
      email: normalizedEmail,
      callbackUrl,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError({
        title: "Could not send email",
        body: "We could not send the sign-in email. Check the address and try again.",
        actionLabel: "Try again",
      });
      return;
    }
    setEmail(normalizedEmail);
    setSent(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await sendMagicLink(email);
  }

  return (
    <SignInShell isLocalDev={isLocalDev}>
      {isOnboarding ? (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-left">
          <div className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-blue-700 ring-1 ring-blue-100">
              <Globe2 className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-blue-950">
                Widget setup will continue after sign-in
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-900/80">
                We will create a widget for{" "}
                <strong className="font-semibold text-blue-950">
                  {pendingHost || "the website you entered"}
                </strong>{" "}
                and open setup after the magic link succeeds.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {["Email link", "Create widget", "Open setup"].map(
              (step, index) => (
                <div
                  key={step}
                  className="rounded-lg border border-blue-100 bg-white px-2.5 py-2 text-xs font-semibold text-blue-950"
                >
                  <span className="mr-1 text-blue-500">{index + 1}.</span>
                  {step}
                </div>
              ),
            )}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700">
            <Mail className="h-4 w-4" aria-hidden />
          </div>
          <p className="mt-3 font-semibold text-red-800">{error.title}</p>
          <p className="mt-1 text-sm leading-6 text-red-700">{error.body}</p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setError(null)}
              className="inline-flex items-center justify-center rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              {error.actionLabel}
            </button>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Contact support
            </Link>
          </div>
        </div>
      ) : sent ? (
        <div className="text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-green-200 bg-green-50 text-green-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </div>
          <p className="mt-3 font-semibold text-green-800">
            {isLocalDev ? "Check the app terminal" : "Check your email"}
          </p>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            {isLocalDev ? (
              <>
                We printed a magic link for{" "}
                <strong className="font-semibold text-gray-900">{email}</strong>
                . It expires in 24 hours.
              </>
            ) : (
              <>
                We sent a magic link to{" "}
                <strong className="font-semibold text-gray-900">{email}</strong>
                . It expires in 24 hours.
              </>
            )}
          </p>
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs leading-5 text-gray-600">
            {isLocalDev
              ? isOnboarding
                ? "Copy the newest [DEV] magic link from the terminal running the app on port 3002 and open it in this browser. Setup will continue automatically."
                : "Copy the newest [DEV] magic link from the terminal running the app on port 3002 and open it in this browser."
              : isOnboarding
                ? "Open the newest email from Alt Ego Labs. Setup will continue automatically after the browser signs you in."
                : "Open the newest email from Alt Ego Labs, then return here after the browser signs you in."}
          </div>
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => void sendMagicLink(email)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              {loading ? "Sending..." : "Resend link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setError(null);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Use a different email
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="signin-email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email address
            </label>
            <input
              id="signin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-900/10"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-950 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {loading ? "Sending..." : "Send magic link"}
            {!loading ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
          </button>
          {isLocalDev ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
              <div className="flex gap-2">
                <Terminal className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  Local dev prints the magic link in the app terminal instead of
                  sending email. Look for{" "}
                  <code className="font-mono font-semibold">
                    [DEV] Magic link
                  </code>
                  .
                </p>
              </div>
            </div>
          ) : null}
        </form>
      )}
    </SignInShell>
  );
}

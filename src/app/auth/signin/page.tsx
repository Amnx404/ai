"use client";

import { signIn } from "next-auth/react";
import { type FormEvent, useState } from "react";

import { BrandLogo } from "~/components/brand-logo";

type Step = "email" | "code";

function getSafeCallbackUrl() {
  const fallback = "/dashboard";
  const raw = new URLSearchParams(window.location.search).get("callbackUrl");
  if (!raw) return fallback;

  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return fallback;
  }
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    setLoading(false);

    if (!response.ok) {
      setError(
        payload?.error ??
          "We could not send the sign-in code. If you are the admin, check Resend and server logs.",
      );
      return;
    }

    setCode("");
    setStep("code");
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }

    setLoading(true);
    setError(null);

    const callbackUrl = getSafeCallbackUrl();
    const result = await signIn("otp", {
      email,
      code: cleanCode,
      callbackUrl,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("That code is invalid or expired. Request a new code and try again.");
      return;
    }

    window.location.assign(result?.url ?? callbackUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <BrandLogo size="md" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign in to Alt Ego</h1>
          <p className="mt-1 text-sm text-gray-500">
            {step === "email"
              ? "We'll send a 6-digit code to your email"
              : `Enter the code sent to ${email}`}
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="font-medium text-red-800">Something went wrong</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
          </div>
        ) : null}

        {step === "email" ? (
          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Verification code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify and sign in"}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
                className="font-medium text-gray-500 hover:text-gray-800"
              >
                Change email
              </button>
              <button
                type="button"
                onClick={() => void requestCode()}
                disabled={loading}
                className="font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60"
              >
                Resend code
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

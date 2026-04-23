"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { BrandLogo } from "~/components/brand-logo";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    const result = await signIn("email", {
      email,
      callbackUrl: "/dashboard",
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError(
        "We could not send the sign-in email. If you are the admin, check Resend (API key and verified sender domain) and server logs.",
      );
      return;
    }
    setSent(true);
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
            We&apos;ll send a magic link to your email
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
            <p className="font-medium text-red-800">Something went wrong</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="mt-4 text-sm font-medium text-red-800 underline"
            >
              Try again
            </button>
          </div>
        ) : sent ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
            <p className="font-medium text-green-800">Check your email!</p>
            <p className="mt-1 text-sm text-green-600">
              We sent a magic link to <strong>{email}</strong>. Click it to sign
              in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

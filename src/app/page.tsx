import Link from "next/link";
import Script from "next/script";
import { IBM_Plex_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { RotatingWords } from "./_components/rotating-words";
import { BrandLogo } from "~/components/brand-logo";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ibm-plex-mono",
});

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const fonts = `${GeistSans.variable} ${ibmPlexMono.variable}`;

  return (
    <main
      className={`${fonts} min-h-screen bg-black antialiased selection:bg-blue-600/25 selection:text-blue-400`}
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif", color: "#B8B8B8" }}
    >
      {/* ── Nav ── */}
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-8 py-9"
        style={{ animation: "ae-fade .6s .1s both" }}
      >
        <div className="flex items-center gap-3">
          <BrandLogo size="md" className="block" />
          <span
            className="uppercase text-white"
            style={{
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.35em",
            }}
          >
            ALT EGO LABS
          </span>
        </div>
        <Link
          href="/auth/signin"
          className="uppercase transition-colors hover:text-white"
          style={{
            fontFamily: "var(--font-ibm-plex-mono), monospace",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: "#FFFFFF",
          }}
        >
          Sign In
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-8 pb-24 pt-16">
        <h1
          className="max-w-4xl text-white"
          style={{
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            fontSize: "clamp(40px, 6.4vw, 76px)",
            fontWeight: 800,
            lineHeight: 0.98,
            letterSpacing: "-0.8px",
            animation: "ae-slide .7s .3s both",
          }}
        >
          <span style={{ color: "#fff" }}>GIVE</span>{" "}
          <span style={{ color: "#666" }}>your</span>
          <br />
          <span style={{ color: "#fff" }}>
            <RotatingWords
              words={["portfolio", "shop", "website", "product", "company"]}
              className="text-white"
            />
          </span>
          <br />
          <span style={{ color: "#666" }}>an</span>{" "}
          <span style={{ color: "#3A7BFF" }}>EGO</span>.
          <br />
          <span style={{ color: "#AFAFAF" }}>A layer of answers</span>{" "}
          <span style={{ color: "#fff" }}>that speaks with its own personality.</span>
        </h1>

        <p
          className="mt-9 max-w-xl"
          style={{
            fontSize: 17,
            lineHeight: 1.75,
            color: "#C6C6C6",
            animation: "ae-slide .7s .45s both",
          }}
        >
          Give your visitors a place to ask questions and get confident answers, grounded in your own
          pages with sources they can click.
        </p>

        <div
          className="mt-12 flex items-center gap-5"
          style={{ animation: "ae-slide .7s .55s both" }}
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-white text-black transition-transform hover:-translate-y-px active:translate-y-0"
            style={{
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              padding: "16px 32px",
              borderRadius: 2,
            }}
          >
            Get started →
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        className="mx-auto grid max-w-6xl grid-cols-1 md:grid-cols-2"
        style={{ borderTop: "1px solid #111" }}
      >
        {[
          {
            num: "01 — Knowledge",
            title: "Make your site\nremember",
            body: "Turn your pages into a living knowledge base. When you update your site, your Ego updates too — so answers stay grounded in what you actually publish.",
          },
          {
            num: "02 — Answers",
            title: "Cited responses\nfrom your pages",
            body: "Your Ego Layer answers customer questions using your content and shows sources inline, so users can verify every claim and jump to the original page.",
          },
        ].map((f, i) => (
          <div
            key={i}
            className="group relative overflow-hidden transition-colors"
            style={{
              padding: "72px 48px",
              borderRight: i === 0 ? "1px solid #111" : undefined,
            }}
          >
            {/* Hover tint */}
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: "rgba(0,87,255,0.06)" }}
            />

            <p
              className="mb-7 uppercase"
              style={{
                fontFamily: "var(--font-ibm-plex-mono), monospace",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.3em",
                color: "#3A7BFF",
              }}
            >
              {f.num}
            </p>
            <h2
              className="mb-5 whitespace-pre-line text-white"
              style={{
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                fontSize: 40,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: "-0.4px",
              }}
            >
              {f.title}
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.8, color: "#BEBEBE", maxWidth: 420 }}>
              {f.body}
            </p>
          </div>
        ))}
      </section>

      {/* ── Statement ── */}
      <section
        className="px-8 py-24"
        style={{ borderTop: "1px solid #111", borderBottom: "1px solid #111" }}
      >
        <div className="mx-auto max-w-6xl">
          <p
            className="mb-8 uppercase"
            style={{
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.3em",
              color: "#3A7BFF",
            }}
          >
            Why it matters
          </p>
          <blockquote
            style={{
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              fontSize: "clamp(28px, 3.6vw, 44px)",
              fontWeight: 700,
              color: "#AFAFAF",
              lineHeight: 1.1,
              maxWidth: 900,
            }}
          >
            In the legacy web era, brands focused on being{" "}
            <strong style={{ color: "#fff", fontWeight: 900 }}>indexed.</strong>{" "}
            In the AI era, brands are being{" "}
            <strong style={{ color: "#fff", fontWeight: 900 }}>
              synthesized.
            </strong>{" "}
            If your brand doesn&apos;t have an ego, the AI will invent one for you.
          </blockquote>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="mx-auto max-w-6xl px-8 py-12"
        style={{ borderTop: "1px solid #111" }}
      >
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <BrandLogo size="sm" className="block" />
            <div>
              <p
                className="uppercase text-white"
                style={{
                  fontFamily: "var(--font-ibm-plex-mono), monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.28em",
                }}
              >
                © 2026 ALT EGO LABS
              </p>
              <p className="mt-2 max-w-sm text-sm" style={{ color: "#BEBEBE" }}>
                A quiet layer of answers, trained on what you publish. Made with love in SF ❤️.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-1 sm:text-right">
            {[
              { label: "Pricing", href: "/subscription" },
              { label: "Feedback", href: "/contact" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="uppercase transition-colors hover:text-white"
                style={{
                  fontFamily: "var(--font-ibm-plex-mono), monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  color: "#A3A3A3",
                }}
              >
                {l.label}
              </Link>
            ))}
            <a
              href="mailto:hello@altegolabs.com"
              className="col-span-2 uppercase transition-colors hover:text-white sm:col-span-1"
              style={{
                fontFamily: "var(--font-ibm-plex-mono), monospace",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: "#A3A3A3",
              }}
            >
              hello@altegolabs.com
            </a>
          </div>
        </div>
      </footer>

      {/* ── Keyframes (scoped to this page) ── */}
      <style>{`
        @keyframes ae-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ae-slide { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <Script
        id="chat-widget-config"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: 'window.ChatWidget = { siteId: "cmobwwqxn00l7ry1ysx2iyo9u" };',
        }}
      />
      <Script src="https://altegolabs.com/widget.js" strategy="afterInteractive" />
    </main>
  );
}


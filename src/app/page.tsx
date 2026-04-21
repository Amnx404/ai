import Link from "next/link";
import { Barlow_Condensed, IBM_Plex_Mono, Barlow } from "next/font/google";

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-barlow-condensed",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ibm-plex-mono",
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-barlow",
});

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo = ({ size = "md" }: { size?: "sm" | "md" }) => {
  const w = size === "sm" ? 28 : 52;
  const h = size === "sm" ? 18 : 34;
  return (
    <svg
      viewBox="0 0 48 32"
      fill="none"
      style={{ width: w, height: h, display: "block" }}
    >
      {/* Outline bar — same width as solid so visual weight matches */}
      <rect
        x="0"
        y="0"
        width="15"
        height="32"
        fill="none"
        stroke="#0057FF"
        strokeWidth="2"
      />
      {/* Solid bar */}
      <rect x="22" y="0" width="15" height="32" fill="#0057FF" />
    </svg>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const fonts = `${barlowCondensed.variable} ${ibmPlexMono.variable} ${barlow.variable}`;

  return (
    <main
      className={`${fonts} min-h-screen bg-black antialiased selection:bg-blue-600/25 selection:text-blue-400`}
      style={{ fontFamily: "var(--font-barlow), sans-serif", color: "#999" }}
    >
      {/* ── Nav ── */}
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-8 py-9"
        style={{ animation: "ae-fade .6s .1s both" }}
      >
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <span
            className="uppercase text-white"
            style={{
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.35em",
            }}
          >
            Alt Ego Labs
          </span>
        </div>
        <Link
          href="/auth/signin"
          className="uppercase transition-colors hover:text-white"
          style={{
            fontFamily: "var(--font-ibm-plex-mono), monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.25em",
            color: "#666",
          }}
        >
          Sign In
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-8 pb-32 pt-20">
        <p
          className="mb-7 uppercase"
          style={{
            fontFamily: "var(--font-barlow-condensed), sans-serif",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.5em",
            color: "#3A7BFF",
            animation: "ae-slide .6s .2s both",
          }}
        >
          The AI Already Has a Take on Your Brand
        </p>

        <h1
          className="max-w-4xl text-white"
          style={{
            fontFamily: "var(--font-barlow-condensed), sans-serif",
            fontSize: "clamp(52px, 8vw, 96px)",
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: "-0.5px",
            animation: "ae-slide .7s .3s both",
          }}
        >
          Personal apps
          <br />
          have memory.
          <br />
          <span style={{ color: "#3A7BFF" }}>
            Brands need
            <br />
            an Ego.
          </span>
        </h1>

        <p
          className="mt-9 max-w-xl"
          style={{
            fontSize: 17,
            lineHeight: 1.75,
            color: "#888",
            animation: "ae-slide .7s .45s both",
          }}
        >
          In an era where LLMs synthesize your reputation on the fly,
          &ldquo;visibility&rdquo; is no longer enough. Alter Ego Labs anchors a
          definitive brand identity across the AI landscape.
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
            Start Building →
          </Link>
          <Link
            href="/docs"
            className="uppercase transition-colors hover:text-white"
            style={{
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "#555",
            }}
          >
            View Docs
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
            num: "01 — Internal",
            title: "Brand Voice\nAgent",
            body: "The source-of-truth for your domain. A drop-in AI presence that speaks with your specific narrative, citing only your verified content — zero drift, zero hallucination.",
          },
          {
            num: "02 — External",
            title: "Reputation\nAudit",
            body: "Audit how the world's leading models perceive your brand. Identify where your ego is being diluted and how the machine-world ranks your products against competitors.",
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
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.35em",
                color: "#3A7BFF",
              }}
            >
              {f.num}
            </p>
            <h2
              className="mb-5 whitespace-pre-line text-white"
              style={{
                fontFamily: "var(--font-barlow-condensed), sans-serif",
                fontSize: 40,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: "0.02em",
              }}
            >
              {f.title}
            </h2>
            <p
              style={{ fontSize: 16, lineHeight: 1.8, color: "#777", maxWidth: 400 }}
            >
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
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.35em",
              color: "#555",
            }}
          >
            The Core Philosophy
          </p>
          <blockquote
            style={{
              fontFamily: "var(--font-barlow-condensed), sans-serif",
              fontSize: "clamp(32px, 4vw, 52px)",
              fontWeight: 700,
              color: "#555",
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
        className="mx-auto flex max-w-6xl items-center justify-between px-8 py-10"
        style={{ borderTop: "1px solid #111" }}
      >
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span
            className="uppercase"
            style={{
              fontFamily: "var(--font-ibm-plex-mono), monospace",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "#444",
            }}
          >
            © 2026 Alt Ego Labs
          </span>
        </div>
        <div className="flex gap-8">
          {["Twitter", "Privacy", "Documentation"].map((l) => (
            <a
              key={l}
              href="#"
              className="uppercase transition-colors hover:text-white"
              style={{
                fontFamily: "var(--font-ibm-plex-mono), monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: "#444",
              }}
            >
              {l}
            </a>
          ))}
        </div>
      </footer>

      {/* ── Keyframes (scoped to this page) ── */}
      <style>{`
        @keyframes ae-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ae-slide { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </main>
  );
}


import Script from "next/script";

import { env } from "~/env.js";

function safeOrigin(input: string | undefined) {
  if (!input) return null;
  try {
    return new URL(input).origin;
  } catch {
    return null;
  }
}

export default async function WidgetDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; url?: string }>;
}) {
  const { siteId, url } = await searchParams;
  const origin = safeOrigin(url) ?? "https://example.com";
  const faviconUrl = `${origin}/favicon.ico`;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={faviconUrl}
            alt=""
            className="h-6 w-6 rounded-md border border-gray-200 bg-white"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold">Widget demo</div>
            <div className="truncate text-xs text-gray-500">
              Mock page for <span className="font-mono">{origin}</span>
            </div>
          </div>
          <div className="ml-auto text-xs text-gray-500">
            siteId: <span className="font-mono">{siteId ?? "(missing)"}</span>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold">Example marketing page</h1>
            <p className="mt-2 text-sm text-gray-600">
              This is a lightweight mock so you can see how the widget looks on a
              “real” site. The launcher icon uses the site’s configured logo (or
              falls back to this page’s favicon).
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {["Features", "Pricing", "Docs", "FAQ"].map((t) => (
                <div
                  key={t}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                >
                  <div className="text-sm font-semibold">{t}</div>
                  <div className="mt-1 text-xs text-gray-600">
                    Placeholder section for layout realism.
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold">Embed settings</div>
          <div className="mt-2 space-y-2 text-xs text-gray-600">
            <div>
              <span className="font-medium">App URL:</span>{" "}
              <span className="font-mono">{env.NEXTAUTH_URL}</span>
            </div>
            <div>
              <span className="font-medium">Widget script:</span>{" "}
              <span className="font-mono">{`${env.NEXTAUTH_URL}/widget.js`}</span>
            </div>
            <div>
              <span className="font-medium">Primary URL:</span>{" "}
              <span className="font-mono">{origin}</span>
            </div>
          </div>
        </div>
      </div>

      {siteId ? (
        <>
          <Script
            id="widget-demo-config"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.ChatWidget = { siteId: ${JSON.stringify(
                siteId,
              )}, apiBase: ${JSON.stringify(env.NEXTAUTH_URL)}, pageIconUrl: ${JSON.stringify(
                faviconUrl,
              )} };`,
            }}
          />
          <Script src={`${env.NEXTAUTH_URL}/widget.js`} strategy="afterInteractive" />
        </>
      ) : null}
    </div>
  );
}


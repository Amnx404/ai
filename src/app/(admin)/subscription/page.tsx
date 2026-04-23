export default function SubscriptionPage() {
  const to = "hello@altegolabs.com";
  const subject = "ALT EGO — Beta access";
  const body =
    "Hi ALT EGO team,\n\nI'd like beta access.\n\nWebsite:\nUse case:\nApprox. pages to scrape:\n\nThanks!";
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    body,
  )}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    to,
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-10 shadow-sm">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(17,24,39,0.06),transparent_55%)]" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-emerald-200/40 blur-3xl" />

      <div className="relative">
        <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
          Subscription
        </div>

        <h1 className="mt-4 text-2xl font-semibold text-gray-900">
          Plans & billing
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-600">
          Usage-based plans, higher scrape limits, and advanced monitoring are on the way.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { title: "Free", desc: "Basic scraping + standard widget." },
            { title: "Pro", desc: "Better models + higher scrape coverage." },
            { title: "Scale", desc: "Multi-site ops + priority pipeline." },
          ].map((card) => (
            <div
              key={card.title}
              className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5"
            >
              <p className="text-sm font-semibold text-gray-900">{card.title}</p>
              <p className="mt-1 text-xs text-gray-600">{card.desc}</p>
              <div className="mt-4 h-9 rounded-xl bg-gray-100" />
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Coming soon</p>
              <p className="mt-1 text-xs text-gray-600">
                Subscription plans aren’t live yet. During beta, email me and I’ll review your request.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <a
                href={mailto}
                className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
              >
                {to}
              </a>
              <a
                href={gmail}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
              >
                Open Gmail draft
              </a>
            </div>
          </div>
          <p className="mt-3 text-[11px] font-medium text-gray-500">
            I’ll unlock Pro features for free during beta.
          </p>
        </div>
      </div>
    </div>
  );
}


export default function ContactPage() {
  const email = "hello@altegolabs.com";
  const subject = "ALT EGO — Feedback / feature request";
  const body =
    "Hi ALT EGO team,\n\nHere’s my feedback / feature request:\n\n- What I was trying to do:\n- What happened:\n- What I expected:\n- Feature request (if any):\n- Site ID (if relevant):\n\nThanks!";

  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    body,
  )}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    email,
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
        Contact
      </div>

      <h1 className="mt-4 text-2xl font-semibold text-gray-900">
        Feedback / feature request
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">
        Beta is hands-on right now. Send feedback or feature requests and I’ll review them.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
        <a
          href={mailto}
          className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
        >
          {email}
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

      <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-sm font-semibold text-gray-900">What to include</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>What you were trying to do</li>
          <li>What broke / felt confusing</li>
          <li>Which site it happened on (Site ID)</li>
          <li>Any screenshots / screen recording if possible</li>
        </ul>
      </div>
    </div>
  );
}


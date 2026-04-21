"use client";

import { useEffect, useState } from "react";

export function EmbedSnippet({ siteId }: { siteId: string }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const snippet = origin
    ? `<script>
  window.ChatWidget = { siteId: "${siteId}" };
</script>
<script async src="${origin}/widget.js"></script>`
    : "Loading…";

  function copy() {
    void navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Embed snippet</h3>
          <p className="text-sm text-gray-500">
            Paste this before the{" "}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
              &lt;/body&gt;
            </code>{" "}
            tag on your site.
          </p>
        </div>
        <button
          onClick={copy}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs text-green-300 leading-relaxed">
        <code>{snippet}</code>
      </pre>
    </div>
  );
}

import React from "react";

interface Source {
  title: string;
  url: string;
  score: number;
}

function shortSourceLabel(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  const parts = t.split("|").map((p) => p.trim()).filter(Boolean);
  const base = (parts[0] ?? t) || "Source";
  return base.length > 32 ? `${base.slice(0, 29)}…` : base;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function LinkifiedText({
  content,
  sources,
  className,
}: {
  content: string;
  sources?: Source[];
  className?: string;
}) {
  // We'll use a token-based approach similar to the widget but for React elements.
  // 1. Identify all links (markdown, custom, raw URLs, and sources).
  // 2. Split the text into segments.

  const tokens: { id: string; element: React.ReactNode }[] = [];
  const tokenPrefix = `__LINK_${Math.random().toString(36).slice(2)}_`;

  const addToken = (element: React.ReactNode) => {
    const id = `${tokenPrefix}${tokens.length}__`;
    tokens.push({ id, element });
    return id;
  };

  let text = content;

  // 0a) Standard markdown link: [label](https://example.com/path)
  text = text.replace(
    /\[([^\]]{1,120})\]\(((?:https?):\/\/[^\s<>"')]{1,2048})\)/g,
    (_m, rawLabel, rawUrl) => {
      const label = String(rawLabel).trim();
      const url = String(rawUrl).trim();
      if (!label || !url) return "";
      return addToken(
        <a
          key={tokens.length}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 underline hover:text-indigo-800"
        >
          {label}
        </a>
      );
    }
  );

  // 0b) Custom link markup: [[label|https://example.com/path]]
  text = text.replace(
    /\[\[([^\]|]{1,120})\|((?:https?):\/\/[^\s<>"']{1,2048})\]\]/g,
    (_m, rawLabel, rawUrl) => {
      const label = String(rawLabel).trim();
      const url = String(rawUrl).trim();
      if (!label || !url) return "";
      return addToken(
        <a
          key={tokens.length}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 underline hover:text-indigo-800"
        >
          {label}
        </a>
      );
    }
  );

  // 1) Auto-link raw URLs
  text = text.replace(/\bhttps?:\/\/[^\s<>"')]+/gi, (raw) => {
    return addToken(
      <a
        key={tokens.length}
        href={raw}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 underline hover:text-indigo-800"
      >
        {raw}
      </a>
    );
  });

  // 2) Source linking
  if (sources?.length) {
    for (const s of sources.slice(0, 5)) {
      if (!s?.url) continue;
      const rawTitle = (s.title || "").trim();
      const mainTitle = (rawTitle.split("|")[0] ?? rawTitle).trim();
      const shortLabel = shortSourceLabel(rawTitle || s.url || "Source");

      const candidates = Array.from(
        new Set(
          [mainTitle, rawTitle, shortLabel].map((t) => t.trim()).filter(Boolean)
        )
      );

      for (const c of candidates) {
        const re = new RegExp(`\\b${escapeRegExp(c)}\\b`, "i");
        if (re.test(text)) {
          text = text.replace(
            re,
            addToken(
              <a
                key={tokens.length}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 underline hover:text-indigo-800 font-semibold"
              >
                {c}
              </a>
            )
          );
          break;
        }
      }
    }
  }

  // 3) Split text by tokens and render
  const parts = text.split(new RegExp(`(${tokenPrefix}\\d+__)`, "g"));

  return (
    <p className={className}>
      {parts.map((part, i) => {
        const token = tokens.find((t) => t.id === part);
        if (token) {
          return <React.Fragment key={i}>{token.element}</React.Fragment>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </p>
  );
}

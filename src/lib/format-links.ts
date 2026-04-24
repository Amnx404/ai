export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function shortSourceLabel(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  const parts = t.split("|").map((p) => p.trim()).filter(Boolean);
  const base = (parts[0] ?? t) || "Source";
  return base.length > 32 ? `${base.slice(0, 29)}…` : base;
}

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function linkSourcesInText(
  plainText: string,
  sources: Array<{ title: string; url: string; score?: number }> | undefined
): string {
  const tokens: string[] = [];
  const tokenPrefix = `__LINK_${Math.random().toString(36).slice(2)}_`;

  const addToken = (html: string) => {
    const id = `${tokenPrefix}${tokens.length}__`;
    tokens.push(html);
    return id;
  };

  let text = plainText;

  // 0a) Standard markdown link: [label](https://example.com/path)
  text = text.replace(
    /\[([^\]]{1,120})\]\(((?:https?):\/\/[^\s<>"')]{1,2048})\)/g,
    (_m, rawLabel: string, rawUrl: string) => {
      const label = String(rawLabel).trim();
      const url = String(rawUrl).trim();
      if (!label || !url) return "";
      return addToken(
        `<a class="font-semibold text-indigo-600 hover:underline" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
      );
    }
  );

  // 0b) Custom link markup: [[label|https://example.com/path]]
  text = text.replace(
    /\[\[([^\]|]{1,120})\|((?:https?):\/\/[^\s<>"']{1,2048})\]\]/g,
    (_m, rawLabel: string, rawUrl: string) => {
      const label = String(rawLabel).trim();
      const url = String(rawUrl).trim();
      if (!label || !url) return "";
      return addToken(
        `<a class="font-semibold text-indigo-600 hover:underline" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
      );
    }
  );

  // 1) Auto-link any raw http(s) URLs that appear in the text.
  text = text.replace(
    /\bhttps?:\/\/[^\s<>"')]+/gi,
    (raw) =>
      addToken(
        `<a class="font-semibold text-indigo-600 hover:underline" href="${escapeHtml(raw)}" target="_blank" rel="noopener">${escapeHtml(raw)}</a>`
      )
  );

  if (sources?.length) {
    // Link up to 5 sources that were actually mentioned (server filters).
    for (const s of sources.slice(0, 5)) {
      if (!s?.url) continue;
      const rawTitle = (s.title || "").trim();
      const mainTitle = (rawTitle.split("|")[0] ?? rawTitle).trim();
      const shortLabel = shortSourceLabel(rawTitle || s.url || "Source");

      const candidates = Array.from(
        new Set([mainTitle, rawTitle, shortLabel].map((t) => t.trim()).filter(Boolean))
      );

      // Replace the first occurrence of the *best* candidate, case-insensitive.
      let replaced = false;
      for (const c of candidates) {
        const re = new RegExp(`\\b${escapeRegExp(c)}\\b`, "i");
        if (!re.test(text)) continue;
        text = text.replace(
          re,
          addToken(
            `<a class="font-semibold text-indigo-600 hover:underline" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(c)}</a>`
          )
        );
        replaced = true;
        break;
      }
    }
  }

  // 3) Escape the remaining plain text (which now contains safe __LINK_...__ tokens)
  let html = escapeHtml(text);

  // 4) Restore the tokens with actual HTML
  for (let i = 0; i < tokens.length; i++) {
    html = html.replace(`${tokenPrefix}${i}__`, tokens[i]);
  }

  return html;
}

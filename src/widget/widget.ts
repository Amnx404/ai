import { getStyles } from "./styles";

interface WidgetConfig {
  id: string;
  isActive?: boolean;
  primaryColor: string;
  title: string;
  greeting: string;
  primaryUrl?: string;
  logoUrl?: string | null;
  allowedTopics: string[];
  appUrl?: string;
  preview?: boolean;
  readiness?: {
    hasWebsite?: boolean;
    hasAllowedDomains?: boolean;
    hasKnowledgeBase?: boolean;
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; url: string; score: number }>;
  ts: number;
}

interface ChatWidgetGlobal {
  siteId: string;
  apiBase?: string;
  pageIconUrl?: string;
  preview?: boolean;
}

declare global {
  interface Window {
    ChatWidget?: ChatWidgetGlobal;
  }
}

const SESSION_KEY = "rr_chat_session";
const MESSAGES_KEY = "rr_chat_messages";

function getBaseUrl(siteId: string): string {
  const scripts = document.querySelectorAll<HTMLScriptElement>("script[src*='widget.js']");
  for (const script of scripts) {
    try {
      const url = new URL(script.src);
      return url.origin;
    } catch { /* continue */ }
  }
  return window.ChatWidget?.apiBase ?? "";
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortSourceLabel(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  const parts = t.split("|").map((p) => p.trim()).filter(Boolean);
  const base = (parts[0] ?? t) || "Source";
  return base.length > 32 ? `${base.slice(0, 29)}…` : base;
}

function sourceFallbackLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    const page = path.split("/").filter(Boolean).pop();
    return page
      ? `${parsed.hostname.replace(/^www\./, "")}/${page}`
      : parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

function uniqueSources(
  sources: Array<{ title: string; url: string; score: number }> | undefined
): Array<{ title: string; url: string; score: number }> {
  const seen = new Set<string>();
  const unique: Array<{ title: string; url: string; score: number }> = [];
  for (const source of sources ?? []) {
    const url = source?.url?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    unique.push(source);
  }
  return unique.slice(0, 5);
}

function renderSourceList(
  sources: Array<{ title: string; url: string; score: number }> | undefined
): string {
  const items = uniqueSources(sources);
  if (!items.length) return "";

  return `
    <div class="source-list" aria-label="Pages cited">
      <div class="source-list-title">Pages cited</div>
      <div class="source-list-links">
        ${items
          .map((source) => {
            const label = source.title?.trim()
              ? shortSourceLabel(source.title)
              : sourceFallbackLabel(source.url);
            return `<a class="source-chip" href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function launcherLabel(title: string | undefined): string {
  const cleanTitle = (title ?? "").trim().replace(/\s+/g, " ");
  if (!cleanTitle) return "Ask";
  return cleanTitle.length > 18 ? "Ask" : `Ask ${cleanTitle}`;
}

function cleanPromptTopic(topic: string): string {
  return topic.trim().replace(/\s+/g, " ").replace(/[?.!]+$/g, "");
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function linkSourcesInText(
  plainText: string,
  sources: Array<{ title: string; url: string; score: number }> | undefined
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
        `<a class="intext-source" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
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
        `<a class="intext-source" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`
      );
    }
  );

  // 1) Auto-link any raw http(s) URLs that appear in the text.
  text = text.replace(
    /\bhttps?:\/\/[^\s<>"')]+/gi,
    (raw) =>
      addToken(
        `<a class="intext-source" href="${escapeHtml(raw)}" target="_blank" rel="noopener">${escapeHtml(raw)}</a>`
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
            `<a class="intext-source" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(c)}</a>`
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

export class ChatWidget {
  private shadow: ShadowRoot;
  private host: HTMLElement;
  private config: WidgetConfig | null = null;
  private messages: Message[] = [];
  private siteId: string;
  private baseUrl: string;
  private previewMode: boolean;
  private sessionId: string | null = null;
  private token: string | null = null;
  private sessionError: string | null = null;
  private isOpen = false;
  private isStreaming = false;

  constructor(siteId: string) {
    this.siteId = siteId;
    this.baseUrl = getBaseUrl(siteId);
    this.previewMode = window.ChatWidget?.preview === true;

    this.host = document.createElement("div");
    this.host.id = "rr-chat-widget";
    this.host.style.cssText = "position:fixed;z-index:999999;";
    document.body.appendChild(this.host);

    this.shadow = this.host.attachShadow({ mode: "open" });
    void this.init();
  }

  private async init() {
    try {
      const params = new URLSearchParams({ siteId: this.siteId });
      if (this.previewMode) params.set("preview", "1");
      const res = await fetch(`${this.baseUrl}/api/v1/widget-config?${params.toString()}`);
      if (!res.ok) {
        // Disabled, deleted, or disallowed embeds should leave no visible UI.
        this.host.remove();
        return;
      }
      this.config = (await res.json()) as WidgetConfig;
    } catch {
      this.config = {
        id: this.siteId,
        primaryColor: "#6366f1",
        title: "Alt",
        greeting: "Hi! How can I help you today?",
        allowedTopics: [],
        preview: this.previewMode,
      };
    }

    // If the host was removed (disabled site), stop initialization.
    if (!this.host.isConnected) return;

    // Restore session
    const savedSession =
      sessionStorage.getItem(this.storageKey(SESSION_KEY)) ??
      (!this.previewMode ? sessionStorage.getItem(`${SESSION_KEY}:${this.siteId}`) : null);
    if (savedSession) {
      try {
        const { sessionId, token } = JSON.parse(savedSession) as { sessionId: string; token: string };
        this.sessionId = sessionId;
        this.token = token;
      } catch { /* ignore */ }
    }

    const savedMessages =
      sessionStorage.getItem(this.storageKey(MESSAGES_KEY)) ??
      (!this.previewMode ? sessionStorage.getItem(`${MESSAGES_KEY}:${this.siteId}`) : null);
    if (savedMessages) {
      try {
        this.messages = JSON.parse(savedMessages) as Message[];
      } catch { /* ignore */ }
    }

    this.render();
    this.attachListeners();
  }

  private storageKey(base: string) {
    return `${base}:${this.siteId}:${this.previewMode ? "preview" : "live"}`;
  }

  private isPreviewOnly() {
    return this.config?.preview === true && this.config.isActive === false;
  }

  private previewBlockedCopy() {
    const readiness = this.config?.readiness;
    if (!readiness?.hasWebsite) {
      return {
        label: "Website needed",
        body: "Set the website URL in setup before this widget can be published.",
        placeholder: "Set website URL to test answers",
      };
    }
    if (!readiness?.hasAllowedDomains) {
      return {
        label: "Allowed domains needed",
        body: "Add the website domain in setup before this widget can be published.",
        placeholder: "Add allowed domain to test answers",
      };
    }
    if (!readiness?.hasKnowledgeBase) {
      return {
        label: "Knowledge needed",
        body: "Add knowledge in setup before this widget can answer questions.",
        placeholder: "Add knowledge to test answers",
      };
    }
    return {
      label: "Draft preview",
      body: "The widget is ready. Publish it from setup to enable live answer testing.",
      placeholder: "Publish widget to test answers",
    };
  }

  private saveSession() {
    if (this.sessionId && this.token) {
      sessionStorage.setItem(
        this.storageKey(SESSION_KEY),
        JSON.stringify({ sessionId: this.sessionId, token: this.token })
      );
    }
    sessionStorage.setItem(
      this.storageKey(MESSAGES_KEY),
      JSON.stringify(this.messages)
    );
  }

  private render() {
    const color = this.config?.primaryColor ?? "#6366f1";
    const launcherIcon =
      this.config?.logoUrl ?? window.ChatWidget?.pageIconUrl ?? null;
    const title = this.config?.title ?? "Alt";
    const isPreviewOnly = this.isPreviewOnly();
    const previewBlockedCopy = this.previewBlockedCopy();
    const statusText = isPreviewOnly ? "Preview only" : this.config?.preview ? "Preview" : "Online";
    const launcherText = isPreviewOnly ? "Preview widget" : launcherLabel(title);
    const nudgeText = isPreviewOnly ? "Preview widget" : "Ask a question";
    const inputPlaceholder = isPreviewOnly
      ? previewBlockedCopy.placeholder
      : "Ask a question";
    this.shadow.innerHTML = `
      <style>${getStyles(color)}</style>

      <div id="nudge">
        <div class="nudge-text">${escapeHtml(nudgeText)}</div>
        <button id="close-nudge" aria-label="Close nudge">&times;</button>
      </div>

      <button id="launcher" aria-label="Open chat" title="Open chat">
        <span class="launcher-face">
          ${
            launcherIcon
              ? `<img class="launcher-logo" alt="" src="${escapeHtml(launcherIcon)}" onerror="this.remove()" />`
              : `<svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
                </svg>`
          }
        </span>
        <span class="launcher-text">${escapeHtml(launcherText)}</span>
        <svg class="icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

      <div id="panel" role="dialog" aria-label="Chat window">
        <div id="header">
          <div id="header-avatar">
            <svg class="header-default-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
            </svg>
            ${
              this.config?.logoUrl
                ? `<img alt="Logo" src="${escapeHtml(this.config.logoUrl)}" onerror="this.remove()" />`
                : ""
            }
          </div>
          <div id="header-info">
            <div id="header-title">${escapeHtml(title)}</div>
            <div id="header-status">
              <span id="status-dot" class="${isPreviewOnly ? "muted" : ""}"></span>
              <span>${statusText}</span>
            </div>
          </div>
          <button id="reset-btn" aria-label="Reset chat" title="Reset chat">
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
          </button>
          <button id="close-btn" aria-label="Close chat">
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        ${
          isPreviewOnly
            ? `<div id="mode-banner"><strong>${escapeHtml(previewBlockedCopy.label)}</strong><span> ${escapeHtml(previewBlockedCopy.body)}</span></div>`
            : ""
        }

        <div id="messages" aria-live="polite" aria-atomic="false">
          ${this.renderGreeting()}
          ${this.renderStarterPrompts()}
          ${this.messages.map((m) => this.renderMessage(m)).join("")}
        </div>

        <div id="input-area">
          <textarea
            id="input"
            placeholder="${escapeHtml(inputPlaceholder)}"
            rows="1"
            aria-label="Message input"
            ${isPreviewOnly ? "disabled" : ""}
          ></textarea>
          <button id="send-btn" aria-label="Send message" ${isPreviewOnly ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <div id="powered-by">
          <a href="${escapeHtml(this.config?.appUrl ?? this.baseUrl)}" target="_blank" rel="noopener">
            Powered by Alt Ego Labs
          </a>
        </div>
      </div>
    `;
  }

  private renderGreeting(): string {
    if (!this.config?.greeting || this.messages.length > 0) return "";
    return `<div id="greeting">${escapeHtml(this.config.greeting)}</div>`;
  }

  private starterPrompts(): string[] {
    const topicPrompts = (this.config?.allowedTopics ?? [])
      .map(cleanPromptTopic)
      .filter(Boolean)
      .slice(0, 3)
      .map((topic) => `What should I know about ${topic}?`);
    const fallback = [
      "What can you help me with?",
      "What are the most important details?",
      "Where should I get started?",
    ];

    return Array.from(new Set([...topicPrompts, ...fallback])).slice(0, 3);
  }

  private renderStarterPrompts(): string {
    if (this.messages.length > 0 || this.isPreviewOnly()) return "";
    const prompts = this.starterPrompts();
    if (!prompts.length) return "";

    return `
      <div id="starter-prompts" aria-label="Suggested questions">
        <div class="starter-title">Try asking</div>
        <div class="starter-list">
          ${prompts
            .map(
              (prompt) => `
                <button type="button" class="starter-prompt" data-starter-prompt="${escapeHtml(prompt)}">
                  ${escapeHtml(prompt)}
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

  private renderMessage(msg: Message): string {
    return `
      <div class="message ${msg.role}">
        <div class="bubble">${
          msg.role === "assistant"
            ? linkSourcesInText(msg.content, msg.sources)
            : escapeHtml(msg.content)
        }</div>
        ${msg.role === "assistant" ? renderSourceList(msg.sources) : ""}
        <div class="message-time">${formatTime(msg.ts)}</div>
      </div>
    `;
  }

  private appendMessageToDOM(msg: Message, id?: string): HTMLElement {
    const msgEl = document.createElement("div");
    msgEl.className = `message ${msg.role}`;
    if (id) msgEl.id = id;
    msgEl.innerHTML = `
      <div class="bubble">${escapeHtml(msg.content)}</div>
      <div class="message-time">${formatTime(msg.ts)}</div>
    `;
    const messagesEl = this.shadow.getElementById("messages");
    messagesEl?.appendChild(msgEl);
    this.scrollToBottom();
    return msgEl;
  }

  private showTyping(): HTMLElement {
    const el = document.createElement("div");
    el.className = "message assistant";
    el.id = "typing-indicator";
    el.innerHTML = `
      <div class="typing-wrap">
        <div class="typing" aria-label="Assistant is checking knowledge">
          <span></span><span></span><span></span>
        </div>
        <div class="typing-label">Checking knowledge</div>
      </div>
    `;
    this.shadow.getElementById("messages")?.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  private scrollToBottom() {
    const el = this.shadow.getElementById("messages");
    if (el) el.scrollTop = el.scrollHeight;
  }

  private attachListeners() {
    const launcher = this.shadow.getElementById("launcher")!;
    const resetBtn = this.shadow.getElementById("reset-btn") as HTMLButtonElement | null;
    const closeBtn = this.shadow.getElementById("close-btn")!;
    const input = this.shadow.getElementById("input") as HTMLTextAreaElement;
    const sendBtn = this.shadow.getElementById("send-btn") as HTMLButtonElement;
    const nudge = this.shadow.getElementById("nudge");
    const closeNudgeBtn = this.shadow.getElementById("close-nudge");
    const messagesEl = this.shadow.getElementById("messages");

    // Show nudge after a short delay if chat wasn't opened
    setTimeout(() => {
      if (!this.isOpen && nudge) {
        nudge.classList.add("visible");
      }
    }, 3000);

    closeNudgeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      nudge?.classList.remove("visible");
    });

    launcher.addEventListener("click", () => {
      nudge?.classList.remove("visible");
      this.toggle();
    });
    
    resetBtn?.addEventListener("click", () => this.resetChat());
    closeBtn.addEventListener("click", () => this.close());

    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.sendMessage();
      }
    });

    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    });

    messagesEl?.addEventListener("click", (e) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const promptButton = target?.closest<HTMLButtonElement>("[data-starter-prompt]");
      if (!promptButton || this.isPreviewOnly()) return;
      const prompt = promptButton.getAttribute("data-starter-prompt") ?? "";
      if (!prompt.trim()) return;
      input.value = prompt;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });

    sendBtn.addEventListener("click", () => void this.sendMessage());
  }

  private toggle() {
    this.isOpen ? this.close() : this.open();
  }

  private open() {
    this.isOpen = true;
    const launcher = this.shadow.getElementById("launcher");
    launcher?.classList.add("open");
    launcher?.setAttribute("aria-label", "Close chat");
    launcher?.setAttribute("title", "Close chat");
    this.shadow.getElementById("panel")?.classList.add("open");
    if (!this.isPreviewOnly()) {
      setTimeout(() => {
        (this.shadow.getElementById("input") as HTMLTextAreaElement | null)?.focus();
      }, 250);
    }
    this.scrollToBottom();
  }

  private close() {
    this.isOpen = false;
    const launcher = this.shadow.getElementById("launcher");
    launcher?.classList.remove("open");
    launcher?.setAttribute("aria-label", "Open chat");
    launcher?.setAttribute("title", "Open chat");
    this.shadow.getElementById("panel")?.classList.remove("open");
  }

  private async ensureSession() {
    if (this.sessionId && this.token) return;

    this.sessionError = null;
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: this.siteId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { token: string; sessionId: string };
        this.sessionId = data.sessionId;
        this.token = data.token;
        this.saveSession();
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      this.sessionError = data?.error ?? "Widget session could not be created.";
    } catch {
      this.sessionError = "Widget session could not be created.";
    }
  }

  private async sendMessage() {
    if (this.isStreaming) return;
    if (this.isPreviewOnly()) return;

    const input = this.shadow.getElementById("input") as HTMLTextAreaElement;
    const sendBtn = this.shadow.getElementById("send-btn") as HTMLButtonElement;
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";

    // Remove greeting card
    this.shadow.getElementById("greeting")?.remove();
    this.shadow.getElementById("starter-prompts")?.remove();

    // Add user message
    const userMsg: Message = { role: "user", content: text, ts: Date.now() };
    this.messages.push(userMsg);
    this.appendMessageToDOM(userMsg);

    this.isStreaming = true;
    sendBtn.disabled = true;

    await this.ensureSession();

    // Show typing
    const typingEl = this.showTyping();

    // Prepare SSE
    let assistantContent = "";
    const assistantMsg: Message = { role: "assistant", content: "", ts: Date.now() };
    let assistantEl: HTMLElement | null = null;
    let bubbleEl: HTMLElement | null = null;

    try {
      if (!this.sessionId || !this.token) {
        throw new Error(this.sessionError ?? "Widget session could not be created.");
      }

      const res = await fetch(`${this.baseUrl}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: this.siteId,
          messages: this.messages.slice(-10).map(({ role, content, sources }) => ({
            role,
            content,
            ...(sources?.length ? { sources } : {}),
          })),
          sessionId: this.sessionId,
          token: this.token,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        const match = body.match(/"message"\s*:\s*"([^"]+)"/) ?? body.match(/"error"\s*:\s*"([^"]+)"/);
        throw new Error(match?.[1] ?? "Chat request failed.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      typingEl.remove();

      // Create assistant bubble
      assistantEl = document.createElement("div");
      assistantEl.className = "message assistant";
      bubbleEl = document.createElement("div");
      bubbleEl.className = "bubble";
      assistantEl.appendChild(bubbleEl);
      this.shadow.getElementById("messages")?.appendChild(assistantEl);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data) as {
              type: string;
              content?: string;
              sources?: Array<{ title: string; url: string; score: number }>;
              message?: string;
            };

            if (event.type === "token" && event.content) {
              assistantContent += event.content;
              bubbleEl!.textContent = assistantContent;
              this.scrollToBottom();
            } else if (event.type === "sources" && event.sources) {
              assistantMsg.sources = event.sources;
            } else if (event.type === "error") {
              assistantContent =
                event.message?.trim() || "Sorry, something went wrong. Please try again.";
              bubbleEl!.textContent = assistantContent;
              this.scrollToBottom();
            }
          } catch { /* malformed event */ }
        }
      }
    } catch (err) {
      typingEl.remove();
      const message = err instanceof Error ? err.message : "";
      assistantContent = /domain not allowed|origin header|required|session/i.test(message)
        ? "This widget is not enabled for this domain yet. Update the allowed domains in setup, then try again."
        : "Sorry, I couldn't connect. Please try again.";
      if (!assistantEl) {
        assistantEl = document.createElement("div");
        assistantEl.className = "message assistant";
        bubbleEl = document.createElement("div");
        bubbleEl.className = "bubble";
        assistantEl.appendChild(bubbleEl);
        this.shadow.getElementById("messages")?.appendChild(assistantEl);
      }
      if (bubbleEl) bubbleEl.textContent = assistantContent;
    } finally {
      // Add time + inline sources
      if (assistantEl) {
        if (bubbleEl) {
          bubbleEl.innerHTML = linkSourcesInText(
            assistantContent,
            assistantMsg.sources
          );
        }

        const sourceHtml = renderSourceList(assistantMsg.sources);
        if (sourceHtml) {
          const sourceWrap = document.createElement("div");
          sourceWrap.innerHTML = sourceHtml.trim();
          const sourceEl = sourceWrap.firstElementChild;
          if (sourceEl) assistantEl.appendChild(sourceEl);
        }

        const timeEl = document.createElement("div");
        timeEl.className = "message-time";
        timeEl.textContent = formatTime(Date.now());
        assistantEl.appendChild(timeEl);
      }

      assistantMsg.content = assistantContent;
      this.messages.push(assistantMsg);
      this.saveSession();
      this.scrollToBottom();

      this.isStreaming = false;
      sendBtn.disabled = false;
      (this.shadow.getElementById("input") as HTMLTextAreaElement | null)?.focus();
    }
  }

  private resetChat() {
    if (this.isStreaming) return;

    // Clear state
    this.messages = [];
    this.sessionId = null;
    this.token = null;

    // Clear persisted state
    sessionStorage.removeItem(this.storageKey(SESSION_KEY));
    sessionStorage.removeItem(this.storageKey(MESSAGES_KEY));
    sessionStorage.removeItem(`${SESSION_KEY}:${this.siteId}`);
    sessionStorage.removeItem(`${MESSAGES_KEY}:${this.siteId}`);

    // Reset UI
    const messagesEl = this.shadow.getElementById("messages");
    if (messagesEl) {
      messagesEl.innerHTML = `${this.renderGreeting()}${this.renderStarterPrompts()}`;
    }
    this.scrollToBottom();
  }
}

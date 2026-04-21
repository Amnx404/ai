import { getStyles } from "./styles";

interface WidgetConfig {
  id: string;
  primaryColor: string;
  title: string;
  greeting: string;
  primaryUrl?: string;
  logoUrl?: string | null;
  allowedTopics: string[];
  appUrl?: string;
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

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function linkSourcesInText(
  plainText: string,
  sources: Array<{ title: string; url: string; score: number }> | undefined
): string {
  const safe = escapeHtml(plainText);
  if (!sources?.length) return safe;

  // Link up to 5 sources that were actually mentioned (server filters).
  let html = safe;
  for (const s of sources.slice(0, 5)) {
    if (!s?.url) continue;
    const label = shortSourceLabel(s.title || s.url || "Source");
    const escapedLabel = escapeHtml(label);
    // Replace first occurrence only, case-insensitive.
    const re = new RegExp(`\\b${escapeRegExp(escapedLabel)}\\b`, "i");
    if (!re.test(html)) continue;
    html = html.replace(
      re,
      `<a class="intext-source" href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapedLabel}</a>`
    );
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
  private sessionId: string | null = null;
  private token: string | null = null;
  private isOpen = false;
  private isStreaming = false;

  constructor(siteId: string) {
    this.siteId = siteId;
    this.baseUrl = getBaseUrl(siteId);

    this.host = document.createElement("div");
    this.host.id = "rr-chat-widget";
    this.host.style.cssText = "position:fixed;z-index:999999;";
    document.body.appendChild(this.host);

    this.shadow = this.host.attachShadow({ mode: "closed" });
    void this.init();
  }

  private async init() {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/widget-config?siteId=${this.siteId}`);
      if (!res.ok) {
        // If the site is disabled/deleted, the config endpoint returns 404.
        // In that case, do not mount the widget UI at all.
        if (res.status === 404) {
          this.host.remove();
        }
        return;
      }
      this.config = (await res.json()) as WidgetConfig;
    } catch {
      this.config = {
        id: this.siteId,
        primaryColor: "#6366f1",
        title: "Chat",
        greeting: "Hi! How can I help you today?",
        allowedTopics: [],
      };
    }

    // If the host was removed (disabled site), stop initialization.
    if (!this.host.isConnected) return;

    // Restore session
    const savedSession = sessionStorage.getItem(`${SESSION_KEY}:${this.siteId}`);
    if (savedSession) {
      try {
        const { sessionId, token } = JSON.parse(savedSession) as { sessionId: string; token: string };
        this.sessionId = sessionId;
        this.token = token;
      } catch { /* ignore */ }
    }

    const savedMessages = sessionStorage.getItem(`${MESSAGES_KEY}:${this.siteId}`);
    if (savedMessages) {
      try {
        this.messages = JSON.parse(savedMessages) as Message[];
      } catch { /* ignore */ }
    }

    this.render();
    this.attachListeners();
  }

  private saveSession() {
    if (this.sessionId && this.token) {
      sessionStorage.setItem(
        `${SESSION_KEY}:${this.siteId}`,
        JSON.stringify({ sessionId: this.sessionId, token: this.token })
      );
    }
    sessionStorage.setItem(
      `${MESSAGES_KEY}:${this.siteId}`,
      JSON.stringify(this.messages)
    );
  }

  private render() {
    const color = this.config?.primaryColor ?? "#6366f1";
    const launcherIcon =
      this.config?.logoUrl ?? window.ChatWidget?.pageIconUrl ?? null;
    this.shadow.innerHTML = `
      <style>${getStyles(color)}</style>

      <button id="launcher" aria-label="Open chat" title="Open chat">
        ${
          launcherIcon
            ? `<img class="launcher-logo" alt="" src="${escapeHtml(launcherIcon)}" onerror="this.remove()" />`
            : ""
        }
        <svg class="icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
        <svg class="icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

      <div id="panel" role="dialog" aria-label="Chat window">
        <button id="resize-grip" aria-label="Resize chat window" title="Resize"></button>
        <div id="header">
          <div id="header-avatar">
            <svg class="header-default-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            ${
              this.config?.logoUrl
                ? `<img alt="Logo" src="${escapeHtml(this.config.logoUrl)}" onerror="this.remove()" />`
                : ""
            }
          </div>
          <div id="header-info">
            <div id="header-title">${escapeHtml(this.config?.title ?? "Chat")}</div>
            <div id="header-status">
              <span id="status-dot"></span>
              <span>Online</span>
            </div>
          </div>
          <button id="close-btn" aria-label="Close chat">
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div id="messages" aria-live="polite" aria-atomic="false">
          ${this.renderGreeting()}
          ${this.messages.map((m) => this.renderMessage(m)).join("")}
        </div>

        <div id="input-area">
          <textarea
            id="input"
            placeholder="Ask a question…"
            rows="1"
            aria-label="Message input"
          ></textarea>
          <button id="send-btn" aria-label="Send message">
            <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <div id="powered-by">
          <a href="${escapeHtml(this.config?.appUrl ?? this.baseUrl)}" target="_blank" rel="noopener">
            Powered by Gemini
          </a>
        </div>
      </div>
    `;
  }

  private renderGreeting(): string {
    if (!this.config?.greeting || this.messages.length > 0) return "";
    return `<div id="greeting">${escapeHtml(this.config.greeting)}</div>`;
  }

  private renderMessage(msg: Message): string {
    return `
      <div class="message ${msg.role}">
        <div class="bubble">${
          msg.role === "assistant"
            ? linkSourcesInText(msg.content, msg.sources)
            : escapeHtml(msg.content)
        }</div>
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
    el.innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;
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
    const closeBtn = this.shadow.getElementById("close-btn")!;
    const panel = this.shadow.getElementById("panel") as HTMLElement;
    const grip = this.shadow.getElementById("resize-grip") as HTMLButtonElement | null;
    const input = this.shadow.getElementById("input") as HTMLTextAreaElement;
    const sendBtn = this.shadow.getElementById("send-btn") as HTMLButtonElement;

    launcher.addEventListener("click", () => this.toggle());
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

    sendBtn.addEventListener("click", () => void this.sendMessage());

    // Custom resize from top-left (instead of native bottom-right handle)
    if (grip) {
      grip.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        grip.setPointerCapture(e.pointerId);

        const startW = panel.getBoundingClientRect().width;
        const startH = panel.getBoundingClientRect().height;
        const startX = e.clientX;
        const startY = e.clientY;

        const minW = 340;
        const minH = 460;
        const maxW = Math.min(window.innerWidth - 32, 720);
        const maxH = Math.min(window.innerHeight - 120, 900);

        const onMove = (ev: PointerEvent) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          const nextW = Math.max(minW, Math.min(maxW, startW - dx));
          const nextH = Math.max(minH, Math.min(maxH, startH - dy));
          panel.style.width = `${Math.round(nextW)}px`;
          panel.style.height = `${Math.round(nextH)}px`;
        };

        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp, { once: true });
      });
    }
  }

  private toggle() {
    this.isOpen ? this.close() : this.open();
  }

  private open() {
    this.isOpen = true;
    this.shadow.getElementById("launcher")?.classList.add("open");
    this.shadow.getElementById("panel")?.classList.add("open");
    setTimeout(() => {
      (this.shadow.getElementById("input") as HTMLTextAreaElement | null)?.focus();
    }, 250);
    this.scrollToBottom();
  }

  private close() {
    this.isOpen = false;
    this.shadow.getElementById("launcher")?.classList.remove("open");
    this.shadow.getElementById("panel")?.classList.remove("open");
  }

  private async ensureSession() {
    if (this.sessionId && this.token) return;

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
      }
    } catch { /* continue without session */ }
  }

  private async sendMessage() {
    if (this.isStreaming) return;

    const input = this.shadow.getElementById("input") as HTMLTextAreaElement;
    const sendBtn = this.shadow.getElementById("send-btn") as HTMLButtonElement;
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";

    // Remove greeting card
    this.shadow.getElementById("greeting")?.remove();

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
      const res = await fetch(`${this.baseUrl}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: this.siteId,
          messages: this.messages.slice(-10).map(({ role, content }) => ({ role, content })),
          sessionId: this.sessionId,
          token: this.token,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Network error");
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
            }
          } catch { /* malformed event */ }
        }
      }
    } catch (err) {
      typingEl.remove();
      assistantContent = "Sorry, I couldn't connect. Please try again.";
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
}

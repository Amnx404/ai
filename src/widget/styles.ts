export function getStyles(primaryColor: string): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      --primary: ${primaryColor};
      --primary-dark: color-mix(in srgb, ${primaryColor} 80%, #000);
      --bg: #ffffff;
      --bg-secondary: #f9fafb;
      --text: #111827;
      --text-secondary: #6b7280;
      --border: #e5e7eb;
      --shadow: 0 4px 24px rgba(0,0,0,0.12), 0 1px 6px rgba(0,0,0,0.08);
      --radius: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Launcher button */
    #launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--primary);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      z-index: 999998;
      outline: none;
    }

    #launcher:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 20px rgba(0,0,0,0.25);
    }

    #launcher:active { transform: scale(0.96); }

    #launcher svg {
      width: 24px;
      height: 24px;
      fill: #fff;
      transition: transform 0.3s ease, opacity 0.2s ease;
    }

    #launcher .icon-close {
      position: absolute;
      opacity: 0;
      transform: rotate(-90deg) scale(0.8);
    }

    #launcher.open .icon-chat {
      opacity: 0;
      transform: rotate(90deg) scale(0.8);
    }

    #launcher.open .icon-close {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }

    /* Chat panel */
    #panel {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 580px;
      max-height: calc(100vh - 120px);
      max-width: calc(100vw - 32px);
      background: var(--bg);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      z-index: 999997;
      transform-origin: bottom right;
      transform: scale(0.85) translateY(16px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1),
                  opacity 0.2s ease;
    }

    #panel.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* Header */
    #header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 18px;
      background: var(--primary);
      color: #fff;
      flex-shrink: 0;
    }

    #header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    #header-avatar svg { width: 18px; height: 18px; fill: #fff; }

    #header-info { flex: 1; min-width: 0; }

    #header-title {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #header-status {
      font-size: 12px;
      opacity: 0.85;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    #status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #4ade80;
      display: inline-block;
    }

    #close-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: rgba(255,255,255,0.85);
      display: flex;
      border-radius: 8px;
      transition: background 0.15s;
    }

    #close-btn:hover { background: rgba(255,255,255,0.15); color: #fff; }
    #close-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; }

    /* Messages */
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }

    #messages::-webkit-scrollbar { width: 4px; }
    #messages::-webkit-scrollbar-track { background: transparent; }
    #messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 88%;
      gap: 2px;
    }

    .message.user { align-self: flex-end; align-items: flex-end; }
    .message.assistant { align-self: flex-start; align-items: flex-start; }

    .bubble {
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 14px;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .message.user .bubble {
      background: var(--primary);
      color: #fff;
      border-bottom-right-radius: 4px;
    }

    .message.assistant .bubble {
      background: var(--bg-secondary);
      color: var(--text);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
    }

    .message-time {
      font-size: 11px;
      color: var(--text-secondary);
      padding: 0 4px;
    }

    /* Sources */
    .sources {
      margin-top: 6px;
      padding: 8px 10px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 12px;
      color: var(--text-secondary);
      max-width: 100%;
    }

    .sources-label {
      font-weight: 600;
      color: var(--text);
      margin-bottom: 4px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .source-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 0;
      overflow: hidden;
    }

    .source-item a {
      color: var(--primary);
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
    }

    .source-item a:hover { text-decoration: underline; }

    .source-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--primary);
      flex-shrink: 0;
    }

    /* Typing indicator */
    .typing {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      width: fit-content;
    }

    .typing span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--text-secondary);
      display: inline-block;
      animation: bounce 1.2s ease infinite;
    }

    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /* Greeting card */
    #greeting {
      padding: 16px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: #fff;
      border-radius: 14px;
      margin: 4px 0;
      font-size: 14px;
      line-height: 1.6;
    }

    /* Input area */
    #input-area {
      padding: 12px 14px;
      border-top: 1px solid var(--border);
      display: flex;
      gap: 8px;
      align-items: flex-end;
      background: var(--bg);
      flex-shrink: 0;
    }

    #input {
      flex: 1;
      border: 1.5px solid var(--border);
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      outline: none;
      line-height: 1.5;
      max-height: 120px;
      min-height: 42px;
      color: var(--text);
      background: var(--bg-secondary);
      transition: border-color 0.15s;
      overflow-y: auto;
    }

    #input:focus { border-color: var(--primary); background: var(--bg); }
    #input::placeholder { color: var(--text-secondary); }

    #send-btn {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, transform 0.1s;
    }

    #send-btn:hover { background: var(--primary-dark); }
    #send-btn:active { transform: scale(0.92); }
    #send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    #send-btn svg { width: 16px; height: 16px; stroke: #fff; fill: none; }

    /* Powered by */
    #powered-by {
      text-align: center;
      font-size: 11px;
      color: var(--text-secondary);
      padding: 6px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }

    #powered-by a {
      color: var(--primary);
      text-decoration: none;
    }

    /* Mobile responsive */
    @media (max-width: 480px) {
      #panel {
        bottom: 0;
        right: 0;
        width: 100%;
        max-width: 100%;
        height: 85vh;
        max-height: 85vh;
        border-radius: var(--radius) var(--radius) 0 0;
      }

      #launcher {
        bottom: 16px;
        right: 16px;
      }
    }
  `;
}

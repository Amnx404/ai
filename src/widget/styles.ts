export function getStyles(primaryColor: string): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      --primary: ${primaryColor};
      --bg: #ffffff;
      --bg-secondary: #f9fafb;
      --text: #111827;
      --text-secondary: #6b7280;
      --border: #e5e7eb;
      --shadow: 0 24px 60px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08);
      --radius: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #nudge {
      position: fixed;
      right: 24px;
      bottom: 88px;
      z-index: 999998;
      display: flex;
      max-width: calc(100vw - 32px);
      align-items: center;
      gap: 8px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
      color: var(--text);
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
      padding: 10px 10px 10px 12px;
      font-size: 13px;
      font-weight: 650;
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    #nudge.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .nudge-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    #close-nudge {
      display: flex;
      width: 24px;
      height: 24px;
      align-items: center;
      justify-content: center;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }

    #close-nudge:hover {
      border-color: var(--border);
      background: var(--bg-secondary);
      color: var(--text);
    }

    #launcher {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 999998;
      display: inline-flex;
      height: 52px;
      max-width: min(240px, calc(100vw - 32px));
      align-items: center;
      justify-content: center;
      gap: 9px;
      border: 1px solid color-mix(in srgb, var(--primary) 76%, #000);
      border-radius: 14px;
      background: var(--primary);
      color: #ffffff;
      box-shadow: 0 12px 28px color-mix(in srgb, var(--primary) 30%, transparent);
      cursor: pointer;
      outline: none;
      padding: 0 15px 0 12px;
      transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
      -webkit-tap-highlight-color: transparent;
    }

    #launcher:hover {
      box-shadow: 0 16px 34px color-mix(in srgb, var(--primary) 36%, transparent);
      transform: translateY(-1px);
    }

    #launcher:active { transform: translateY(0); }

    #launcher:focus-visible {
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 18%, transparent), 0 12px 28px color-mix(in srgb, var(--primary) 30%, transparent);
    }

    .launcher-face {
      display: flex;
      width: 28px;
      height: 28px;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
    }

    #launcher svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    #launcher .launcher-logo {
      width: 28px;
      height: 28px;
      border: 1px solid rgba(255,255,255,0.55);
      border-radius: 8px;
      background: #ffffff;
      object-fit: cover;
    }

    .launcher-text {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      font-weight: 750;
      letter-spacing: 0;
    }

    #launcher .icon-close {
      display: none;
      width: 20px;
      height: 20px;
      fill: currentColor;
      stroke: none;
    }

    #launcher.open {
      width: 52px;
      padding: 0;
      border-color: var(--border);
      background: #ffffff;
      color: var(--text);
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.14);
    }

    #launcher.open .launcher-face,
    #launcher.open .launcher-text {
      display: none;
    }

    #launcher.open .icon-close {
      display: block;
    }

    #panel {
      position: fixed;
      right: 24px;
      bottom: 92px;
      z-index: 999997;
      display: flex;
      width: 392px;
      height: 600px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 116px);
      min-width: 340px;
      min-height: 460px;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid rgba(17, 24, 39, 0.1);
      border-radius: 16px;
      background: var(--bg);
      box-shadow: var(--shadow);
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px);
      transform-origin: bottom right;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }

    #panel.open {
      opacity: 1;
      pointer-events: all;
      transform: translateY(0);
    }

    #header {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--border);
      background: #ffffff;
      color: var(--text);
      padding: 16px;
    }

    #header-avatar {
      display: flex;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 10px;
      background: color-mix(in srgb, var(--primary) 12%, #ffffff);
      color: var(--primary);
    }

    #header-avatar svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    #header-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    #header-info { min-width: 0; flex: 1; }

    #header-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 15px;
      font-weight: 750;
      line-height: 1.25;
      letter-spacing: 0;
    }

    #header-status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 3px;
      color: var(--text-secondary);
      font-size: 12px;
      line-height: 1.3;
    }

    #status-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      flex-shrink: 0;
      border-radius: 999px;
      background: #10b981;
    }

    #status-dot.muted {
      background: #f59e0b;
    }

    #close-btn, #reset-btn {
      display: flex;
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    #close-btn:hover, #reset-btn:hover {
      border-color: var(--border);
      background: var(--bg-secondary);
      color: var(--text);
    }

    #close-btn svg, #reset-btn svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      fill: none;
    }

    #mode-banner {
      display: grid;
      gap: 2px;
      border-bottom: 1px solid #fde68a;
      background: #fffbeb;
      color: #92400e;
      padding: 11px 16px;
      font-size: 12px;
      line-height: 1.45;
    }

    #mode-banner strong {
      color: #78350f;
      font-size: 12px;
    }

    #messages {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 14px;
      overflow-y: auto;
      background: #ffffff;
      padding: 18px;
      scroll-behavior: smooth;
    }

    #messages::-webkit-scrollbar { width: 6px; }
    #messages::-webkit-scrollbar-track { background: transparent; }
    #messages::-webkit-scrollbar-thumb { background: rgba(17,24,39,0.16); border-radius: 10px; }
    #messages::-webkit-scrollbar-thumb:hover { background: rgba(17,24,39,0.26); }

    .message {
      display: flex;
      max-width: 86%;
      flex-direction: column;
      gap: 4px;
    }

    .message.user { align-self: flex-end; align-items: flex-end; }
    .message.assistant { align-self: flex-start; align-items: flex-start; }

    .bubble {
      overflow-wrap: anywhere;
      border-radius: 14px;
      box-shadow: none;
      font-size: 14px;
      line-height: 1.55;
      padding: 11px 13px;
      white-space: pre-wrap;
      word-break: normal;
    }

    .message.user .bubble {
      border-bottom-right-radius: 5px;
      background: var(--primary);
      color: #ffffff;
    }

    .message.assistant .bubble {
      border: 1px solid var(--border);
      border-bottom-left-radius: 5px;
      background: var(--bg-secondary);
      color: var(--text);
    }

    .source-list {
      max-width: 100%;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #ffffff;
      padding: 8px;
    }

    .source-list-title {
      color: var(--text-secondary);
      font-size: 10px;
      font-weight: 750;
      letter-spacing: 0.04em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .source-list-links {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 7px;
    }

    .source-chip {
      display: inline-flex;
      max-width: 100%;
      align-items: center;
      border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border));
      border-radius: 999px;
      background: color-mix(in srgb, var(--primary) 7%, #ffffff);
      color: color-mix(in srgb, var(--primary) 78%, #111827);
      font-size: 11px;
      font-weight: 650;
      line-height: 1.2;
      overflow: hidden;
      padding: 5px 8px;
      text-decoration: none;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .source-chip:hover {
      border-color: color-mix(in srgb, var(--primary) 38%, var(--border));
      background: color-mix(in srgb, var(--primary) 12%, #ffffff);
      text-decoration: none;
    }

    .intext-source {
      color: var(--primary);
      font-weight: 650;
      text-decoration: none;
    }

    .intext-source:hover { text-decoration: underline; }

    .message-time {
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 500;
      padding: 0 4px;
    }

    .sources { display: none; }

    .typing-wrap {
      display: grid;
      gap: 6px;
    }

    .typing {
      display: flex;
      width: fit-content;
      align-items: center;
      gap: 5px;
      border: 1px solid var(--border);
      border-radius: 14px;
      border-bottom-left-radius: 5px;
      background: var(--bg-secondary);
      padding: 12px 14px;
    }

    .typing-label {
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 650;
      padding-left: 4px;
    }

    .typing span {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      animation: bounce 1.4s ease-in-out infinite;
      background: var(--primary);
      opacity: 0.55;
    }

    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.55; }
      30% { transform: translateY(-4px); opacity: 1; }
    }

    #greeting {
      border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
      border-radius: 14px;
      background: color-mix(in srgb, var(--primary) 8%, #ffffff);
      color: var(--text);
      font-size: 14px;
      line-height: 1.55;
      margin: 2px 0;
      padding: 13px 14px;
    }

    #starter-prompts {
      display: grid;
      gap: 8px;
      margin-top: -4px;
    }

    .starter-title {
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 0.04em;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .starter-list {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
    }

    .starter-prompt {
      max-width: 100%;
      border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border));
      border-radius: 999px;
      background: #ffffff;
      color: color-mix(in srgb, var(--primary) 76%, var(--text));
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      font-weight: 650;
      line-height: 1.25;
      overflow: hidden;
      padding: 7px 10px;
      text-align: left;
      text-overflow: ellipsis;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      white-space: nowrap;
    }

    .starter-prompt:hover {
      border-color: color-mix(in srgb, var(--primary) 38%, var(--border));
      background: color-mix(in srgb, var(--primary) 7%, #ffffff);
      color: color-mix(in srgb, var(--primary) 86%, var(--text));
    }

    .starter-prompt:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent);
    }

    #input-area {
      display: flex;
      flex-shrink: 0;
      align-items: flex-end;
      gap: 10px;
      border-top: 1px solid var(--border);
      background: #ffffff;
      padding: 14px 16px;
    }

    #input {
      flex: 1;
      min-height: 44px;
      max-height: 120px;
      resize: none;
      border: 1px solid var(--border);
      border-radius: 12px;
      outline: none;
      background: #ffffff;
      color: var(--text);
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      padding: 11px 12px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    #input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 14%, transparent);
    }

    #input:disabled {
      background: var(--bg-secondary);
      color: var(--text-secondary);
      cursor: not-allowed;
    }

    #input::placeholder { color: var(--text-secondary); }

    #send-btn {
      display: flex;
      width: 44px;
      height: 44px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border: 1px solid color-mix(in srgb, var(--primary) 76%, #000);
      border-radius: 12px;
      background: var(--primary);
      box-shadow: none;
      cursor: pointer;
      transition: background 0.15s ease, transform 0.15s ease, opacity 0.15s ease;
    }

    #send-btn:hover {
      transform: translateY(-1px);
    }

    #send-btn:active { transform: translateY(0); }

    #send-btn:disabled {
      border-color: var(--border);
      background: var(--border);
      cursor: not-allowed;
      opacity: 0.72;
      transform: none;
    }

    #send-btn svg {
      width: 18px;
      height: 18px;
      margin-left: -2px;
      fill: none;
      stroke: #ffffff;
    }

    #powered-by {
      flex-shrink: 0;
      background: #ffffff;
      border-top: 1px solid var(--border);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 500;
      padding: 8px;
      text-align: center;
    }

    #powered-by a {
      color: var(--text-secondary);
      text-decoration: none;
    }

    #powered-by a:hover {
      color: var(--primary);
      text-decoration: underline;
    }

    @media (max-width: 480px) {
      #nudge {
        right: 16px;
        bottom: 80px;
      }

      #panel {
        top: 12px;
        right: 12px;
        bottom: 84px;
        left: 12px;
        width: auto;
        height: auto;
        min-width: 0;
        min-height: 0;
        max-width: none;
        max-height: none;
        border-radius: 16px;
      }

      #launcher {
        right: 16px;
        bottom: 16px;
        max-width: calc(100vw - 32px);
      }

      .message {
        max-width: 92%;
      }
    }
  `;
}

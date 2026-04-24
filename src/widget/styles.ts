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

    /* Nudge tooltip */
    #nudge {
      position: fixed;
      bottom: 100px;
      right: 32px;
      background: #ffffff;
      color: #111827;
      padding: 14px 20px;
      border-radius: 20px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06);
      font-size: 15px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 12px;
      opacity: 0;
      transform: translateY(16px) scale(0.9);
      pointer-events: none;
      transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      z-index: 999998;
      transform-origin: bottom right;
      border: 1px solid rgba(0,0,0,0.05);
    }

    #nudge::after {
      content: '';
      position: absolute;
      bottom: -6px;
      right: 18px;
      width: 14px;
      height: 14px;
      background: #ffffff;
      transform: rotate(45deg);
      border-right: 1px solid rgba(0,0,0,0.05);
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }

    #nudge.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
      animation: float-nudge 4s ease-in-out infinite 1s;
    }

    @keyframes float-nudge {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }

    .nudge-text {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .wave {
      display: inline-block;
      animation: wave 2.5s infinite;
      transform-origin: 70% 70%;
      font-size: 18px;
    }

    @keyframes wave {
      0%, 100% { transform: rotate(0deg); }
      10% { transform: rotate(14deg); }
      20% { transform: rotate(-8deg); }
      30% { transform: rotate(14deg); }
      40% { transform: rotate(-4deg); }
      50% { transform: rotate(10deg); }
      60% { transform: rotate(0deg); }
    }

    #close-nudge {
      background: rgba(0,0,0,0.04);
      border: none;
      color: #6b7280;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    #close-nudge:hover {
      background: rgba(0,0,0,0.08);
      color: #111827;
    }

    /* Launcher button */
    #launcher {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 64px;
      height: 64px;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 999998;
      outline: none;
      background: transparent;
      border-radius: 50%;
      animation: float-orb 4s ease-in-out infinite;
      -webkit-tap-highlight-color: transparent;
    }

    @keyframes float-orb {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

    #launcher::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #fff), color-mix(in srgb, var(--primary) 60%, #000), var(--primary));
      background-size: 300% 300%;
      animation: gradient-spin 6s ease infinite, morph-blob 8s ease-in-out infinite alternate;
      z-index: -2;
      box-shadow: 0 8px 32px color-mix(in srgb, var(--primary) 50%, transparent);
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    #launcher::after {
      content: '';
      position: absolute;
      inset: 2px;
      border-radius: 50%;
      background: linear-gradient(to bottom right, rgba(255,255,255,0.4), rgba(255,255,255,0.05));
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      box-shadow: inset 0 2px 4px rgba(255,255,255,0.7), inset 0 -4px 10px rgba(0,0,0,0.15);
      animation: morph-blob 8s ease-in-out infinite alternate;
      z-index: -1;
      transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes gradient-spin {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes morph-blob {
      0% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; }
      33% { border-radius: 55% 45% 55% 45% / 45% 55% 45% 55%; }
      66% { border-radius: 45% 55% 45% 55% / 55% 45% 55% 45%; }
      100% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; }
    }

    #launcher:hover {
      transform: scale(1.1) !important;
      animation-play-state: paused;
    }

    #launcher:hover::before, #launcher:hover::after {
      border-radius: 20px !important;
      animation-play-state: paused;
    }
    
    #launcher:hover::before {
      box-shadow: 0 12px 40px color-mix(in srgb, var(--primary) 70%, transparent);
    }

    #launcher:active { transform: scale(0.96) translateY(0) !important; }

    #launcher svg {
      width: 28px;
      height: 28px;
      fill: #fff;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
      z-index: 10;
    }
    
    #launcher .icon-chat {
      animation: sparkle-pulse 3s ease-in-out infinite alternate;
    }
    
    @keyframes sparkle-pulse {
      0% { transform: scale(0.95); filter: drop-shadow(0 0 4px rgba(255,255,255,0.4)); }
      100% { transform: scale(1.05); filter: drop-shadow(0 0 12px rgba(255,255,255,0.9)); }
    }

    #launcher .launcher-logo {
      position: absolute;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.95);
      border: 1px solid rgba(255,255,255,0.6);
      object-fit: cover;
      box-shadow: 0 6px 14px rgba(0,0,0,0.18);
      opacity: 1;
      transition: opacity 0.2s ease;
      z-index: 10;
    }

    #launcher.open .launcher-logo {
      opacity: 0;
    }

    #launcher .icon-close {
      position: absolute;
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }

    #launcher.open .icon-chat {
      opacity: 0;
      transform: rotate(90deg) scale(0.5);
      animation: none;
    }

    #launcher.open {
      animation: none !important;
      transform: scale(0.9) !important;
    }
    
    #launcher.open::before, #launcher.open::after {
      animation: none !important;
      border-radius: 50% !important;
      background: var(--bg);
      box-shadow: var(--shadow) !important;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
    
    #launcher.open svg {
      fill: var(--text);
      filter: none;
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
      width: 392px;
      height: 600px;
      max-height: calc(100vh - 120px);
      max-width: calc(100vw - 32px);
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 24px;
      box-shadow: 0 30px 80px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 340px;
      min-height: 460px;
      z-index: 999997;
      transform-origin: bottom right;
      transform: scale(0.85) translateY(16px);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
    }

    /* Top-left resize grip */
    #resize-grip {
      position: absolute;
      top: 0;
      left: 0;
      width: 36px;
      height: 36px;
      border: none;
      background: transparent;
      cursor: nwse-resize;
      opacity: 0.5;
      z-index: 10;
      border-top-left-radius: 24px;
      transition: opacity 0.2s;
    }

    #resize-grip:hover {
      opacity: 1;
      background: radial-gradient(circle at top left, rgba(0,0,0,0.06) 40%, transparent 70%);
    }

    #resize-grip::before {
      content: "";
      position: absolute;
      top: 14px;
      left: 14px;
      width: 8px;
      height: 8px;
      border-top: 2px solid rgba(0,0,0,0.4);
      border-left: 2px solid rgba(0,0,0,0.4);
      border-top-left-radius: 2px;
      transition: transform 0.2s;
    }

    #resize-grip:hover::before {
      border-color: rgba(0,0,0,0.7);
      transform: translate(-1.5px, -1.5px);
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
      gap: 12px;
      padding: 18px 20px;
      background: rgba(255, 255, 255, 0.5);
      border-bottom: 1px solid rgba(0,0,0,0.06);
      color: var(--text);
      flex-shrink: 0;
    }

    #header-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary), #ec4899);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      border: 2px solid #fff;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent);
    }

    #header-avatar svg { width: 20px; height: 20px; fill: #fff; }
    #header-avatar img { width: 100%; height: 100%; object-fit: cover; }

    #header-info { flex: 1; min-width: 0; }

    #header-title {
      font-size: 16px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #header-status {
      font-size: 12px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
    }

    #status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
    }

    #close-btn, #reset-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px;
      color: var(--text-secondary);
      display: flex;
      border-radius: 10px;
      transition: all 0.2s;
    }

    #close-btn:hover, #reset-btn:hover { background: rgba(0,0,0,0.05); color: var(--text); }
    #close-btn svg, #reset-btn svg { width: 18px; height: 18px; stroke: currentColor; fill: none; }

    /* Messages */
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      scroll-behavior: smooth;
      background: transparent;
    }

    #messages::-webkit-scrollbar { width: 6px; }
    #messages::-webkit-scrollbar-track { background: transparent; }
    #messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
    #messages::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }

    .message {
      display: flex;
      flex-direction: column;
      max-width: 85%;
      gap: 4px;
    }

    .message.user { align-self: flex-end; align-items: flex-end; }
    .message.assistant { align-self: flex-start; align-items: flex-start; }

    .bubble {
      padding: 12px 16px;
      border-radius: 18px;
      font-size: 14.5px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }

    .message.user .bubble {
      background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #ec4899));
      color: #fff;
      border-bottom-right-radius: 4px;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 20%, transparent);
    }

    .message.assistant .bubble {
      background: #ffffff;
      color: var(--text);
      border: 1px solid rgba(0,0,0,0.06);
      border-bottom-left-radius: 4px;
    }

    .intext-source {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }

    .intext-source:hover { text-decoration: underline; }

    .message-time {
      font-size: 11px;
      color: var(--text-secondary);
      padding: 0 6px;
      font-weight: 500;
    }

    /* Sources (legacy block, should no longer render) */
    .sources { display: none; }

    /* Typing indicator */
    .typing {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 14px 18px;
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.06);
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      border-radius: 18px;
      border-bottom-left-radius: 4px;
      width: fit-content;
    }

    .typing span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary);
      display: inline-block;
      animation: bounce 1.4s ease-in-out infinite;
      opacity: 0.6;
    }

    .typing span:nth-child(2) { animation-delay: 0.2s; }
    .typing span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /* Greeting card */
    #greeting {
      padding: 16px 20px;
      background: linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 60%, #8b5cf6) 100%);
      color: #fff;
      border-radius: 16px;
      margin: 8px 0;
      font-size: 14.5px;
      line-height: 1.6;
      box-shadow: 0 8px 24px color-mix(in srgb, var(--primary) 30%, transparent);
    }

    /* Input area */
    #input-area {
      padding: 14px 20px;
      border-top: 1px solid rgba(0,0,0,0.06);
      display: flex;
      gap: 10px;
      align-items: flex-end;
      background: rgba(255,255,255,0.6);
      flex-shrink: 0;
    }

    #input {
      flex: 1;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 24px;
      padding: 12px 18px;
      font-size: 14.5px;
      font-family: inherit;
      resize: none;
      outline: none;
      line-height: 1.5;
      max-height: 120px;
      min-height: 46px;
      color: var(--text);
      background: #ffffff;
      transition: all 0.2s;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
    }

    #input:focus { 
      border-color: var(--primary); 
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent), inset 0 2px 4px rgba(0,0,0,0.02);
    }
    
    #input::placeholder { color: var(--text-secondary); }

    #send-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: var(--primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s;
      box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent);
      margin-bottom: 1px;
    }

    #send-btn:hover { 
      background: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #ec4899));
      transform: translateY(-2px);
      box-shadow: 0 6px 16px color-mix(in srgb, var(--primary) 40%, transparent);
    }
    
    #send-btn:active { transform: scale(0.92) translateY(0); }
    #send-btn:disabled { 
      background: var(--border); 
      box-shadow: none; 
      opacity: 0.5; 
      cursor: not-allowed; 
      transform: none; 
    }
    
    #send-btn svg { width: 18px; height: 18px; stroke: #fff; fill: none; margin-left: -2px; }

    /* Powered by */
    #powered-by {
      text-align: center;
      font-size: 11px;
      color: var(--text-secondary);
      padding: 8px;
      background: rgba(255,255,255,0.6);
      flex-shrink: 0;
      font-weight: 500;
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
